# Promise Pool

[![CI Status](https://github.com/elite-libs/promise-pool/workflows/test/badge.svg)](https://github.com/elite-libs/promise-pool/actions)
[![NPM version](https://img.shields.io/npm/v/@elite-libs/promise-pool.svg)](https://www.npmjs.com/package/@elite-libs/promise-pool)
[![GitHub stars](https://img.shields.io/github/stars/elite-libs/promise-pool.svg?style=social)](https://github.com/elite-libs/promise-pool)

A background task processor focused on reliability and scalability.

## Features

- [x] Configurable.
- [x] Concurrency limit.
- [x] Retries. (Use `p-retry` for this.)
- [x] Zero dependencies.
- [x] Error handling.
- [x] Singleton mode: Option to auto-reset when `.done()`. (Added `.drain()` method.)
- [x] Task scheduling & prioritization.
  - [x] Optionally `return` hints. (To support API's like GitHub which return rate limit hints in http headers, e.g. `X-RateLimit-Remaining` header.)
<!-- - [x] ~~Progress events.~~ -->

## API

`PromisePool` exposes 3 methods:

- **`.add(...tasks)`** - add one (or more) tasks for background processing. (A task is a function that wraps a `Promise` value. e.g. `() => Promise.resolve(1)`).
- **`.drain()`** - Returns a promise that resolves when all tasks have been processed, or when another thread calls `.drain()` mid-task execution. This is important to maximize performance in shared server environments, so _subsequent calls to `.drain()` will ensure only the last caller to `.drain()` will `await` until the completion of all tasks._
- **`.done()`** - optionally finalize the pool. Returns a promise that resolves when all tasks are complete. _No more tasks can be added after this._

<!-- This is to make it easy to implement & operate.
Tasks added to the pool will begin executing immediately, with a concurrency limit as configured (default of `4`). -->

### Install
  
```sh
# with npm
npm install @elite-libs/promise-pool
# or using yarn
yarn add @elite-libs/promise-pool
```

## New Features

### v1.3 - **September 2022****


- _What?_ Adds Smart `.drain()` behavior.
  - _Why?_
    1. Speeds up concurrent server environments!
    1. prevents several types of difficult (ghost) bugs!
        - stack overflows/mem access violations,
        - exceeding rarely hit OS limits, (e.g. max open handle/file/socket limits)
        - exceeding limits of Network hardware (e.g. connections/sec, total open socket limit, etc.)
        - uneven observed wait times.
  - _How?_ Only awaits the latest `.drain()` caller.
  - _Who?_ `Server` + `Singleton` use cases will see a major benefit to this design.
  - _Errata_
    - Here are several competing (tortured) metaphors, please suggest more & let me know which makes the most sense.
      - Like a relay race's series of baton handoffs. As soon as you hand off, your race is over & the next runner must either run until finish (wait to end) OR hand off the job to someone new.
      - A tiny Queue, with a size of **one!**
      - A 'Take-a-penny-leave-a-penny' tray, _big enough for exactly 1 penny._
      - This is similar to the feature in MongoDB called the `Write Threshold/Concern` setting, or in Distributed SQL Replication where you can set a minimum # of confirmed 'server writes' before SQL considers it **safely written** in the cluster.
      - Anectode: A group of friends had a rule that whoever is last to arrive must pay for the first friend (to arrive on time.)

### Usage

#### Simplified Usage

```typescript
import PromisePool from '@elite-libs/promise-pool';
// 1/3: Either use the default instance or create a new one.
const pool = new PromisePool();

// 2/3: Add task(s) to the pool as needed.
// PromisePool will execute them in parallel as soon as possible.
pool.add(() => saveToS3(data));
pool.add(() => expensiveBackgroundWork(data));

// 3/3: REQUIRED: in order to ensure your tasks are executed, 
// you must await either `pool.drain()` or `pool.done()` at some point in your code (`done` prevents additional tasks from being added).
await pool.done();
```

#### Advanced Usage

In this example we'll use a singleton pattern to ensure we have only 1 `Promise Pool` instance per process.

```typescript
// `./src/services/taskPool.ts`
import PromisePool from '@elite-libs/promise-pool';

export const taskPool = new PromisePool({
  maxWorkers: 6, // Optional. Default is `4`.
});
```

Then from inside your app (Lambda function, Express app, etc.) you can use the `taskPool` instance to add tasks to the pool.

```typescript
// Example Lambda function
// `./src/handlers/user.handler.ts`
import { taskPool } from './services/taskPool';
export const handler = async (event, context) => {
  const data = getDataFromEvent(event);
  taskPool.add(() => saveToS3(data));
  taskPool.add(() => expensiveBackgroundWork(data));
  await taskPool.drain();

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Success',
    }),
  }
}
```

Note the `await taskPool.drain()` call. This is required to ensure your tasks are executed.

You could also utilize `Promise Pool` in [`middy`](https://middy.js.org/) middleware:

##### Per-request pool instance

```typescript
import PromisePool, { PoolConfig } from '@elite-libs/promise-pool';

const defaults = {};

const promisePoolMiddleware = (opts: Partial<PoolConfig> = {}) => {
  const options = { ...defaults, ...opts };

  return {
    before: (request) => {
      Object.assign(request.context, {
        taskPool: new PromisePool(options),
      });
    },
    after: async (request) => {
      await request.context.taskPool.drain();
    }
  }
}

export default promisePoolMiddleware;
```

##### Singleton pool instance middleware

```typescript
// Important: Import a global instance of `Promise Pool`
import { taskPool } from './services/taskPool';

const taskPoolMiddleware = () => ({
  before: (request) => {
    Object.assign(request.context, { taskPool });
  },
  after: async (request) => {
    await request.context.taskPool.drain();
  }
});

export default taskPoolMiddleware;
```

Now you can use `taskPool` in your Lambda function:

```typescript
request.context.taskPool.add(() => saveToS3(data));
```

Now the `drain()` method will be called automatically `after()` every Lambda function returns.


#### Express Example

```js
// `./src/middleware/taskPool.ts`
import { taskPool } from "../services/taskPool.mjs";

export const taskPoolMiddleware = (req, res, next) => {
  req.taskPool = taskPool;
  next();
};
```
  
Then you can use `taskPool` in your Express app:

```js
import { taskPool } from "../services/taskPool.mjs";

export const taskPoolMiddleware = (req, res, next) => {
  req.taskPool = taskPool;
  next();
};
```


> See [`/examples`](/examples/) folder for more examples.

<!--
## Config Options

```ts
interface PoolConfig {
  maxWorkers: number;
  backgroundRecheckInterval: number;
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
   * `timestampCallback` defaults to `Date.now()`
   *
   * In node, get more accurate results with `process.hrtime()`
   *
   */
  timestampCallback?: TimerCallback | null;
}
```

-->
<!-- # Naming & Abbreviation Ideas 

| Abbrev. | Name |
|-|-|
| ASS Pool | **Async Streaming Service Pool** (though I think Hard Rock Hotel snagged this a while ago...) |
| TAR Pool | **Throttled Async Recursive Pool**  |
| AASS Pool  | **Async, Await, Streaming Service Pool** |
| SCAM | **Streaming coordinated, async manager** |
| SQAM | **Streamed queue, async manager** |
| SMAQ | **Streaming managed, async queue** |
| SPAQ | **Streamed processing, async queue** |
| SPANQ | **Streamed processing, async natural queue** |
| SPAAS | **Streaming promise, async, await service** |
| SPAAM | **Streaming promise, async, await manager** |
| TPS, & TPS Reports | **Throttled Promise Service. Which emits  _TPS Reports_** |
| PASS Pool  | **Promise, Async, Streaming, Service Pool** |
| SPAAT | **Streaming promise, async, await throttling** |
| SAAP | **Streaming async & await, pool service!** |
 -->

<!-- 
## MVP

1. Create an instance on ASS Class
1. TDD/design interfaces
 -->
