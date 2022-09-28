# Promise Pool

[![CI Status](https://github.com/elite-libs/promise-pool/workflows/test/badge.svg)](https://github.com/elite-libs/promise-pool/actions)
[![NPM version](https://img.shields.io/npm/v/@elite-libs/promise-pool.svg)](https://www.npmjs.com/package/@elite-libs/promise-pool)
[![GitHub stars](https://img.shields.io/github/stars/elite-libs/promise-pool.svg?style=social)](https://github.com/elite-libs/promise-pool)

A background task processor focused on performance, reliability, and durability.

| **Table of Contents**

- [Promise Pool](#promise-pool)
  - [Features](#features)
  - [API](#api)
    - [Install](#install)
    - [Usage](#usage)
      - [Simple](#simple)
      - [Advanced](#advanced)
        - [Singleton Pattern](#singleton-pattern)
        - [Shared Pool: AWS Lambda & Middy](#shared-pool-aws-lambda--middy)
        - [Shared Pool: Express Example](#shared-pool-express-example)
  - [Changelog](#changelog)
    - [v1.3 - **September 2022**](#v13---september-2022)

## Visual: Smart Multi-Threaded Execution

> Diagram of Promise Pool's 'Minimal Blocking' design

<img src="/public/PromisePool-drain-behavior-draft-2022-09-13.png" alt="Diagram: Visual of our minimal blocking design" />

### Why `Promise Pool` Is Essential

Promise Pool strives to excel at 4 key goals:

1. Durability - won't fail in unpredictable ways - even under extreme load.
1. Extensible by Design - supports Promise-based libraries (examples include: [retry handling](#p-retry), [debounce/throttle](#p-retry), [paged results loader](#github-api-downloader))
1. Reliability - control your pool with: total runtime limit (align to max HTTP/Lambda request limit), idle timeout (catch orphan or zombie situations), plus a worker limit.
1. Performance - the work pool queue uses a speedy Ring Buffer design pattern!* 

> Remember, **_DERP_** for short.

\* Since this is JavaScript, our Ring Buffer is more like three JS Arrays in a trenchcoat.

### Who needs a `Promise Pool`?

Imagine a Node Service (or Lambda function) that suddenly gets an avalanche of _near_ simultaneous requests. Each request then causes its own cascade of async work: logging, querying, paging, batching, filtering, data platforms, CMS, event triggers, behavioral analytics, etc.

> 🚀 Does this sound familiar? You're in the right place, keep reading! 📚

Under normal traffic, and certainly in development Nodejs is VERY forgiving of the `YOLO Async Pattern`, AKA no particular patterns at all. After all, we have things like `Promise.all()`! Without limits of any kind!

> _Look ma,_ millions of Promises! No consequences! Well, not quite...
> Eventually _Durability_, _Reliability_ and _Performance_ will suffer with increased timeouts, exhausted RAM/CPU, stack overflows, and fire & brimstone!
<!-- Users may experience partial page loads, infinite spinners, and could see ugly tech details (stack traces.) -->

Since this issue is fundamentally about exceeding an invisible traffic threshold, **no code change is required** AND many error **logging services will fail to record it.** It's not uncommon for these issues to surface in strange & random ways, often going unnoticed for a while. Another key factor here is _most_ testing software isn't designed to easily simulate traffic & measure request runtime against some SLA. This is a challenging area to automate. Since mocking any external requests will interfere with meaningful analysis, all tests & observations must be made against either real (production) or real-ish (AKA a private clone of production) systems.


<!-- Unlimited background tasks or too many foreground  will situation can cause silent failures, often   is a particular annoying type of issue, as it usually comes up when a service has grown to rely on many API integrations.  issue, by its nature, can prevent observability via typical methods (no RAM can imply a failure to log to DataDog or Sentry). -->

Let's talk performance, most services don't prioritize the task(s) that affect the response sent to the user. Ironically, once the need to split async work between blocking and non-blocking becomes clear (where) and  user-facing  need for background or non-blocking async tasks arises, the code base has become too complex to easily refactor.

<!-- I often see slow designs where users end up waiting after their response is ready, usually to allow post processing or logging. however only a **tiny fraction of those calls are needed** to show the user what they want. "real" work for the user, and plenty of non-urgent & important work. each with 20-50 background tasks. threads  -->

## Features

- [x] Configurable.
- [x] Concurrency limit.
- [x] Retries. (Use `p-retry` for this.)
- [x] Zero dependencies.
- [x] Error handling.
- [x] Singleton mode: Option to auto-reset when `.done()`. (Added `.drain()` method.)
- [x] Task scheduling & prioritization.
  - [x] Support or `return` hints/stats? (Time in Event Loop? Event Loop wait time? Pending/Complete task counts?)
  - [x] Support smart 'Rate Limit' logic.
    - Recommended solution: conditionally delay (using `await delay(requestedWaitTime)`) before (or after) each HTTP call.
    - Typically you'll detect Rate Limits via HTTP headers (or Payload/body data.) For example, check for any headers like `X-RateLimit-WaitTimeMS`.)


## API

`PromisePool` exposes 3 methods:

- **`.add(...tasks)`** - add one (or more) tasks for background processing. (A task is a function that wraps a `Promise` value. e.g. `() => Promise.resolve(1)`).
- **`.drain()`** - Returns a promise that resolves when all tasks have been processed, or another thread takes over waiting by calling `.drain()` again.
- **`.done()`** - Drains AND 'finalizes' the pool. _No more tasks can be added after this._ Can be called from multiple threads, only runs once.

> See either the [Usage](#usage) Section below, or checkout the [`/examples`](/examples/) folder for more complete examples.

## Install
  
```sh
# with npm
npm install @elite-libs/promise-pool
# or using yarn
yarn add @elite-libs/promise-pool
```

## Usage

In the examples below you will see 2 similar names used: `taskPool` and `PromisePool`.

A `taskPool` or `pool` refers to a **specific instance** of this library (named `Promise Pool` by `@elite-libs`.)

### Basic Example

```typescript
import PromisePool from '@elite-libs/promise-pool';
// 1/3: Either use the default instance or create a new one.
const pool = new PromisePool();

(async () => {
  // 2/3: Add task(s) to the pool as needed.
  // PromisePool will execute them in parallel as soon as possible.
  pool.add(() => saveToS3(data));
  pool.add(() => expensiveBackgroundWork(data));
  
  // 3/3: REQUIRED: in order to ensure your tasks are executed, 
  // you must await either `pool.drain()` or `pool.done()` at some point in your code (`done` prevents additional tasks from being added).
  await pool.drain();
})();
```

## Patterns

### Allow Creating Many Pools (Factory Pattern)

Here a Factory Function (a fancy name for a _function that makes things_) is used to standardize options for this particular app.

#### **File `/services/taskPoolFactory.ts`**

```typescript
import PromisePool from '@elite-libs/promise-pool';

export function taskPoolFactory() {
  return new PromisePool({
    maxWorkers: 6, // Optional. Default is `4`.
  });
}
```

### Shared Global Pool (Singleton Pattern)

> **Recommended for all** Node-based servers and services, and any other async & promise based apps.

The singleton pattern here ensures we have only 1 `Promise Pool` instance 'globally' (per process).

When using a "Singleton Pattern," the `maxWorkers` value will act as a **global limit** on the number of tasks allowed **in-progress at any given time.**

#### **File `/services/taskPoolSingleton.ts`**

```typescript
import PromisePool from '@elite-libs/promise-pool';

export const taskPoolSingleton = new PromisePool({
  maxWorkers: 6, // Optional. Default is `4`.
});
```

<!-- Then from inside your app (Lambda function, Express app, etc.), you can use the `taskPool` instance to add tasks to the pool. -->

## Recipes: AWS Lambda & Promise Pool

### Simple Lambda & `Promise Pool` Usage

#### **File 2/2 `/handlers/user.handler.ts`**

```typescript
import { taskPool } from './services/taskPoolSingleton';
export const handler = async (event, context) => {
  const data = getDataFromEvent(event);
  taskPool.add(() => logMetrics(data));
  taskPool.add(() => saveToS3(request));
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

⚠️ Note the `await taskPool.drain()` call. This is required to ensure your tasks are executed.

### Shared Pool: AWS Lambda & Middy

`Promise Pool` fits in [`middy`](https://middy.js.org/) middleware:

#### **File 1/2 `services/taskPoolSingleton.ts`**

```typescript
import { taskPool } from './services/taskPoolSingleton';

const taskPoolMiddleware = () => ({
  before: (event) => {
    Object.assign(event.context, { taskPool });
  },
  after: async (event) => {
    await event.context.taskPool.drain();
  }
});

export default taskPoolMiddleware;
```

Now you can use `taskPool` in your Lambda function via `event.context.taskPool`:

#### **File 2/2 `/handlers/example.handler.ts`**

```typescript
export const handler = async (event, context) => {
  const data = getDataFromEvent(event);
  taskPool.add(() => saveToS3(data));
  taskPool.add(() => expensiveBackgroundWork(data));
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Success',
    }),
  }
}

```

Now the `drain()` method will be called automatically `after()` every Lambda function returns.

### Shared Pool: Express Example

#### **File 1/2 `/services/taskPoolSingleton.mjs`**

```js
import PromisePool from '@elite-libs/promise-pool';

export const taskPoolSingleton = new PromisePool({
  maxWorkers: 6, // Optional. Default is `4`.
});
```

#### **File 1/2 `/middleware/taskPool.middleware.mjs`**

```js
import { taskPoolSingleton } from "../services/taskPoolSingleton.mjs";

const taskPoolMiddleware = {
  setup: (request, response, next) => {
    request.taskPool = taskPool;
    next();
  },
  cleanup: (request, response, next) => {
    if (request.taskPool && 'drain' in request.taskPool) {
      taskPool.drain();
    }
    next();
  }
};

export default taskPoolMiddleware;
```

To use the `taskPoolMiddleware` in your Express app, you'd include `taskPoolMiddleware.setup()` and `taskPoolMiddleware.cleanup()`.

#### **File 1/2 `/app.mjs`**

```js
import tpMiddleware from "../middleware/taskPool.middleware.mjs";

export const app = express()

// Step 1/2: Setup the taskPool
app.use(taskPoolMiddleware.setup)
app.use(express.bodyParser())
app.post('/users/', function post(request, response, next) {
    const { taskPool } = request;

    const data = getDataFromBody(request.body);

    // You can .add() tasks where ever needed,
    //   - they'll run in the background.
    taskPool.add(() => logMetrics(data));
    taskPool.add(() => saveToS3(request));
    taskPool.add(() => expensiveBackgroundWork(data));
    
    // Or, 'schedule' multiple tasks at once.
    const tasks = [
      () => logMetrics(data), 
      () => saveToS3(request),
      () => expensiveBackgroundWork(data)
    ]
    taskPool.add(...tasks);

    next();
  })
// Step 2/2: Drain the taskPool
app.use(taskPoolMiddleware.cleanup);
```

## Changelog

### v1.3 - **September 2022**

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
- _Huh?_ [See diagram](#visual-smart-multi-threaded-execution)


