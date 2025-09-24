import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed process...')

  // สร้าง test users
  const user1 = await prisma.user.create({
    data: {
      id: 'user1',
      email: 'alice@example.com',
      name: 'Alice Johnson',
      password: 'password123',
      role: 'admin',
      isOnline: false
    }
  })

  const user2 = await prisma.user.create({
    data: {
      id: 'user2',
      email: 'bob@example.com',
      name: 'Bob Smith',
      password: 'password456',
      role: 'user',
      isOnline: true
    }
  })

  const user3 = await prisma.user.create({
    data: {
      id: 'user3',
      email: 'charlie@example.com',
      name: 'Charlie Brown',
      password: 'password789',
      role: 'user',
      isOnline: false
    }
  })

  console.log('✅ Created 3 test users')

  // System Notifications (ส่งให้ทุกคน)
  const systemMessages = [
    {
      title: 'ยินดีต้อนรับ!',
      message: 'ขอบคุณที่เข้าร่วมกับเรา เราหวังว่าคุณจะมีประสบการณ์ที่ดี',
      type: 'success'
    },
    {
      title: 'การบำรุงรักษาระบบ',
      message: 'ระบบจะมีการบำรุงรักษาในวันอาทิตย์ที่ 25 ก.ย. เวลา 02:00-04:00 น.',
      type: 'warning'
    },
    {
      title: 'อัปเดตความปลอดภัย',
      message: 'เราได้อัปเดตระบบความปลอดภัยเพื่อปกป้องข้อมูลของคุณให้ดียิ่งขึ้น',
      type: 'info'
    }
  ]

  // สร้าง system notifications สำหรับทุกคน
  for (const msg of systemMessages) {
    for (const user of [user1, user2, user3]) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          senderId: null,
          title: msg.title,
          message: msg.message,
          type: msg.type as any,
          category: 'system',
          isRead: Math.random() > 0.5 // random read status
        }
      })
    }
  }

  // เพิ่ม scheduled system notification
  for (const user of [user1, user2, user3]) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        senderId: null,
        title: 'การแจ้งเตือนที่กำหนดเวลา',
        message: 'นี่คือการแจ้งเตือนที่กำหนดเวลาไว้',
        type: 'info',
        category: 'system',
        isRead: false,
        isSent: false,
        scheduledAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
      }
    })
  }

  console.log('✅ Created system notifications for all users')

  // User-to-User Notifications
  const userNotifications = [
    {
      userId: user1.id,
      senderId: user2.id,
      title: 'ข้อความใหม่',
      message: 'สวัสดี Alice! คุณอยากไปทานข้าวเย็นด้วยกันไหม?',
      type: 'info',
      category: 'user-to-user',
      isRead: false
    },
    {
      userId: user2.id,
      senderId: user3.id,
      title: 'คำขอเป็นเพื่อน',
      message: 'Charlie ส่งคำขอเป็นเพื่อนให้คุณ',
      type: 'info',
      category: 'user-to-user',
      isRead: true
    },
    {
      userId: user3.id,
      senderId: user1.id,
      title: 'การกล่าวถึง',
      message: 'Alice ได้กล่าวถึงคุณในโพสต์: "ขอบคุณ @Charlie สำหรับความช่วยเหลือ!"',
      type: 'info',
      category: 'user-to-user',
      isRead: false
    },
    {
      userId: user1.id,
      senderId: user3.id,
      title: 'กิจกรรมใหม่',
      message: 'Charlie ได้แชร์รูปภาพใหม่และต้องการความคิดเห็นของคุณ',
      type: 'success',
      category: 'user-to-user',
      isRead: false
    },
    {
      userId: user2.id,
      senderId: user1.id,
      title: 'ข้อความสำคัญ',
      message: 'Bob, อย่าลืมประชุมวันพรุ่งนี้เวลา 14:00 น. นะ!',
      type: 'warning',
      category: 'user-to-user',
      isRead: false,
      scheduledAt: new Date(Date.now() + 2 * 60 * 1000) // 2 minutes from now
    }
  ]

  for (const notification of userNotifications) {
    await prisma.notification.create({ data: notification })
  }

  console.log('✅ Created 5 user-to-user notifications')

  // สร้าง default cron jobs
  const defaultCronJobs = [
    {
      name: 'notification_check',
      description: 'Check and send scheduled notifications every minute',
      cronExpression: '* * * * *', // every minute
      jobType: 'notification_check',
      isActive: true,
      createdBy: user1.id // admin user
    },
    {
      name: 'daily_summary',
      description: 'Send daily summary at 9:00 AM',
      cronExpression: '0 9 * * *', // daily at 9 AM
      jobType: 'daily_summary',
      isActive: true,
      createdBy: user1.id // admin user
    },
    {
      name: 'weekly_cleanup',
      description: 'Weekly cleanup of read notifications (inactive by default)',
      cronExpression: '0 2 * * 0', // every Sunday at 2 AM
      jobType: 'custom',
      jobData: JSON.stringify({ action: 'cleanup', type: 'read_notifications', olderThan: '7days' }),
      isActive: false,
      createdBy: user1.id // admin user
    }
  ]

  for (const cronJob of defaultCronJobs) {
    await prisma.cronJob.create({ data: cronJob })
  }

  console.log('✅ Created 3 default cron jobs')

  // สร้างสถิติ
  const totalUsers = await prisma.user.count()
  const totalNotifications = await prisma.notification.count()
  const systemNotiCount = await prisma.notification.count({
    where: { category: 'system' }
  })
  const userNotiCount = await prisma.notification.count({
    where: { category: 'user-to-user' }
  })
  const unreadCount = await prisma.notification.count({
    where: { isRead: false }
  })
  const totalCronJobs = await prisma.cronJob.count()
  const activeCronJobs = await prisma.cronJob.count({
    where: { isActive: true }
  })

  console.log('\n📊 Seed Summary:')
  console.log(`   👥 Users: ${totalUsers}`)
  console.log(`   👑 Admin Users: 1 (Alice)`)
  console.log(`   👤 Regular Users: 2 (Bob, Charlie)`)
  console.log(`   🔔 Total Notifications: ${totalNotifications}`)
  console.log(`   🏢 System Notifications: ${systemNotiCount}`)
  console.log(`   👤 User-to-User: ${userNotiCount}`)
  console.log(`   📬 Unread: ${unreadCount}`)
  console.log(`   ⏰ Total Cron Jobs: ${totalCronJobs}`)
  console.log(`   ✅ Active Cron Jobs: ${activeCronJobs}`)
  console.log('\n🔐 Test Credentials:')
  console.log('   Admin: alice@example.com / password123')
  console.log('   User:  bob@example.com / password456')
  console.log('   User:  charlie@example.com / password789')
  console.log('\n⏰ Default Cron Jobs:')
  console.log('   📝 notification_check: Every minute (active)')
  console.log('   📋 daily_summary: Daily at 9:00 AM (active)')
  console.log('   🧹 weekly_cleanup: Weekly on Sunday 2:00 AM (inactive)')
  console.log('\n🎉 Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })