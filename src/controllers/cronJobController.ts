import { Context } from 'elysia'
import { cronJobService, CreateCronJobData, UpdateCronJobData } from '../services/cronJobService'
import { cronJobManager } from '../jobs/cronJobManager'
import { sendCronJobStatusToAdmins } from '../websocket/notification'

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
      await cronJobManager.removeCronJob(id)

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
      await cronJobManager.removeCronJob(id)

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
      await cronJobManager.executeJobDirect(cronJob.jobType, cronJob.jobData)

      return { message: `Cron job "${cronJob.name}" executed successfully` }
    } catch (error) {
      console.error('Error executing cron job:', error)
      ctx.set.status = 500
      return { error: 'Failed to execute cron job' }
    }
  }
}