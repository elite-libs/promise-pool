import { taskPool } from '../services/taskPool';
import { taskPoolMiddleware } from '../taskPoolMiddleware';

const handler = async (event, context) => {
  const data = getDataFromEvent(event);
  
  context.taskPool.add(() => saveToS3(data));
  context.taskPool.add(() => expensiveBackgroundWork(data));
  await context.taskPool.drain();

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
  .use(httpErrorHandler())

  