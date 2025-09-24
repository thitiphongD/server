import { Elysia } from 'elysia'
import { cronJobController } from '../controllers/cronJobController'

export const cronJobRoutes = new Elysia({ prefix: '/api/cronjobs' })
  .get('/', ({ set }) => cronJobController.getAll({ set, params: {}, body: {} } as any))
  .get('/:id', ({ params, set }) => cronJobController.getById({ params, set, body: {} } as any))
  .post('/', ({ body, set }) => cronJobController.create({ body, set, params: {} } as any))
  .put('/:id', ({ params, body, set }) => cronJobController.update({ params, body, set } as any))
  .delete('/:id', ({ params, set }) => cronJobController.delete({ params, set, body: {} } as any))
  .post('/:id/start', ({ params, set }) => cronJobController.start({ params, set, body: {} } as any))
  .post('/:id/stop', ({ params, set }) => cronJobController.stop({ params, set, body: {} } as any))
  .post('/:id/execute', ({ params, set }) => cronJobController.execute({ params, set, body: {} } as any))