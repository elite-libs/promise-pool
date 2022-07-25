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
  config: Readonly<PoolConfig> = {
    maxWorkers: 1,
    timestampCallback: Date.now,
    backgroundRecheckInterval: 5,
  };
  timestampCallback: TimerCallback;

  private _backgroundIntervalPromise: ReturnType<typeof unpackPromise> | null = null;
  private currentTaskIndex = -1;
  taskList: Array<AsyncTask | TaskResult> = [];
  workPool: Array<Promise<unknown> | boolean | null> = [];
  status: 'initialized' | 'running' | 'done' | 'canceled' = 'initialized';

  private _completionPromise?: Promise<void>;

  /** Used to manage a setInterval monitoring completion */
  private _checkIfCompleteInterval?: NodeJS.Timer;
  private _errors: Array<Error> = [];

  get isDone() {
    return this.status === 'done';
  }

  get _stats() {
    return {
      taskListSize: this.taskList.length,
      workPoolSize: this.workPool.length,

      currentTaskIndex: this.currentTaskIndex,

      processingTaskCount: this.processingTaskCount(),
      isWorkPoolFullToEnd: this.isWorkPoolFullToEnd,
      isDone: this.isDone,
      status: this.status,

      config: this.config,
    };
  }

  add = <TTaskType>(...tasks: AsyncTask<TTaskType>[]): number => {
    if (this.isDone)
      throw new Error('Task Rejected! Pool finalized, done() called.');
    if (!tasks || !tasks.every(task => typeof task === 'function'))
      throw new Error('Task Invalid! Task is not a function.');

    this.taskList.push(...tasks);
    return this.fillWorkPool();
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
  private checkIfComplete = () => {
    // console.log('checkIfComplete._stats', this._stats);
    if (this.isWorkPoolFullToEnd && !this._completionPromise) {
      // Now we need to wait for the pool to finish (or verify it has finished)
      this._completionPromise = Promise.allSettled(this.workPool)
        .then(() => {
          if (this._backgroundIntervalPromise != null) {
            this._backgroundIntervalPromise.resolve(this.taskList);
            this.status = 'done';
            clearInterval(this._checkIfCompleteInterval);
            this._checkIfCompleteInterval = undefined;
          }
        })
        // TODO: add configurable error handler
        .catch(console.error);
    }
  }

  done = () => {
    if (this._backgroundIntervalPromise != null) return this._backgroundIntervalPromise.promise;
    if (this._errors.length > 0) {
      console.error(`Promise Pool failed! ${this._errors.length} errors occurred.`, this._stats);
      return Promise.reject(new Error(`Promise Pool failed! ${this._errors.length} errors occurred.`));
    }
    this.status = 'running';
    this._backgroundIntervalPromise = unpackPromise<TaskResult[]>();
    this._checkIfCompleteInterval ||= setInterval(
      this.checkIfComplete.bind(this),
      this.config.backgroundRecheckInterval
    );
    return this._backgroundIntervalPromise.promise;
  }

  /**
   * Fill the workPool with tasks.
   * Called after adding tasks, only runs new tasks if needed.
   *
   * The `for` loop synchronously auto-sizes the worker pool,
   *  under the `maxWorker` limit.
   */
  private fillWorkPool = () => {
    let workCount = 0;
    for (
      let i = this.processingTaskCount();
      i <= Math.min(this.taskList.length, this.config.maxWorkers) - 1;
      i++
    ) {
      workCount++;
      this.consumeNextTask();
    }
    return workCount;
  }

  private processingTaskCount = () => {
    return this.workPool.filter((task) => typeof task === 'object').length;
  }

  private consumeNextTask = () => {
    // if (this.processingTaskCount() >= this.config.maxWorkers) return null;
    
    ++this.currentTaskIndex;
    if (this.currentTaskIndex >= this.taskList.length) return true;
    const localTaskIndex = this.currentTaskIndex;

    const task = this.taskList[localTaskIndex];
    if (typeof task === 'function') {
      const startTime = this.timestampCallback();
      this.workPool[localTaskIndex] = task();
      const workItem = this.workPool[localTaskIndex];
      if (workItem != null && typeof workItem === 'object') {
        if (
          typeof workItem['then'] === 'function' &&
          typeof workItem['catch'] === 'function'
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
            .catch((error) => {
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
          const error = new Error(
            `Invalid Task! Tasks must return a Thenable/Promise-like object: Received ${typeof workItem}`
          );
          this._errors.push(error);
        }
      } else {
        const error = new Error(
          `Invalid Task! Tasks must return a Thenable/Promise-like object: Received ${typeof workItem}`
        );
        this._errors.push(error);
      }
    }
    return false;
  }

  private getOrCompareTimestamp = (timestamp?: TimerType) => {
    if (!this.config.timestampCallback) return undefined;
    // if (timestamp == null) return this.config.timestampCallback();
    if (this.config.timestampCallback.length >= 1) {
      return this.config.timestampCallback(timestamp);
    } else {
      const bigDiff =
        BigInt(this.config.timestampCallback()) - BigInt(timestamp!);
      if (bigDiff < BigInt(Number.MAX_SAFE_INTEGER)) {
        return Number(bigDiff.toString());
      } else {
        return bigDiff;
      }
    }
  }

  constructor(config: Partial<PoolConfig> = defaultConfig()) {
    this.config = Object.freeze({
      ...defaultConfig(),
      ...config,
    });
    this.timestampCallback =
      this.config.timestampCallback || (() => Number.NaN);
  }
}

function defaultConfig(): PoolConfig {
  return {
    maxWorkers: 4,
    backgroundRecheckInterval: 15,
    timestampCallback: () => Date.now(),
  };
}

export default PromisePool;
export { PromisePool };
