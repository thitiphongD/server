import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface CreateSystemNotificationData {
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  scheduledAt?: Date
}

export interface CreateUserNotificationData {
  userId: string
  senderId: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  scheduledAt?: Date
}

export const notificationService = {
  async createSystemNotification(data: CreateSystemNotificationData) {
    const users = await prisma.user.findMany()
    const notifications = []

    for (const user of users) {
      const notification = await prisma.notification.create({
        data: {
          userId: user.id,
          senderId: null,
          title: data.title,
          message: data.message,
          type: data.type,
          category: 'system',
          scheduledAt: data.scheduledAt
        }
      })
      notifications.push(notification)
    }

    return notifications
  },

  async createUserNotification(data: CreateUserNotificationData) {
    return await prisma.notification.create({
      data: {
        userId: data.userId,
        senderId: data.senderId,
        title: data.title,
        message: data.message,
        type: data.type,
        category: 'user-to-user',
        scheduledAt: data.scheduledAt
      }
    })
  },

  async getUnreadNotifications(userId: string) {
    return await prisma.notification.findMany({
      where: {
        userId,
        isRead: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  },

  async markNotificationAsRead(notificationId: string) {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    })
  },

  async markAllNotificationsAsRead(userId: string) {
    return await prisma.notification.updateMany({
      where: {
        userId: userId,
        isRead: false
      },
      data: { isRead: true }
    })
  },

  async getScheduledNotifications() {
    const now = new Date()
    return await prisma.notification.findMany({
      where: {
        scheduledAt: {
          lte: now
        },
        isSent: false
      },
      include: {
        user: true
      }
    })
  },

  async markNotificationAsSent(notificationId: string) {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: { isSent: true }
    })
  },

  async getUsersWithUnreadNotifications() {
    return await prisma.user.findMany({
      where: {
        notifications: {
          some: {
            isRead: false
          }
        }
      },
      include: {
        notifications: {
          where: {
            isRead: false
          }
        }
      }
    })
  },

  async getAllUsers() {
    return await prisma.user.findMany()
  },

  async getUserById(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId }
    })
  }
}