# Promise Pool 🏖️

[![CI Status](https://github.com/elite-libs/promise-pool/workflows/test/badge.svg)](https://github.com/elite-libs/promise-pool/actions)
[![NPM version](https://img.shields.io/npm/v/@elite-libs/promise-pool.svg)](https://www.npmjs.com/package/@elite-libs/promise-pool)
[![GitHub stars](https://img.shields.io/github/stars/elite-libs/promise-pool.svg?style=social)](https://github.com/elite-libs/promise-pool)

> A background task processor focused on performance, reliability, and durability.

TLDR; An upgraded Promise queue that's essentially a stateful `Promise.all()` wrapper.

| **Table of Contents**

- [Smart Multi-Threaded Execution](#smart-multi-threaded-execution)
  - [Key `Promise Pool` Features](#key-promise-pool-features)
  - [Who needs a `Promise Pool`?](#who-needs-a-promise-pool)
- [Features](#features)
- [API](#api)
- [Install](#install)
- [Usage](#usage)
  - [Minimal Example](#minimal-example)
  - [Singleton Pattern](#singleton-pattern)
- [Recipes](#recipes)
  - [AWS Lambda \& Middy](#aws-lambda--middy)
  - [Express Middleware](#express-middleware)
- [Changelog](#changelog)
  - [v1.3.1 - **April 2023**](#v131---april-2023)
  - [v1.3.0 - **September 2022**](#v130---september-2022)

## Smart Multi-Threaded Execution

> Diagram of Promise Pool's 'Minimal Blocking' design

<img src="/public/PromisePool-drain-behavior-draft-2022-09-13.png" alt="Diagram: Visual of our minimal blocking design" />

### Key `Promise Pool` Features

Promise Pool strives to excel at 4 key goals:

1. Durability - won't fail in unpredictable ways - even under extreme load.
2. Extensible by Design - supports Promise-based libraries (examples include: [retry handling](https://github.com/sindresorhus/p-retry), [debounce/throttle](https://github.com/sindresorhus/p-throttle))
3. Reliability - control your pool with a total runtime limit (align to max HTTP/Lambda request limit), idle timeout (catch orphan or zombie situations), plus a concurrent worker limit.
4. Performance - the work pool queue uses a speedy Ring Buffer design!*

\* Since this is JavaScript, our Ring Buffer is more like three JS Arrays in a trenchcoat.

### Who needs a `Promise Pool`?

- Any Node Services (Lambda functions, etc.) which does background work, defined as:
  - Long-running async function(s),
    - where the `return` value isn't used (in the current request.)
    - And failures are handled by logging.

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

### Minimal Example

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

### Singleton Pattern

> **Recommended** for virtually all projects. (API, CLI, Lambda, Frontend, etc.)

The singleton pattern creates exactly 1 `Promise Pool` - as soon as the script is imported (typically on the first run).

This ensures the `maxWorkers` value will act as a **global limit** on the number of tasks that can run at the same time.

#### **File `/services/taskPoolSingleton.ts`**

```typescript
import PromisePool from '@elite-libs/promise-pool';

export const taskPool = new PromisePool({
  maxWorkers: 6, // Optional. Default is `4`.
});
```

<!-- ### Multiple Pools (Factory Pattern)

Here a Factory Function (a fancy name for a _function that makes things_) is used to standardize options for this particular app.

#### **File `/services/taskPoolFactory.ts`**

```typescript
import PromisePool from '@elite-libs/promise-pool';

export function taskPoolFactory() {
  return new PromisePool({
    maxWorkers: 6, // Optional. Default is `4`.
  });
}
``` -->

<!-- Then from inside your app (Lambda function, Express app, etc.), you can use the `taskPool` instance to add tasks to the pool. -->

## Recipes

See examples below, or check out the [`/examples`](/examples/) folder for more complete examples.

### AWS Lambda & Middy

`Promise Pool` in some [`middy`](https://middy.js.org/) middleware:

#### **File 1/2 `./services/taskPoolMiddleware.ts`**

**Note:** The imported `taskPool` is a [singleton instance defined in the `taskPoolSingleton` file](#singleton-pattern).

```typescript
import { taskPool } from './services/taskPoolSingleton';

export const taskPoolMiddleware = () => ({
  before: (request) => {
    Object.assign(request.context, { taskPool });
  },
  after: async (request) => {
    await request.context.taskPool.drain();
  }
});
```

Now you can use `taskPool` in your Lambda function via `event.context.taskPool`:

#### **File 2/2 `./handlers/example.handler.ts`**

```typescript
import middy from '@middy/core';
import { taskPoolMiddleware } from './services/taskPoolMiddleware';

const handleEvent = (event) => {
  const { taskPool } = event.context;

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

export const handler = middy(handleEvent)
  .use(taskPoolMiddleware());

```

<!-- The `.drain()` method will be called automatically `after()` every Lambda function returns. -->

### Express Middleware

#### **File 1/3 `/services/taskPoolSingleton.mjs`**

```js
import PromisePool from '@elite-libs/promise-pool'

export const taskPool = new PromisePool({
  maxWorkers: 6 // Optional. Default is `4`.
})
```

#### **File 2/3 `/middleware/taskPool.middleware.mjs`**

```js
import { taskPool } from "../services/taskPoolSingleton.mjs";

const taskPoolMiddleware = {
  setup: (request, response, next) => {
    request.taskPool = taskPool
    next()
  },
  cleanup: (request, response, next) => {
    if (request.taskPool && 'drain' in request.taskPool) {
      taskPool.drain()
    }
    next()
  }
}

export default taskPoolMiddleware
```

To use the `taskPoolMiddleware` in your Express app, you'd include `taskPoolMiddleware.setup()` and `taskPoolMiddleware.cleanup()`.

#### **File 3/3 `/app.mjs`**

```js
import taskPoolMiddleware from "../middleware/taskPool.middleware.mjs"

export const app = express()

// Step 1/2: Setup the taskPool
app.use(taskPoolMiddleware.setup)
app.use(express.bodyParser())

app.post('/users/', function post(request, response, next) {
    const { taskPool } = request

    const data = getDataFromBody(request.body)

    // You can .add() tasks wherever needed,
    //   - they'll run in the background.
    taskPool.add(() => logMetrics(data))
    taskPool.add(() => saveToS3(request))
    taskPool.add(() => expensiveBackgroundWork(data))
    
    // Or, 'schedule' multiple tasks at once.
    taskPool.add(
      () => logMetrics(data), 
      () => saveToS3(request),
      () => expensiveBackgroundWork(data)
    )

    next()
  })

// Step 2/2: Drain the taskPool
app.use(taskPoolMiddleware.cleanup)
```

<!-- ### Lambda & `Promise Pool` Usage

#### **File `/handlers/user.handler.ts`**

```typescript
import { taskPool } from './services/taskPoolSingleton';

export const handler = async (event, context) => {
  const data = getDataFromEvent(event);

// The following tasks will execute (roughly) at the same time
  taskPool.add(() => logMetrics(data));
  taskPool.add(() => saveToS3(request));
  taskPool.add(() => expensiveBackgroundWork(data));
  
// Calling `await taskPool.drain()` will wait for all tasks to complete.
  await taskPool.drain();

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Success',
    }),
  }
}
```

⚠️ Note the `await taskPool.drain()` call. This is required to ensure your tasks are executed. -->

## Changelog

### v1.3.1 - **April 2023**

- Upgraded dev dependencies (dependabot).
- Cleaned up README code & description.

### v1.3.0 - **September 2022**

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
- _Huh?_ [See diagram](#smart-multi-threaded-execution)
