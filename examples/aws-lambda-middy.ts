import PromisePool, { PoolConfig } from '../'

const defaults = {};

const promisePoolMiddleware = (opts: Partial<PoolConfig> = {}) => {
  const options = { ...defaults, ...opts }

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

export default promisePoolMiddleware
