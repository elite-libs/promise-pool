import { unpackPromise } from './shared';

export interface PoolConfig {
  maxWorkers: number;
  backgroundRecheckInterval: number;
  /**
   * `timestampCallback` defaults to `Date.now()`
   *
   * In node, get more accurate results with `process.hrtime()`
   *
   */
  timestampCallback?: TimerCallback | null;
}

type TimerType = number | bigint;

type TimerCallback =
  | (() => TimerType)
  | (<TTimerType extends TimerType>(startTime?: TTimerType) => TTimerType);

type AsyncTask<TResult = unknown> = (() => Promise<TResult>);

type TaskResult = {
  index: number;
  // | 'resolved' | 'rejected';
  runtime?: number | bigint;
} & (
  | {
    status: 'pending';
  }
  | {
    status: 'rejected';
    error?: Error;
  }
  | {
    status: 'resolved';
    result?: unknown;
  }
);

/**
 * Worker pool for running tasks in parallel.
 *
 * - A light-weight 'side-channel' for holding and running async tasks.
 * - Excels with long running, IO-bound async.
 * - Minimize traffic spikes. load triggering failures
 *    which cause their own secondary failures (see Failure Amplification Effect).
 *
 * Accepts tasks in the form of functions which enclose async work.
 * (Necessary to control execution.)
 *
 * **Note:** Once `done()` is called, no more tasks may be added &
 *  the task inbox will run until complete.
 *
 */
class PromisePool {
  config: Readonly<PoolConfig> = defaultConfig();
  status: 'initialized' | 'running' | 'done' | 'canceled' = 'initialized';

  /** Used to manage a setInterval monitoring completion */
  private _backgroundIntervalTimer?: NodeJS.Timer;
  private _backgroundIntervalPromise?: ReturnType<typeof unpackPromise<TaskResult[]>> = undefined;
  private _completionPromise?: Promise<void>;
  private currentTaskIndex = -1;
  private _errors: Array<Error> = [];
  private taskList: Array<AsyncTask | TaskResult> = [];
  private workPool: Array<Promise<unknown> | boolean | null> = [];
  private timestampCallback: TimerCallback;

  get _stats() {
    return {
      currentTaskIndex: this.currentTaskIndex,

      taskListSize: this.taskList.length,
      workPoolSize: this.workPool.length,

      processingTaskCount: this.processingTaskCount(),
      isWorkPoolFullToEnd: this.isWorkPoolFullToEnd,
      status: this.status,

      config: this.config,
    };
  }

  /**
   * Use the `add()` method to add tasks to the task pool.
   *
   * @param tasks - An array of tasks to be run in parallel.
   * @returns the number of threads to process the tasks. (Will never exceed `maxWorkers` or number of tasks.)
   */
  add<TTaskType>(...tasks: AsyncTask<TTaskType>[]): number {
    if (this.status === 'done') throw new Error('Task Rejected! Pool finalized, done() called.');
    if (!tasks || !tasks.every((task) => typeof task === 'function')) throw new Error('Task Invalid! Task is not a function.');

    this.taskList.push(...tasks);
    return this.fillWorkPool();
  }

  /**
   * The `drain()` method will wait for all tasks to complete, and allow more tasks to be added afterwards.
   *
   * You must call either `.done()` or `.drain()` to ensure that all tasks are completed.
   *
   * This supports using Promise Pool as a singleton.
   *
   */
  drain() {
    // Object.freeze(this.taskList);
    return Promise.allSettled([
      this.done(),
      this._completionPromise,
    ])
      .finally(() => {
        /* istanbul ignore next - Check for tasks added after done() was called. */
        if (this.currentTaskIndex >= this.taskList.length) {
          /* istanbul ignore next - should never get called, just a failsafe against invalid state. */
          throw Error(`New Tasks found after done() was called. Current Task Index ${this.currentTaskIndex} >= ${this.taskList.length}, Task List ${JSON.stringify(this.taskList)}`);
        }

        return this.forceReset();
      });
  }

  /**
   * The `done()` method will wait for all tasks to complete, preventing any more being processed afterwards.
   * @returns
   */
  done() {
    if (this._backgroundIntervalPromise != null) {
      return this._backgroundIntervalPromise.promise;
    }
    if (this._errors.length > 0) {
      return Promise.reject(new Error(`Promise Pool failed! ${this._errors.length} errors occurred. ${JSON.stringify(this._stats)}`));
    }
    this.status = 'running';
    this._backgroundIntervalPromise = unpackPromise<TaskResult[]>();
    this._backgroundIntervalTimer = this._backgroundIntervalTimer
     || setInterval(this.checkIfComplete.bind(this),
       this.config.backgroundRecheckInterval);
    return this._backgroundIntervalPromise.promise;
  }

  private forceReset() {
    this.currentTaskIndex = -1;
    this.status = 'initialized';
    this.taskList = [];
    this.workPool = [];
    this._errors = [];
    this._completionPromise = undefined;
    this._backgroundIntervalPromise = undefined;
    clearInterval(this._backgroundIntervalTimer);
    this._backgroundIntervalTimer = undefined;
    return this;
  }

  /**
   * When true, the workPool is full, and _**MAY**_ have completed.
   */
  private get isWorkPoolFullToEnd() {
    return this.currentTaskIndex >= this.taskList.length - 1;
  }

  /**
   * Check if the workPool is full, and if so wait for all tasks to resolve or reject.
   */
  private checkIfComplete() {
    // console.log('checkIfComplete._stats', this._stats);
    if (this.isWorkPoolFullToEnd && !this._completionPromise) {
      // Now we need to wait for the pool to finish (or verify it has finished)
      this._completionPromise = Promise.allSettled(this.workPool)
        .then(() => {
          if (this._backgroundIntervalPromise != null) {
            this._backgroundIntervalPromise.resolve(this.getCompletedTasks());
            this.status = 'done';
            clearInterval(this._backgroundIntervalTimer);
            this._backgroundIntervalTimer = undefined;
          }
        })
        // TODO: add configurable error handler
        .catch(console.error);
    }
  }

  /**
   * Fill the workPool with tasks.
   * Called after adding tasks, only runs new tasks if needed.
   *
   * The `for` loop synchronously auto-sizes the worker pool,
   *  under the `maxWorker` limit.
   */
  private fillWorkPool() {
    let workCount = 0;
    for (
      let i = this.processingTaskCount();
      i <= Math.min(this.taskList.length, this.config.maxWorkers) - 1;
      i += 1
    ) {
      workCount += 1;
      this.consumeNextTask();
    }
    return workCount;
  }

  private processingTaskCount() {
    return this.workPool.filter((task) => typeof task === 'object').length;
  }

  private getCompletedTasks(): TaskResult[] {
    return this.taskList.filter((task) => typeof task === 'object' && task.status) as TaskResult[];
  }

  private consumeNextTask() {
    // if (this.processingTaskCount() >= this.config.maxWorkers) return null;

    if (this.currentTaskIndex >= this.taskList.length - 1) return true;
    this.currentTaskIndex += 1;
    const localTaskIndex = this.currentTaskIndex;

    const task = this.taskList[localTaskIndex];
    if (typeof task === 'function') {
      const startTime = this.timestampCallback();
      this.workPool[localTaskIndex] = task();
      const workItem = this.workPool[localTaskIndex];
      if (workItem != null && typeof workItem === 'object') {
        if (
          typeof workItem.then === 'function'
          && typeof workItem.catch === 'function'
        ) {
          workItem
            .then((result) => {
              this.workPool[localTaskIndex] = true;
              this.taskList[localTaskIndex] = {
                index: localTaskIndex,
                result,
                status: 'resolved',
                runtime: this.getOrCompareTimestamp(startTime),
              };
            })
            .catch((error: Error) => {
              this.workPool[localTaskIndex] = false;
              this.taskList[localTaskIndex] = {
                index: localTaskIndex,
                error,
                status: 'rejected',
                runtime: this.getOrCompareTimestamp(startTime),
              };
            })
            .finally(() => this.consumeNextTask());
        } else {
          const error = new Error(`Invalid Task! Tasks must return a Thenable/Promise-like object: Received ${typeof workItem}`);
          this._errors.push(error);
        }
      } else {
        const error = new Error(`Invalid Task! Tasks must return a Thenable/Promise-like object: Received ${typeof workItem}`);
        this._errors.push(error);
      }
    }
    return false;
  }

  private getOrCompareTimestamp(timestamp?: TimerType) {
    if (!this.config.timestampCallback) return undefined;
    // if (timestamp == null) return this.config.timestampCallback();
    if (this.config.timestampCallback.length >= 1) {
      return this.config.timestampCallback(timestamp);
    }
    const bigDiff = BigInt(this.config.timestampCallback()) - BigInt(timestamp!);
    if (bigDiff < BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(bigDiff.toString());
    }
    return bigDiff;
  }

  constructor(config: Partial<PoolConfig> = defaultConfig()) {
    this.config = Object.freeze({
      ...defaultConfig(),
      ...config,
    });
    this.timestampCallback = this.config.timestampCallback || (() => Number.NaN);
    this.add = this.add.bind(this);
    this.done = this.done.bind(this);
    this.drain = this.drain.bind(this);
    this.forceReset = this.forceReset.bind(this);
    this.checkIfComplete = this.checkIfComplete.bind(this);
    this.fillWorkPool = this.fillWorkPool.bind(this);
    this.processingTaskCount = this.processingTaskCount.bind(this);
    this.getCompletedTasks = this.getCompletedTasks.bind(this);
    this.consumeNextTask = this.consumeNextTask.bind(this);
    this.getOrCompareTimestamp = this.getOrCompareTimestamp.bind(this);
  }
}

function defaultConfig(): PoolConfig {
  return {
    maxWorkers: 4,
    backgroundRecheckInterval: 5,
    timestampCallback: () => Date.now(),
  };
}

export default PromisePool;
export { PromisePool };
