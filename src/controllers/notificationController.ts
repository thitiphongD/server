import { Context } from 'elysia'
import {
  notificationService,
  CreateSystemNotificationData,
  CreateUserNotificationData
} from '../services/notificationService'
import { sendNotificationToUser } from '../websocket/notification'

export const notificationController = {
  async create(ctx: Context) {
    try {
      const data = ctx.body as any

      if (data.category === 'system') {
        const systemData: CreateSystemNotificationData = {
          title: data.title,
          message: data.message,
          type: data.type,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined
        }

        const notifications = await notificationService.createSystemNotification(systemData)

        // ส่งผ่าน WebSocket ทันทีถ้าไม่มี scheduledAt
        if (!systemData.scheduledAt) {
          const { broadcastSystemNotification } = await import('../websocket/notification')
          broadcastSystemNotification(notifications)
        }

        ctx.set.status = 201
        return { notifications, count: notifications.length }
      } else if (data.category === 'user-to-user') {
        const userData: CreateUserNotificationData = {
          userId: data.userId,
          senderId: data.senderId,
          title: data.title,
          message: data.message,
          type: data.type,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined
        }

        const notification = await notificationService.createUserNotification(userData)

        // ส่งผ่าน WebSocket ทันทีถ้าไม่มี scheduledAt
        if (!userData.scheduledAt) {
          const user = await notificationService.getUserById(userData.userId)
          if (user?.isOnline) {
            sendNotificationToUser(userData.userId, notification)
          }
        }

        ctx.set.status = 201
        return notification
      } else {
        ctx.set.status = 400
        return { error: 'Invalid category. Must be "system" or "user-to-user"' }
      }
    } catch (error) {
      console.error('Error creating notification:', error)
      ctx.set.status = 500
      return { error: 'Failed to create notification' }
    }
  },

  async getByUser(ctx: Context) {
    try {
      const { userId } = ctx.params as { userId: string }

      const notifications = await notificationService.getUnreadNotifications(userId)
      return { notifications }
    } catch (error) {
      console.error('Error getting user notifications:', error)
      ctx.set.status = 500
      return { error: 'Failed to get notifications' }
    }
  },

  async markAsRead(ctx: Context) {
    try {
      const { id } = ctx.params as { id: string }

      const notification = await notificationService.markNotificationAsRead(id)
      return { notification }
    } catch (error) {
      console.error('Error marking notification as read:', error)
      ctx.set.status = 500
      return { error: 'Failed to mark notification as read' }
    }
  },

  async markAllAsRead(ctx: Context) {
    try {
      const { userId } = ctx.params as { userId: string }

      const result = await notificationService.markAllNotificationsAsRead(userId)

      ctx.set.status = 200
      return {
        message: `Marked ${result.count} notifications as read`,
        count: result.count
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      ctx.set.status = 500
      return { error: 'Failed to mark all notifications as read' }
    }
  }
}