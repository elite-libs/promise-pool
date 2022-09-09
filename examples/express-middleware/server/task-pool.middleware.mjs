import { taskPool } from "../services/taskPool.mjs";

export const taskPoolMiddleware = {
  taskPool,
  addToRequest(req, res, next) {
    req.taskPool = taskPool;
    next();
  },
  drainPool(req, res, next) {
    req.taskPool.drain()
      .then(() => next())
      .catch(next);
  },
  /**
   * Awaits `taskPool.done()` before calling `next()`.
   */
  finishPool(req, res, next) {
    req.taskPool.done()
      .then(() => next())
      .catch(next);
  },
};

/** 
 * Use whenever you are done processing, or at the end
 * of your pipeline/middleware.
 */
export const taskPoolDoneMiddleware = (req, res, next) => {
  req.taskPool
    .done()
    .then(() => next())
    .catch(next);
};
