import PromisePool from '@elite-libs/promise-pool';

export const taskPool = new PromisePool({
  maxWorkers: 6, // Optional. Default is `4`.
});
