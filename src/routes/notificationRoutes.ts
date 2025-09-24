import { Elysia } from 'elysia'
import { notificationController } from '../controllers/notificationController'

export const notificationRoutes = new Elysia({ prefix: '/api/notifications' })
  .post('/', ({ body, set }) => notificationController.create({ body, set, params: {} } as any))
  .get('/:userId', ({ params, set }) => notificationController.getByUser({ params, set, body: {} } as any))
  .put('/:id/read', ({ params, set }) => notificationController.markAsRead({ params, set, body: {} } as any))
  .post('/mark-all-read/:userId', ({ params, set }) => notificationController.markAllAsRead({ params, set, body: {} } as any))