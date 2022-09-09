# Scratchpad

## Smart Drain Ideas

- Get visibility into:
  - `workPool`: only has pending promises, which turn into bools for each settled task.
  - `taskList`: either promise, or object with `resolved` or `rejected` status.

```typescript
taskList.reduce((summary, task) => {
  if (task instanceof Promise) {
    summary.pending++;
  } else if (task.status === 'resolved') {
    summary.resolved++;
  } else if (task.status === 'rejected') {
    summary.rejected++;
  }
  return summary;
}, {pending: 0, resolved: 0, rejected: 0, taskListLength: taskList.length});

return this.workPool.reduce((summary, task) => {
  if (task instanceof Promise) {
    summary.pending++;
  } else if (task === true || task === false) {
    summary[task ? 'succeeded' : 'failed']++;
  }
  return summary;
}, {pending: 0, succeeded: 0, failed: 0, workPoolLength: this.workPool.length});

```

=========================

1. Convert to pull / subscriber model. Using generators.

```typescript


```

1. Track all `.drain()` coordination promises, shouldn't see all these waiting:

```text
  console.dir
    [
      {
        promise: Promise {
          <pending>,
          [Symbol(async_id_symbol)]: 86194,
          [Symbol(trigger_async_id_symbol)]: 86150 // 👈🏻 NOTE: FIRST 2 CALLS ARE SAME ID
        },
        resolve: [Function (anonymous)],
        reject: [Function (anonymous)]
      },
      {
        promise: Promise {
          <pending>,
          [Symbol(async_id_symbol)]: 86206,
          [Symbol(trigger_async_id_symbol)]: 86150 // 👈🏻 NOTE: FIRST 2 CALLS ARE SAME ID
        },
        resolve: [Function (anonymous)],
        reject: [Function (anonymous)]
      },
      {
        promise: Promise {
          <pending>,
          [Symbol(async_id_symbol)]: 86233,
          [Symbol(trigger_async_id_symbol)]: 86231
        },
        resolve: [Function (anonymous)],
        reject: [Function (anonymous)]
      }
    ] { depth: 10 }

      at Object.<anonymous> (src/index.test.ts:30:7)
```
