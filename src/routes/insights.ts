import { Router, Response } from 'express';
import prisma from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { isValidDateFormat } from '../middleware/validate';
import { AuthRequest, ApiResponse, InsightsSummary, CategoryInsight, DeviationBreakdown } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Helper: Calculate hours between two time strings
function calculateHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  return (endH * 60 + endM - startH * 60 - startM) / 60;
}

// GET /api/insights - Get insights summary for a date range
router.get('/',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse<InsightsSummary>>) => {
    const { startDate, endDate } = req.query;
    
    // Default to last 7 days if not specified
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get all plans and blocks in the date range
    const plans = await prisma.dailyPlan.findMany({
      where: {
        userId: req.user!.userId,
        date: { gte: start, lte: end },
      },
      include: {
        plannedBlocks: {
          include: {
            timebox: {
              include: { category: true },
            },
            plannedActivity: true,
            actualActivity: true,
          },
        },
      },
    });
    
    // Calculate basic stats
    const allBlocks = plans.flatMap(p => p.plannedBlocks);
    const completedBlocks = allBlocks.filter(b => b.isCompleted);
    const deviatedBlocks = completedBlocks.filter(b => 
      b.deviationReason || 
      (b.actualActivityId && b.actualActivityId !== b.plannedActivityId)
    );
    
    const totalPlannedBlocks = allBlocks.length;
    const adherenceRate = totalPlannedBlocks > 0 
      ? ((completedBlocks.length - deviatedBlocks.length) / completedBlocks.length) * 100 
      : 0;
    
    // Calculate average rating
    const ratedPlans = plans.filter(p => p.overallRating !== null);
    const averageRating = ratedPlans.length > 0
      ? ratedPlans.reduce((sum, p) => sum + (p.overallRating || 0), 0) / ratedPlans.length
      : null;
    
    // Category breakdown
    const categories = await prisma.category.findMany({
      where: { userId: req.user!.userId },
    });
    
    const categoryBreakdown: CategoryInsight[] = categories.map(cat => {
      const catBlocks = allBlocks.filter(b => b.timebox.categoryId === cat.id);
      const catCompleted = catBlocks.filter(b => b.isCompleted);
      const catDeviated = catCompleted.filter(b =>
        b.deviationReason ||
        (b.actualActivityId && b.actualActivityId !== b.plannedActivityId)
      );
      
      // Calculate hours
      const plannedHours = catBlocks.reduce((sum, b) => 
        sum + calculateHours(b.timebox.startTime, b.timebox.endTime), 0
      );
      
      const actualHours = catCompleted
        .filter(b => !b.deviationReason && b.actualActivityId === b.plannedActivityId)
        .reduce((sum, b) => 
          sum + calculateHours(b.timebox.startTime, b.timebox.endTime), 0
        );
      
      const adherence = catCompleted.length > 0
        ? ((catCompleted.length - catDeviated.length) / catCompleted.length) * 100
        : 0;
      
      // Goal progress (weekly)
      const daysInRange = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      const weeksInRange = daysInRange / 7;
      const goalHoursInRange = cat.weeklyGoalHours ? cat.weeklyGoalHours * weeksInRange : null;
      const goalProgress = goalHoursInRange ? (actualHours / goalHoursInRange) * 100 : null;
      
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryColor: cat.color,
        plannedHours: Math.round(plannedHours * 10) / 10,
        actualHours: Math.round(actualHours * 10) / 10,
        adherenceRate: Math.round(adherence),
        goalHours: cat.weeklyGoalHours,
        goalProgress: goalProgress ? Math.round(goalProgress) : null,
      };
    });
    
    // Deviation reasons breakdown
    const deviationCounts = new Map<string, number>();
    deviatedBlocks.forEach(b => {
      const reason = b.deviationReason || 'OTHER';
      deviationCounts.set(reason, (deviationCounts.get(reason) || 0) + 1);
    });
    
    const totalDeviations = deviatedBlocks.length;
    const deviationReasons: DeviationBreakdown[] = Array.from(deviationCounts.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: totalDeviations > 0 ? Math.round((count / totalDeviations) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
    
    // Streak calculation
    const sortedDates = plans
      .filter(p => {
        const completed = p.plannedBlocks.filter(b => b.isCompleted).length;
        const deviated = p.plannedBlocks.filter(b => b.deviationReason).length;
        return completed > 0 && deviated === 0; // Perfect day
      })
      .map(p => p.date)
      .sort((a, b) => b.getTime() - a.getTime());
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate: Date | null = null;
    
    // Calculate streaks (checking for consecutive days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    sortedDates.forEach((date, i) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      
      if (i === 0) {
        // Check if most recent perfect day is today or yesterday
        const diffDays = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays <= 1) {
          currentStreak = 1;
          tempStreak = 1;
        }
        lastDate = d;
        return;
      }
      
      if (lastDate) {
        const diffDays = Math.floor((lastDate.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
          tempStreak++;
          if (currentStreak > 0) currentStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
          currentStreak = 0;
        }
      }
      lastDate = d;
    });
    
    longestStreak = Math.max(longestStreak, tempStreak);
    
    const summary: InsightsSummary = {
      totalPlannedBlocks,
      completedBlocks: completedBlocks.length,
      deviatedBlocks: deviatedBlocks.length,
      adherenceRate: Math.round(adherenceRate),
      averageRating,
      categoryBreakdown,
      deviationReasons,
      streaks: {
        currentStreak,
        longestStreak,
        lastCompletedDate: sortedDates[0]?.toISOString().split('T')[0] || null,
      },
    };
    
    res.json({
      success: true,
      data: summary,
    });
  })
);

// GET /api/insights/time-analysis - Best times for each activity
router.get('/time-analysis',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    // Get all completed blocks with activities
    const blocks = await prisma.plannedBlock.findMany({
      where: {
        dailyPlan: { userId: req.user!.userId },
        isCompleted: true,
        actualActivityId: { not: null },
      },
      include: {
        timebox: true,
        actualActivity: {
          include: { category: true },
        },
      },
    });
    
    // Group by activity and time slot
    const activityTimeStats = new Map<string, Map<string, { success: number; total: number }>>();
    
    blocks.forEach(block => {
      if (!block.actualActivity) return;
      
      const activityId = block.actualActivity.id;
      const timeSlot = block.timebox.startTime;
      const wasSuccessful = !block.deviationReason && 
        block.actualActivityId === block.plannedActivityId;
      
      if (!activityTimeStats.has(activityId)) {
        activityTimeStats.set(activityId, new Map());
      }
      
      const timeMap = activityTimeStats.get(activityId)!;
      if (!timeMap.has(timeSlot)) {
        timeMap.set(timeSlot, { success: 0, total: 0 });
      }
      
      const stats = timeMap.get(timeSlot)!;
      stats.total++;
      if (wasSuccessful) stats.success++;
    });
    
    // Convert to response format
    const analysis = Array.from(activityTimeStats.entries()).map(([activityId, timeMap]) => {
      const activity = blocks.find(b => b.actualActivity?.id === activityId)?.actualActivity;
      
      const timeSlots = Array.from(timeMap.entries())
        .map(([time, stats]) => ({
          time,
          successRate: Math.round((stats.success / stats.total) * 100),
          totalAttempts: stats.total,
        }))
        .sort((a, b) => b.successRate - a.successRate);
      
      return {
        activityId,
        activityName: activity?.name,
        categoryName: activity?.category.name,
        categoryColor: activity?.category.color,
        bestTime: timeSlots[0]?.time || null,
        bestTimeSuccessRate: timeSlots[0]?.successRate || 0,
        worstTime: timeSlots[timeSlots.length - 1]?.time || null,
        worstTimeSuccessRate: timeSlots[timeSlots.length - 1]?.successRate || 0,
        timeSlots,
      };
    });
    
    res.json({
      success: true,
      data: analysis,
    });
  })
);

// GET /api/insights/day-patterns - Patterns by day of week
router.get('/day-patterns',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const plans = await prisma.dailyPlan.findMany({
      where: { userId: req.user!.userId },
      include: {
        plannedBlocks: {
          include: {
            timebox: { include: { category: true } },
          },
        },
      },
    });
    
    // Group by day of week
    const dayStats = new Map<number, { completed: number; deviated: number; total: number; ratings: number[] }>();
    
    for (let i = 0; i < 7; i++) {
      dayStats.set(i, { completed: 0, deviated: 0, total: 0, ratings: [] });
    }
    
    plans.forEach(plan => {
      const dayOfWeek = new Date(plan.date).getDay();
      const stats = dayStats.get(dayOfWeek)!;
      
      plan.plannedBlocks.forEach(block => {
        stats.total++;
        if (block.isCompleted) stats.completed++;
        if (block.deviationReason) stats.deviated++;
      });
      
      if (plan.overallRating) {
        stats.ratings.push(plan.overallRating);
      }
    });
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const patterns = Array.from(dayStats.entries()).map(([day, stats]) => ({
      dayOfWeek: day,
      dayName: dayNames[day],
      totalBlocks: stats.total,
      completedBlocks: stats.completed,
      deviatedBlocks: stats.deviated,
      adherenceRate: stats.completed > 0 
        ? Math.round(((stats.completed - stats.deviated) / stats.completed) * 100) 
        : 0,
      averageRating: stats.ratings.length > 0
        ? Math.round((stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length) * 10) / 10
        : null,
    }));
    
    res.json({
      success: true,
      data: patterns,
    });
  })
);

// GET /api/insights/weekly-summary - Summary for current/specified week
router.get('/weekly-summary',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { weekOf } = req.query;
    
    // Calculate week boundaries
    let startOfWeek: Date;
    if (weekOf && isValidDateFormat(weekOf as string)) {
      startOfWeek = new Date(weekOf as string);
    } else {
      startOfWeek = new Date();
    }
    
    // Adjust to start of week (Sunday)
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    // Get plans for the week
    const plans = await prisma.dailyPlan.findMany({
      where: {
        userId: req.user!.userId,
        date: { gte: startOfWeek, lte: endOfWeek },
      },
      include: {
        plannedBlocks: {
          include: {
            timebox: { include: { category: true } },
            plannedActivity: true,
            actualActivity: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });
    
    // Calculate stats
    const allBlocks = plans.flatMap(p => p.plannedBlocks);
    const completed = allBlocks.filter(b => b.isCompleted);
    const asPlanned = completed.filter(b => 
      !b.deviationReason && b.actualActivityId === b.plannedActivityId
    );
    
    // Hours by category
    const categoryHours = new Map<string, { planned: number; actual: number; name: string; color: string }>();
    
    allBlocks.forEach(block => {
      const cat = block.timebox.category;
      const hours = calculateHours(block.timebox.startTime, block.timebox.endTime);
      
      if (!categoryHours.has(cat.id)) {
        categoryHours.set(cat.id, { planned: 0, actual: 0, name: cat.name, color: cat.color });
      }
      
      const stats = categoryHours.get(cat.id)!;
      stats.planned += hours;
      
      if (block.isCompleted && !block.deviationReason && 
          block.actualActivityId === block.plannedActivityId) {
        stats.actual += hours;
      }
    });
    
    const summary = {
      weekStart: startOfWeek.toISOString().split('T')[0],
      weekEnd: endOfWeek.toISOString().split('T')[0],
      daysPlanned: plans.length,
      totalBlocks: allBlocks.length,
      completedBlocks: completed.length,
      completedAsPlanned: asPlanned.length,
      overallAdherence: completed.length > 0 
        ? Math.round((asPlanned.length / completed.length) * 100) 
        : 0,
      averageRating: plans.filter(p => p.overallRating).length > 0
        ? Math.round(
            plans.filter(p => p.overallRating)
              .reduce((sum, p) => sum + (p.overallRating || 0), 0) / 
            plans.filter(p => p.overallRating).length * 10
          ) / 10
        : null,
      categoryBreakdown: Array.from(categoryHours.entries()).map(([id, stats]) => ({
        categoryId: id,
        categoryName: stats.name,
        categoryColor: stats.color,
        plannedHours: Math.round(stats.planned * 10) / 10,
        actualHours: Math.round(stats.actual * 10) / 10,
      })),
      dailyBreakdown: plans.map(p => {
        const dayCompleted = p.plannedBlocks.filter(b => b.isCompleted);
        const dayAsPlanned = dayCompleted.filter(b => 
          !b.deviationReason && b.actualActivityId === b.plannedActivityId
        );
        return {
          date: p.date.toISOString().split('T')[0],
          dayOfWeek: new Date(p.date).getDay(),
          blocksPlanned: p.plannedBlocks.length,
          blocksCompleted: dayCompleted.length,
          blocksAsPlanned: dayAsPlanned.length,
          rating: p.overallRating,
        };
      }),
    };
    
    res.json({
      success: true,
      data: summary,
    });
  })
);

export default router;
