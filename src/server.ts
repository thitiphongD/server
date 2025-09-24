import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { routes } from './routes'
import {
  handleWebSocketMessage,
  handleUserDisconnect,
  findUserIdByConnection
} from './websocket/notification'
import { cronJobManager } from './jobs/cronJobManager'
import { swagger } from '@elysiajs/swagger'

const PORT = process.env.PORT || 3001
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'

const app = new Elysia()
  .use(swagger({
    documentation: {
      info: {
        title: 'Notification System API',
        version: '1.0.0',
        description: 'Real-time notification system with WebSocket and CronJob management'
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
          description: 'Development server'
        }
      ],
      tags: [
        {
          name: 'notifications',
          description: 'Notification management endpoints'
        },
        {
          name: 'cronjobs',
          description: 'CronJob management endpoints'
        }
      ]
    }
  }))
  .use(cors({
    origin: CLIENT_URL,
    credentials: true
  }))
  .get('/', () => ({
    message: '🚀 Notification System API',
    status: 'ระบบพร้อมใช้งาน!',
    emoji: '🔔✨',
    endpoints: {
      ping: '/ping',
      notifications: '/api/notifications',
      cronjobs: '/api/cronjobs',
      websocket: '/ws',
      docs: '/swagger'
    },
    users: {
      description: 'Select user for dashboard testing',
      available: [
        { id: 'user1', name: 'Alice Johnson', role: 'admin', email: 'alice@example.com' },
        { id: 'user2', name: 'Bob Smith', role: 'user', email: 'bob@example.com' },
        { id: 'user3', name: 'Charlie Brown', role: 'user', email: 'charlie@example.com' }
      ]
    },
    testing: {
      websocket_connect: 'ws://localhost:3001/ws',
      sample_register: '{"type": "register", "userId": "user1"}',
      sample_notification: 'curl -X POST http://localhost:3001/api/notifications -H "Content-Type: application/json" -d \'{"title": "Test", "message": "Hello", "type": "info", "category": "system"}\''
    },
    fun_fact: 'Server นี้ใช้ Bun + Elysia เร็วมากกก! ⚡️'
  }))
  .get('/ping', () => 'pong')
  .use(routes)
  .ws('/ws', {
    message(ws, message) {
      handleWebSocketMessage(ws, message as string)
    },
    close(ws) {
      const userId = findUserIdByConnection(ws)
      if (userId) {
        handleUserDisconnect(userId)
      }
    }
  })
  .listen(PORT)

// Initialize dynamic cron job manager
cronJobManager.loadCronJobs()

console.log(`🚀 Notification Server running on port ${PORT}`)
console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`)
console.log(`🌐 API endpoints:`)
console.log(`   📝 Notifications: http://localhost:${PORT}/api/notifications`)
console.log(`   ⏰ CronJobs: http://localhost:${PORT}/api/cronjobs`)
console.log(`🔗 CORS enabled for: ${CLIENT_URL}`)

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...')
  cronJobManager.stopAllJobs()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...')
  cronJobManager.stopAllJobs()
  process.exit(0)
})