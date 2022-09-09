import { router } from 'express';

export default router()
  .route('/')
  .get((req, res) => {
    
    res.send({message: 'Hello, world!'});
  })
  .post((req, res) => {
    res.send('Hello, world!');
  }