import { taskPool } from '../services/taskPool.mjs';
import app from './app.mjs';

const port = process.env.PORT || 3000;

export const server = app()
  .listen(port, () => {
    console.log(`Listening at http://0.0.0.0:${port}`);
  })
  .on('error', (err) => {
    console.error(err);
  });

process.on('SIGINT', () => {
  taskPool
    .done()
    .then(() => {
      server.close();
      process.exit(0);
    })
    .catch(console.error);
})

