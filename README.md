# Promise Pool

A background task processor built with several key features for reliability and scalability.

## Features

- [ ] Configurable.
- [x] Concurrency limit.
- [ ] Retries.
- [ ] Progress.
- [ ] Error handling.
- [ ] Task scheduling & prioritization.
  - [ ] optional `return` hints. (To support API's like GitHub which return rate limit hints in http headers, e.g. `X-RateLimit-Remaining` header.)

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
