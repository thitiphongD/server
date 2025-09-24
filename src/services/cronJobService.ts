import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface CreateCronJobData {
  name: string
  description?: string
  cronExpression: string
  jobType: 'notification_check' | 'daily_summary' | 'custom'
  jobData?: string
  isActive?: boolean
  createdBy?: string
}

export interface UpdateCronJobData {
  name?: string
  description?: string
  cronExpression?: string
  jobType?: 'notification_check' | 'daily_summary' | 'custom'
  jobData?: string
  isActive?: boolean
}

export const cronJobService = {
  async getAll() {
    return await prisma.cronJob.findMany({
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  },

  async getById(id: string) {
    return await prisma.cronJob.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
  },

  async create(data: CreateCronJobData) {
    return await prisma.cronJob.create({
      data: {
        name: data.name,
        description: data.description,
        cronExpression: data.cronExpression,
        jobType: data.jobType,
        jobData: data.jobData,
        isActive: data.isActive ?? true,
        createdBy: data.createdBy
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
  },

  async update(id: string, data: UpdateCronJobData) {
    return await prisma.cronJob.update({
      where: { id },
      data,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
  },

  async delete(id: string) {
    return await prisma.cronJob.delete({
      where: { id }
    })
  },

  async activate(id: string) {
    return await prisma.cronJob.update({
      where: { id },
      data: { isActive: true }
    })
  },

  async deactivate(id: string) {
    return await prisma.cronJob.update({
      where: { id },
      data: { isActive: false }
    })
  },

  async updateLastRun(id: string, lastRun: Date, nextRun?: Date) {
    return await prisma.cronJob.update({
      where: { id },
      data: {
        lastRun,
        nextRun
      }
    })
  },

  async getActiveCronJobs() {
    return await prisma.cronJob.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' }
    })
  }
}