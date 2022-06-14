//     allSettled<T extends readonly unknown[] | []>(values: T): Promise<{ -readonly [P in keyof T]: PromiseSettledResult<Awaited<T[P]>> }>;

type TaskFunction = <TResult>() => Promise<Awaited<TResult>>;
type TaskMetadata = {
  taskIndex?: number;
  taskRuntime?: number;
};

type TaskResult<TResult, TError extends Error> = ({
  status: 'fulfilled';
  value: TResult;
} | {
  status: 'rejected';
  value: TError | unknown;
});

interface PoolConfig {
  maxWorkers: number;
  results: 'ignore' | 'collect-all' | 'only-errors';

  errorLimit: number | false;
  retryLimit: number | false;
  retryBackoff: 'exponential' | 'linear';

  onTaskError?: <TPlaceholder, TError extends Error>(error: TError, task: TaskResult<TPlaceholder, TError> & TaskMetadata) => void | Promise<unknown> | unknown;

  // Instrumentation
  /**
   * Defaults to `Date.now()`
   *
   * In node, get more accurate results with `process.hrtime()`
   *
   */
  timestampCallback: () => number;
  enableStats?: boolean;
}

export class PromisePool<TTaskResult, TError extends Error> {
  config: Readonly<PoolConfig>;

  queue: TaskFunction[] = [];

  resultMap: WeakMap<TaskFunction, TaskResult<TTaskResult, TError>> = new WeakMap();

  poolState: null | Int8Array = null;
  // "wait" | "running" | "fulfilled" | "rejected" = "idle";

  constructor(config: Partial<PoolConfig> = defaultConfig()) {
    this.config = Object.freeze({
      ...defaultConfig(), ...config,
    });
    this.poolState = new Int8Array(this.config.maxWorkers);
  }

  enqueue(task: TaskFunction): void {
    this.queue.push(task);
  }

  async run(...tasks: TaskFunction[]): Promise<TTaskResult> {
    Atomics;
  }
}

function defaultConfig(): PoolConfig {
  return {
    maxWorkers: 4,
    results: 'collect-all',
    errorLimit: false,
    retryLimit: false,
    retryBackoff: 'exponential',
    timestampCallback: () => Date.now(),
  };
}
