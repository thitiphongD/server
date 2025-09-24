import * as cron from 'node-cron'
import { cronJobService } from '../services/cronJobService'
import { notificationService } from '../services/notificationService'
import { sendNotificationToUser } from '../websocket/notification'

interface CronJobInstance {
  id: string
  name: string
  task: cron.ScheduledTask
  jobType: string
}

class CronJobManager {
  private readonly jobs: Map<string, CronJobInstance> = new Map()

  async loadCronJobs() {
    console.log('🔄 Loading active cron jobs from database...')

    try {
      const activeCronJobs = await cronJobService.getActiveCronJobs()

      for (const cronJob of activeCronJobs) {
        await this.addCronJob(cronJob)
      }

      console.log(`✅ Loaded ${activeCronJobs.length} active cron jobs`)
    } catch (error) {
      console.error('❌ Error loading cron jobs:', error)
    }
  }

  async addCronJob(cronJob: any) {
    try {
      // Remove existing job if it exists
      if (this.jobs.has(cronJob.id)) {
        this.removeCronJob(cronJob.id)
      }

      // Check if this is a one-time job that has already passed
      if (this.isOneTimeJobExpired(cronJob.cronExpression)) {
        console.log(`⏰ One-time job ${cronJob.name} already passed, executing immediately`)
        await this.executeJob(cronJob.jobType, cronJob.jobData)

        // Mark as inactive since it ran
        await cronJobService.update(cronJob.id, { isActive: false })
        return
      }

      const task = cron.schedule(cronJob.cronExpression, async () => {
        console.log(`⏰ Executing cron job: ${cronJob.name} (${cronJob.jobType})`)

        const startTime = new Date()

        try {
          await this.executeJob(cronJob.jobType, cronJob.jobData)

          // Calculate next run time
          const nextRun = this.getNextRunTime()

          // Update last run time
          await cronJobService.updateLastRun(cronJob.id, startTime, nextRun)

          console.log(`✅ Cron job completed: ${cronJob.name}`)

          // If this is a one-time job, deactivate it
          if (this.isOneTimeJob(cronJob.cronExpression)) {
            await cronJobService.update(cronJob.id, { isActive: false })
            this.removeCronJob(cronJob.id)
            console.log(`🏁 One-time job ${cronJob.name} completed and deactivated`)
          }
        } catch (error) {
          console.error(`❌ Cron job failed: ${cronJob.name}`, error)
        }
      })

      // Start the task
      task.start()

      this.jobs.set(cronJob.id, {
        id: cronJob.id,
        name: cronJob.name,
        task,
        jobType: cronJob.jobType
      })

      console.log(`✅ Added cron job: ${cronJob.name} (${cronJob.cronExpression})`)
    } catch (error) {
      console.error(`❌ Error adding cron job ${cronJob.name}:`, error)
    }
  }

  private isOneTimeJob(cronExpression: string): boolean {
    // Check if cron expression has specific day/month (not wildcards)
    const parts = cronExpression.split(' ')
    if (parts.length === 5) {
      const [min, hour, day, month, dayOfWeek] = parts
      return (day !== '*' && month !== '*') || (day !== '*' && dayOfWeek !== '*')
    }
    return false
  }

  private isOneTimeJobExpired(cronExpression: string): boolean {
    if (!this.isOneTimeJob(cronExpression)) return false

    try {
      const parts = cronExpression.split(' ')
      const [min, hour, day, month, dayOfWeek] = parts

      if (day !== '*' && month !== '*') {
        const now = new Date()
        // Use UTC for comparison since cron expressions are in UTC
        const targetDate = new Date(Date.UTC(now.getUTCFullYear(), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min)))

        console.log(`🕐 Checking expiry: Now UTC=${now.toISOString()}, Target UTC=${targetDate.toISOString()}`)
        return targetDate < now
      }
    } catch (error) {
      console.error('Error checking if one-time job expired:', error)
    }

    return false
  }

  removeCronJob(id: string) {
    const jobInstance = this.jobs.get(id)
    if (jobInstance) {
      jobInstance.task.stop()
      jobInstance.task.destroy()
      this.jobs.delete(id)
      console.log(`🗑️ Removed cron job: ${jobInstance.name}`)
    }
  }

  async updateCronJob(id: string, updatedCronJob: any) {
    // Remove old job
    this.removeCronJob(id)

    // Add updated job if it's active
    if (updatedCronJob.isActive) {
      await this.addCronJob(updatedCronJob)
    }
  }

  async executeJob(jobType: string, jobData?: string) {
    switch (jobType) {
      case 'notification_check':
        await this.executeNotificationCheck(jobData)
        break
      case 'daily_summary':
        await this.executeDailySummary()
        break
      case 'custom':
        await this.executeCustomJob(jobData)
        break
      default:
        console.warn(`Unknown job type: ${jobType}`)
    }
  }

  // Public method for direct execution (from API)
  async executeJobDirect(jobType: string, jobData?: string) {
    console.log(`🚀 Direct execution of job type: ${jobType}`)
    await this.executeJob(jobType, jobData)
  }

  private async executeNotificationCheck(jobData?: string) {
    try {
      // Handle scheduled notifications
      const scheduledNotifications = await notificationService.getScheduledNotifications()

      for (const notification of scheduledNotifications) {
        if (notification.user.isOnline) {
          sendNotificationToUser(notification.userId, notification)
        }

        await notificationService.markNotificationAsSent(notification.id)
      }

      if (scheduledNotifications.length > 0) {
        console.log(`✅ Sent ${scheduledNotifications.length} scheduled notifications`)
      }

      // Handle custom notification from jobData
      if (jobData) {
        try {
          const data = JSON.parse(jobData)
          if (data.title && data.message) {
            const notifications = await notificationService.createSystemNotification({
              title: data.title,
              message: data.message,
              type: data.type || 'info'
            })

            // Broadcast to all users via WebSocket
            const { broadcastSystemNotification } = await import('../websocket/notification')
            broadcastSystemNotification(notifications)

            console.log(`✅ Created notification from CronJob: ${data.title}`)
          }
        } catch (parseError) {
          console.error('❌ Error parsing notification jobData:', parseError)
        }
      }
    } catch (error) {
      console.error('❌ Error in notification check job:', error)
    }
  }

  private async executeDailySummary() {
    try {
      const usersWithUnread = await notificationService.getUsersWithUnreadNotifications()

      for (const user of usersWithUnread) {
        const unreadCount = user.notifications.length

        const summaryNotification = await notificationService.createUserNotification({
          userId: user.id,
          senderId: 'system',
          title: 'สรุปการแจ้งเตือนรายวัน',
          message: `คุณมีการแจ้งเตือนที่ยังไม่ได้อ่าน ${unreadCount} รายการ`,
          type: 'info'
        })

        if (user.isOnline) {
          sendNotificationToUser(user.id, summaryNotification)
        }
      }

      if (usersWithUnread.length > 0) {
        console.log(`✅ Sent daily summary to ${usersWithUnread.length} users`)
      }
    } catch (error) {
      console.error('❌ Error in daily summary job:', error)
    }
  }

  private async executeCustomJob(jobData?: string) {
    try {
      if (!jobData) {
        console.log('Custom job executed with no data')
        return
      }

      const data = JSON.parse(jobData)
      console.log('Executing custom job with data:', data)

      // Add custom job logic here based on data
      // For example, send custom notifications, cleanup tasks, etc.

    } catch (error) {
      console.error('❌ Error in custom job:', error)
    }
  }

  private getNextRunTime(): Date {
    // Simple next run calculation - in production, use a proper cron parser
    const now = new Date()
    return new Date(now.getTime() + 60 * 1000) // Default to 1 minute from now
  }

  getActiveJobs() {
    return Array.from(this.jobs.values()).map(job => ({
      id: job.id,
      name: job.name,
      jobType: job.jobType,
      isRunning: true
    }))
  }

  stopAllJobs() {
    console.log('🛑 Stopping all cron jobs...')
    for (const [id, _] of this.jobs) {
      this.removeCronJob(id)
    }
  }
}

export const cronJobManager = new CronJobManager()