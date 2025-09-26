import { Context } from 'elysia'
import { cronJobService, CreateCronJobData, UpdateCronJobData } from '../services/cronJobService'
import { cronJobManager } from '../jobs/cronJobManager'
import { sendCronJobStatusToAdmins } from '../websocket/notification'

// Validation functions
function validateCronExpression(expression: string): string | null {
  const cronRegex = /^(\*|([0-5]?\d)|\*\/([0-5]?\d)|([0-5]?\d)-([0-5]?\d)|([0-5]?\d),([0-5]?\d))\s+(\*|([01]?\d|2[0-3])|\*\/([01]?\d|2[0-3])|([01]?\d|2[0-3])-([01]?\d|2[0-3])|([01]?\d|2[0-3]),([01]?\d|2[0-3]))\s+(\*|([12]?\d|3[01])|\*\/([12]?\d|3[01])|([12]?\d|3[01])-([12]?\d|3[01])|([12]?\d|3[01]),([12]?\d|3[01]))\s+(\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])|([1-9]|1[0-2])-([1-9]|1[0-2])|([1-9]|1[0-2]),([1-9]|1[0-2]))\s+(\*|[0-6]|\*\/[0-6]|[0-6]-[0-6]|[0-6],[0-6])$/

  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) {
    return 'Cron expression must have exactly 5 parts (minute hour day month weekday)'
  }

  if (!cronRegex.test(expression)) {
    return 'Invalid cron expression format'
  }

  return null
}

function validateNotificationJobData(jobData: string): string | null {
  try {
    const data = JSON.parse(jobData)

    // For notification_check jobs, require title and message
    if (!data.title || typeof data.title !== 'string') {
      return 'jobData must contain "title" field (string) for notification_check jobs'
    }

    if (!data.message || typeof data.message !== 'string') {
      return 'jobData must contain "message" field (string) for notification_check jobs'
    }

    // Validate type if provided
    if (data.type && !['info', 'warning', 'success', 'error'].includes(data.type)) {
      return 'jobData "type" must be one of: info, warning, success, error'
    }

    return null
  } catch (error) {
    console.error('JobData validation error:', error)
    return 'jobData must be valid JSON format'
  }
}

export const cronJobController = {
  async getAll(ctx: Context) {
    try {
      const cronJobs = await cronJobService.getAll()
      return { cronJobs }
    } catch (error) {
      console.error('Error getting cron jobs:', error)
      ctx.set.status = 500
      return { error: 'Failed to get cron jobs' }
    }
  },

  async getById(ctx: Context) {
    try {
      const { id } = ctx.params as { id: string }

      const cronJob = await cronJobService.getById(id)
      if (!cronJob) {
        ctx.set.status = 404
        return { error: 'Cron job not found' }
      }

      return { cronJob }
    } catch (error) {
      console.error('Error getting cron job:', error)
      ctx.set.status = 500
      return { error: 'Failed to get cron job' }
    }
  },

  async create(ctx: Context) {
    try {
      const data = ctx.body as CreateCronJobData

      // Validate required fields
      if (!data.name || !data.cronExpression || !data.jobType) {
        ctx.set.status = 400
        return { error: 'Missing required fields: name, cronExpression, jobType' }
      }

      // Validate cron expression format
      const cronError = validateCronExpression(data.cronExpression)
      if (cronError) {
        ctx.set.status = 400
        return { error: `Invalid cron expression: ${cronError}` }
      }

      // Validate jobData for notification_check jobs
      if (data.jobType === 'notification_check' && data.jobData) {
        const jobDataError = validateNotificationJobData(data.jobData)
        if (jobDataError) {
          ctx.set.status = 400
          return { error: `Invalid jobData: ${jobDataError}` }
        }
      }

      const cronJob = await cronJobService.create(data)

      // Add to cron job manager if active
      if (cronJob.isActive) {
        await cronJobManager.addCronJob(cronJob)
      }

      // Send WebSocket status to admin users
      await sendCronJobStatusToAdmins(cronJob.id, 'started', `Cron job "${cronJob.name}" created and ${cronJob.isActive ? 'started' : 'created as inactive'}`)

      ctx.set.status = 201
      return { cronJob }
    } catch (error) {
      console.error('Error creating cron job:', error)
      ctx.set.status = 500
      return { error: 'Failed to create cron job' }
    }
  },

  async update(ctx: Context) {
    try {
      const { id } = ctx.params as { id: string }
      const data = ctx.body as UpdateCronJobData

      const existingCronJob = await cronJobService.getById(id)
      if (!existingCronJob) {
        ctx.set.status = 404
        return { error: 'Cron job not found' }
      }

      // Validate cron expression if provided
      if (data.cronExpression) {
        const cronError = validateCronExpression(data.cronExpression)
        if (cronError) {
          ctx.set.status = 400
          return { error: `Invalid cron expression: ${cronError}` }
        }
      }

      // Validate jobData for notification_check jobs if provided
      if (data.jobData && (data.jobType === 'notification_check' || existingCronJob.jobType === 'notification_check')) {
        const jobDataError = validateNotificationJobData(data.jobData)
        if (jobDataError) {
          ctx.set.status = 400
          return { error: `Invalid jobData: ${jobDataError}` }
        }
      }

      const cronJob = await cronJobService.update(id, data)

      // Update in cron job manager
      await cronJobManager.updateCronJob(id, cronJob)

      return { cronJob }
    } catch (error) {
      console.error('Error updating cron job:', error)
      ctx.set.status = 500
      return { error: 'Failed to update cron job' }
    }
  },

  async delete(ctx: Context) {
    try {
      const { id } = ctx.params as { id: string }

      const existingCronJob = await cronJobService.getById(id)
      if (!existingCronJob) {
        ctx.set.status = 404
        return { error: 'Cron job not found' }
      }

      // Remove from cron job manager first
      cronJobManager.removeCronJob(id)

      // Then delete from database
      await cronJobService.delete(id)

      return { message: 'Cron job deleted successfully' }
    } catch (error) {
      console.error('Error deleting cron job:', error)
      ctx.set.status = 500
      return { error: 'Failed to delete cron job' }
    }
  },

  async start(ctx: Context) {
    try {
      const { id } = ctx.params as { id: string }

      const cronJob = await cronJobService.activate(id)
      if (!cronJob) {
        ctx.set.status = 404
        return { error: 'Cron job not found' }
      }

      // Add to cron job manager
      await cronJobManager.addCronJob(cronJob)

      // Send WebSocket status to admin users
      await sendCronJobStatusToAdmins(cronJob.id, 'started', `Cron job "${cronJob.name}" started successfully`)

      return { cronJob, message: 'Cron job started successfully' }
    } catch (error) {
      console.error('Error starting cron job:', error)
      ctx.set.status = 500
      return { error: 'Failed to start cron job' }
    }
  },

  async stop(ctx: Context) {
    try {
      const { id } = ctx.params as { id: string }

      const cronJob = await cronJobService.deactivate(id)
      if (!cronJob) {
        ctx.set.status = 404
        return { error: 'Cron job not found' }
      }

      // Remove from cron job manager
      cronJobManager.removeCronJob(id)

      // Send WebSocket status to admin users
      await sendCronJobStatusToAdmins(cronJob.id, 'stopped', `Cron job "${cronJob.name}" stopped successfully`)

      return { cronJob, message: 'Cron job stopped successfully' }
    } catch (error) {
      console.error('Error stopping cron job:', error)
      ctx.set.status = 500
      return { error: 'Failed to stop cron job' }
    }
  },

  async execute(ctx: Context) {
    try {
      const { id } = ctx.params as { id: string }

      const cronJob = await cronJobService.getById(id)
      if (!cronJob) {
        ctx.set.status = 404
        return { error: 'Cron job not found' }
      }

      // Execute the job immediately
      await cronJobManager.executeJobDirect(cronJob.jobType, cronJob.jobData || undefined)

      return { message: `Cron job "${cronJob.name}" executed successfully` }
    } catch (error) {
      console.error('Error executing cron job:', error)
      ctx.set.status = 500
      return { error: 'Failed to execute cron job' }
    }
  },

  async getActiveInMemory(ctx: Context) {
    try {
      const activeJobs = cronJobManager.getActiveJobs()
      return { activeJobsInMemory: activeJobs }
    } catch (error) {
      console.error('Error getting active jobs in memory:', error)
      ctx.set.status = 500
      return { error: 'Failed to get active jobs in memory' }
    }
  }
}