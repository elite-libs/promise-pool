/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/lines-between-class-members */
type TaskFunction<TResult> = (poolIndex: number) => Promise<TResult>;
// type TaskMetadata = {
//   taskIndex?: number;
//   taskRuntime?: number;
// };

// type PromiseResult<TResult, TError extends Error> =
//   | {
//       status: 'fulfilled';
//       value: TResult;
//     }
//   | {
//       status: 'rejected';
//       value: TError | unknown;
//     };

interface PoolConfig {
  maxWorkers: number;
  // results: 'ignore' | 'collect-all' | 'only-errors';

  // errorLimit: number | false;
  // retryLimit: number | false;
  // retryBackoff: 'exponential' | 'linear';

  // onTaskError?: <TPlaceholder, TError extends Error>(
  //   error: TError,
  //   task: TaskResult<TPlaceholder, TError> & TaskMetadata
  // ) => void | Promise<unknown> | unknown;

  // Instrumentation
  /**
   * Defaults to `Date.now()`
   *
   * In node, get more accurate results with `process.hrtime()`
   *
   */
  timestampCallback: () => number;
}

/**
 *
 * TODO: Document this subtle fanciness...
 *
 */
function promiseTracer(
  taskFunction: TaskFunction<TaskResult>,
  inboxIndex: number,
  ...metadata: unknown[]
) {
  return funcWrapper(taskFunction, inboxIndex, metadata);
}

// type TaskResult = ReturnType<ReturnType<typeof promiseTracer>>;
/** Curried w/ poolIndex */
type TaskCallbackResult = ReturnType<typeof promiseTracer>;

type TaskWrappedResult = ReturnType<typeof funcWrapper>;

interface TaskResult {
  inboxIndex: number;
  isError: undefined;
  metadata: unknown[];
  poolIndex: number;
  result: any;
  status: string;
  taskRuntime: number;
}

/**
 * Worker pool for running tasks in parallel.
 *
 * - A light-weight 'side-channel' for holding and running async tasks.
 * - Excels with long running,
 * IO bound async.
 * - Reduces likelihood of run-away traffic load triggering failures
 *    which cause their own secondary failures (see Failure Amplification Effect).
 *
 * Accepts tasks in the form of functions which enclose async work.
 * (Necessary to control execution.)
 *
 * **Note:** Once `done()` is called, no more tasks may be added &
 *  the task inbox will run until complete.
 *
 */
export default class PromisePool<TTaskResult, TError extends Error> {
  config: Readonly<PoolConfig>;

  private results: Array<Awaited<ReturnType<typeof this.runNextTask>>> = [];
  inbox: ReturnType<typeof promiseTracer>[] = [];
  dynamicPool: ReturnType<ReturnType<typeof promiseTracer>>[];

  status: 'initialized' | 'running' | 'done' | 'cancelled' = 'initialized';
  isDone = false;

  enqueue(task: ReturnType<typeof promiseTracer>, metadata?: unknown): void {
    if (this.isDone)
      throw new Error('Task Rejected! Pool finalized, done() called.');
    if (!task || typeof task !== 'function')
      throw new Error('Task Invalid! Task is not a function.');

    this.inbox.push(promiseTracer(task, this.inbox.length, metadata));
  }

  // const taskIndex = this.inbox.indexOf(task);
  // const taskRuntime = this.config.timestampCallback();
  // const taskMetadata: TaskMetadata = { taskIndex, taskRuntime };
  // const taskResult = await this.runTask(task, taskMetadata);
  // this.results.set(task, taskResult);
  // if (taskResult.status === 'fulfilled') {
  //   return taskResult.value;
  // }

  async done() {
    while (this.inbox.length <= this.config.maxWorkers) {
      const nextTask = this.getNextTask();
      if (nextTask !== null) this.enqueue(nextTask);
    }
    while (this.inbox.length > 0) {
      try {
        await this.runNextTask();
        // if (taskResult !== null) {
        //   if (!taskResult.isError) {
        //     taskResult.result;
        //   } else {
        //     taskResult.reason;
        //   }
        // }
      } catch (error) {
        console.error('Error in PromisePool.done():', error);
      }
    }
  }

  // is
  runNextTask() {
    // Attach tracking indexes to easily replace tasks upon completion
    this.dynamicPool.map((task, index) => {
      (task as unknown as any).poolIndex = index;
    });
    // Unpack
    return Promise.race(this.dynamicPool).then(
      ({
        result,
        inboxIndex,
        poolIndex,
        status,
        taskRuntime,
        isError,
        metadata,
      }) => {
        if (!Number.isFinite(poolIndex)) {
          throw Error(
            `Invalid value for the pool index/tracking position: ${poolIndex}`
          );
        }
        const taskWrapper = this.getNextTask();

        if (!taskWrapper) {
          this.status = 'done';
          throw Error('All tasks completed!');
        }
        this.dynamicPool[poolIndex] = taskWrapper?.(poolIndex)!;

        const taskResult = {
          result,
          inboxIndex,
          poolIndex,
          status,
          taskRuntime,
          isError,
          metadata,
        };

        if (this.results[inboxIndex])
          throw Error('Unexpected duplicate index access:' + inboxIndex);

        this.results[inboxIndex] = taskResult;
        return taskResult;
      }
    );
  }

  getNextTask() {
    const resultIndex = this.inbox.length;
    const task = this.inbox.shift();
    if (task) {
      // @ts-expect-error
      task?.inboxIndex = resultIndex;
      return task;
    }
    return null;
  }

  constructor(config: Partial<PoolConfig> = defaultConfig()) {
    this.config = Object.freeze({
      ...defaultConfig(),
      ...config,
    });
    this.dynamicPool = Array(this.config.maxWorkers);
  }
}

function funcWrapper(
  taskFunction: TaskFunction<TaskResult>,
  inboxIndex: number,
  metadata: unknown[]
) {
  return async (poolIndex: number) => {
    const start = Date.now();
    const response: object = await taskFunction(poolIndex)
      .then((result: unknown) => ({ result }))
      .catch((error: Error) => ({
        // These error details will be merged below with the task metadata
        isError: true,
        status: 'rejected',
        message: error.message,
        reason: error,
      }));
    const end = Date.now();

    return {
      isError: undefined,
      status: 'resolved',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      // @ts-expect-error
      result: response?.result,
      ...response,
      taskRuntime: end - start,
      inboxIndex,
      poolIndex,
      metadata,
    };
  };
}

function defaultConfig(): PoolConfig {
  return {
    maxWorkers: 4,
    // results: 'collect-all',
    // errorLimit: false,
    // retryLimit: false,
    // retryBackoff: 'exponential',
    timestampCallback: () => Date.now(),
  };
}
