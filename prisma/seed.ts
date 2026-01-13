import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user (or use for local testing)
  const passwordHash = await bcrypt.hash('franklin123', 12);
  
  const user = await prisma.user.upsert({
    where: { email: 'ben@example.com' },
    update: {},
    create: {
      email: 'ben@example.com',
      passwordHash,
      name: 'Ben',
      timezone: 'America/New_York',
      settings: {
        dailyReviewTime: '21:00',
        weekStartsOn: 1, // Monday
        enableNotifications: true,
      },
    },
  });

  console.log(`✅ Created user: ${user.email}`);

  // Create categories based on PRD discussion
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: 'Morning Routine' } },
      update: {},
      create: {
        userId: user.id,
        name: 'Morning Routine',
        color: '#f59e0b', // Amber
        sortOrder: 0,
      },
    }),
    prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: 'Learning' } },
      update: {},
      create: {
        userId: user.id,
        name: 'Learning',
        color: '#3b82f6', // Blue
        weeklyGoalHours: 10,
        sortOrder: 1,
      },
    }),
    prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: 'Exercise' } },
      update: {},
      create: {
        userId: user.id,
        name: 'Exercise',
        color: '#10b981', // Green
        weeklyGoalHours: 5,
        sortOrder: 2,
      },
    }),
    prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: 'Deep Work' } },
      update: {},
      create: {
        userId: user.id,
        name: 'Deep Work',
        color: '#8b5cf6', // Purple
        weeklyGoalHours: 20,
        sortOrder: 3,
      },
    }),
    prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: 'Work' } },
      update: {},
      create: {
        userId: user.id,
        name: 'Work',
        color: '#6366f1', // Indigo
        sortOrder: 4,
      },
    }),
    prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: 'Family' } },
      update: {},
      create: {
        userId: user.id,
        name: 'Family',
        color: '#ec4899', // Pink
        sortOrder: 5,
      },
    }),
    prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: 'Wind Down' } },
      update: {},
      create: {
        userId: user.id,
        name: 'Wind Down',
        color: '#64748b', // Slate
        sortOrder: 6,
      },
    }),
  ]);

  const [morningRoutine, learning, exercise, deepWork, work, family, windDown] = categories;
  console.log(`✅ Created ${categories.length} categories`);

  // Create activities based on the conversation
  const activities = await Promise.all([
    // Learning activities
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: learning.id, name: 'Spanish (Duolingo)' } },
      update: {},
      create: { userId: user.id, categoryId: learning.id, name: 'Spanish (Duolingo)', isFavorite: true },
    }),
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: learning.id, name: 'MBA Coursework' } },
      update: {},
      create: { userId: user.id, categoryId: learning.id, name: 'MBA Coursework', isFavorite: true },
    }),
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: learning.id, name: 'Udacity AI Course' } },
      update: {},
      create: { userId: user.id, categoryId: learning.id, name: 'Udacity AI Course' },
    }),
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: learning.id, name: 'Reading' } },
      update: {},
      create: { userId: user.id, categoryId: learning.id, name: 'Reading' },
    }),
    
    // Exercise activities
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: exercise.id, name: 'Running' } },
      update: {},
      create: { userId: user.id, categoryId: exercise.id, name: 'Running', isFavorite: true },
    }),
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: exercise.id, name: 'Gym' } },
      update: {},
      create: { userId: user.id, categoryId: exercise.id, name: 'Gym' },
    }),
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: exercise.id, name: 'Boating' } },
      update: {},
      create: { userId: user.id, categoryId: exercise.id, name: 'Boating' },
    }),
    
    // Deep Work activities
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: deepWork.id, name: 'SuiteStack Development' } },
      update: {},
      create: { userId: user.id, categoryId: deepWork.id, name: 'SuiteStack Development', isFavorite: true },
    }),
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: deepWork.id, name: 'DealStack CRM' } },
      update: {},
      create: { userId: user.id, categoryId: deepWork.id, name: 'DealStack CRM' },
    }),
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: deepWork.id, name: 'Technical Writing' } },
      update: {},
      create: { userId: user.id, categoryId: deepWork.id, name: 'Technical Writing' },
    }),
    
    // Work activities
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: work.id, name: 'JLL Technology Advisory' } },
      update: {},
      create: { userId: user.id, categoryId: work.id, name: 'JLL Technology Advisory', isFavorite: true },
    }),
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: work.id, name: 'Meetings' } },
      update: {},
      create: { userId: user.id, categoryId: work.id, name: 'Meetings' },
    }),
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: work.id, name: 'Email & Admin' } },
      update: {},
      create: { userId: user.id, categoryId: work.id, name: 'Email & Admin' },
    }),
    
    // Morning Routine
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: morningRoutine.id, name: 'Wake up, coffee, plan day' } },
      update: {},
      create: { userId: user.id, categoryId: morningRoutine.id, name: 'Wake up, coffee, plan day', isFavorite: true },
    }),
    
    // Family
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: family.id, name: 'Dinner with wife' } },
      update: {},
      create: { userId: user.id, categoryId: family.id, name: 'Dinner with wife', isFavorite: true },
    }),
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: family.id, name: 'Baby prep' } },
      update: {},
      create: { userId: user.id, categoryId: family.id, name: 'Baby prep' },
    }),
    
    // Wind Down
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: windDown.id, name: 'Reading/Relaxation' } },
      update: {},
      create: { userId: user.id, categoryId: windDown.id, name: 'Reading/Relaxation', isFavorite: true },
    }),
    prisma.activity.upsert({
      where: { userId_categoryId_name: { userId: user.id, categoryId: windDown.id, name: 'Daily review' } },
      update: {},
      create: { userId: user.id, categoryId: windDown.id, name: 'Daily review' },
    }),
  ]);

  console.log(`✅ Created ${activities.length} activities`);

  // Get activity references for timeboxes
  const spanishActivity = activities.find(a => a.name === 'Spanish (Duolingo)')!;
  const morningActivity = activities.find(a => a.name === 'Wake up, coffee, plan day')!;
  const runningActivity = activities.find(a => a.name === 'Running')!;
  const jllActivity = activities.find(a => a.name === 'JLL Technology Advisory')!;
  const dinnerActivity = activities.find(a => a.name === 'Dinner with wife')!;
  const windDownActivity = activities.find(a => a.name === 'Reading/Relaxation')!;
  const suiteStackActivity = activities.find(a => a.name === 'SuiteStack Development')!;

  // Create timeboxes (default weekday schedule)
  const timeboxes = await Promise.all([
    // Morning Routine: 5:00 - 6:00 AM
    prisma.timebox.create({
      data: {
        userId: user.id,
        categoryId: morningRoutine.id,
        defaultActivityId: morningActivity.id,
        startTime: '05:00',
        endTime: '06:00',
        dayOfWeek: null, // All days
        sortOrder: 0,
      },
    }),
    
    // Learning: 6:00 - 7:30 AM
    prisma.timebox.create({
      data: {
        userId: user.id,
        categoryId: learning.id,
        defaultActivityId: spanishActivity.id,
        startTime: '06:00',
        endTime: '07:30',
        dayOfWeek: null,
        sortOrder: 1,
      },
    }),
    
    // Exercise: 7:30 - 8:30 AM
    prisma.timebox.create({
      data: {
        userId: user.id,
        categoryId: exercise.id,
        defaultActivityId: runningActivity.id,
        startTime: '07:30',
        endTime: '08:30',
        dayOfWeek: null,
        sortOrder: 2,
      },
    }),
    
    // Deep Work: 9:00 AM - 12:00 PM
    prisma.timebox.create({
      data: {
        userId: user.id,
        categoryId: deepWork.id,
        defaultActivityId: suiteStackActivity.id,
        startTime: '09:00',
        endTime: '12:00',
        dayOfWeek: null,
        sortOrder: 3,
      },
    }),
    
    // Work: 1:00 - 5:00 PM
    prisma.timebox.create({
      data: {
        userId: user.id,
        categoryId: work.id,
        defaultActivityId: jllActivity.id,
        startTime: '13:00',
        endTime: '17:00',
        dayOfWeek: null,
        sortOrder: 4,
      },
    }),
    
    // Family: 6:00 - 8:00 PM
    prisma.timebox.create({
      data: {
        userId: user.id,
        categoryId: family.id,
        defaultActivityId: dinnerActivity.id,
        startTime: '18:00',
        endTime: '20:00',
        dayOfWeek: null,
        sortOrder: 5,
      },
    }),
    
    // Wind Down: 8:00 - 9:00 PM
    prisma.timebox.create({
      data: {
        userId: user.id,
        categoryId: windDown.id,
        defaultActivityId: windDownActivity.id,
        startTime: '20:00',
        endTime: '21:00',
        dayOfWeek: null,
        sortOrder: 6,
      },
    }),
  ]);

  console.log(`✅ Created ${timeboxes.length} timeboxes`);

  // Create a sample daily plan for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyPlan = await prisma.dailyPlan.create({
    data: {
      userId: user.id,
      date: today,
      plannedBlocks: {
        create: timeboxes.map(tb => ({
          timeboxId: tb.id,
          plannedActivityId: tb.defaultActivityId,
        })),
      },
    },
  });

  console.log(`✅ Created sample daily plan for ${today.toISOString().split('T')[0]}`);

  console.log('\n🎉 Seeding complete!');
  console.log('\n📋 Test credentials:');
  console.log('   Email: ben@example.com');
  console.log('   Password: franklin123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
