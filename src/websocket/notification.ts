import { PrismaClient } from '@prisma/client'
import { notificationService } from '../services/notificationService'

const prisma = new PrismaClient()

interface WebSocketConnection {
  send: (message: string) => void
  close: () => void
}

export const userConnections = new Map<string, WebSocketConnection>()

export interface WebSocketMessage {
  type: 'register' | 'markAsRead'
  userId?: string
  notificationId?: string
}

export const handleWebSocketMessage = async (ws: WebSocketConnection, message: string) => {
  console.log('📨 WebSocket message received:', message)
  try {
    // Handle both string and object messages
    let data: WebSocketMessage

    if (typeof message === 'string') {
      try {
        data = JSON.parse(message)
      } catch (parseError) {
        console.error('Invalid JSON message:', message)
        return
      }
    } else {
      data = message as any
    }

    // Validate message structure
    if (!data || typeof data !== 'object' || !data.type) {
      console.error('Invalid message format:', data)
      return
    }

    switch (data.type) {
      case 'register':
        if (data.userId) {
          await handleUserRegister(ws, data.userId)
        } else {
          console.error('Register message missing userId:', data)
        }
        break

      case 'markAsRead':
        if (data.notificationId) {
          await handleMarkAsRead(data.notificationId)
        } else {
          console.error('MarkAsRead message missing notificationId:', data)
        }
        break

      default:
        console.warn('Unknown message type:', data.type)
    }
  } catch (error) {
    console.error('WebSocket message error:', error)
    console.error('Raw message:', message)
  }
}

export const handleUserRegister = async (ws: WebSocketConnection, userId: string) => {
  console.log(`👤 User registering WebSocket: ${userId}`)
  userConnections.set(userId, ws)
  console.log(`✅ WebSocket registered for user: ${userId}`)

  await prisma.user.upsert({
    where: { id: userId },
    update: { isOnline: true },
    create: {
      id: userId,
      email: `user-${userId}@example.com`,
      password: 'default123',
      role: 'user',
      isOnline: true
    }
  })

  const unreadNotifications = await notificationService.getUnreadNotifications(userId)

  for (const notification of unreadNotifications) {
    sendNotificationToUser(userId, notification)
  }
}

export const handleUserDisconnect = async (userId: string) => {
  userConnections.delete(userId)

  await prisma.user.update({
    where: { id: userId },
    data: { isOnline: false }
  }).catch(() => {})
}

export const handleMarkAsRead = async (notificationId: string) => {
  await notificationService.markNotificationAsRead(notificationId)
}

export const sendNotificationToUser = (userId: string, notification: any) => {
  const connection = userConnections.get(userId)

  if (connection) {
    const message = {
      type: 'notification',
      data: {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt
      }
    }

    connection.send(JSON.stringify(message))
  }
}

export const broadcastSystemNotification = (notifications: any[]) => {
  for (const notification of notifications) {
    sendNotificationToUser(notification.userId, notification)
  }
}

export const sendCronJobStatusToAdmins = async (cronJobId: string, status: 'started' | 'stopped' | 'executed' | 'failed', message: string) => {
  const adminUsers = await prisma.user.findMany({
    where: { role: 'admin' }
  })

  const statusMessage = {
    type: 'cronjob_status',
    data: {
      cronJobId,
      status,
      message,
      timestamp: new Date().toISOString()
    }
  }

  for (const admin of adminUsers) {
    const connection = userConnections.get(admin.id)
    if (connection) {
      connection.send(JSON.stringify(statusMessage))
    }
  }
}

export const findUserIdByConnection = (targetWs: WebSocketConnection): string | null => {
  for (const [userId, ws] of userConnections.entries()) {
    if (ws === targetWs) {
      return userId
    }
  }
  return null
}