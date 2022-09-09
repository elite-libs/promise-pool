import express from 'express';
import { taskPoolMiddleware } from './task-pool.middleware.mjs';

export default function app() {
  return express()
  .use(express.json())
  .use(express.urlencoded({ extended: true }))
  .use(taskPoolMiddleware.addToRequest)
  .use(taskPoolMiddleware.drainPool);
}