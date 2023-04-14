import middy from '@middy/core';
import { taskPoolMiddleware } from '../taskPoolMiddleware';

const handler = async (event, context) => {
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

export default middy(handler)
  .use(jsonBodyParser())
  .use(taskPoolMiddleware())
  .onError(httpErrorHandler())
