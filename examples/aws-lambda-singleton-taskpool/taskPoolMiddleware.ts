// Important: Import the shared global instance of `Promise Pool`
import { taskPool } from './services/taskPool';

export const taskPoolMiddleware = () => ({
  before: (request) => {
    Object.assign(request.context, { taskPool });
  },
  after: async (request) => {
    await request.context.taskPool.drain();
  }
});
