import { Elysia } from 'elysia'
import { notificationRoutes } from './notificationRoutes'
import { cronJobRoutes } from './cronJobRoutes'

export const routes = new Elysia()
  .use(notificationRoutes)
  .use(cronJobRoutes)