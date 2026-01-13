import { Router, Response } from 'express';
import { body, param } from 'express-validator';
import prisma from '../utils/prisma';
import { validate, isValidDateFormat, isValidRating } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { AuthRequest, ApiResponse, UpdateDailyPlanRequest, CheckInRequest } from '../types';

// Deviation reasons - matches Prisma enum
const VALID_DEVIATION_REASONS = ['ENERGY', 'MOOD', 'INTERRUPTION', 'OPPORTUNITY', 'OVERRUN', 'SKIP'] as const;
type DeviationReason = typeof VALID_DEVIATION_REASONS[number];

const router = Router();

// All routes require authentication
router.use(authenticate);

// Helper: Get day of week from date (0 = Sunday)
function getDayOfWeek(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay();
}

// Helper: Generate daily plan with blocks from timeboxes
async function generateDailyPlan(userId: string, dateStr: string) {
  const dayOfWeek = getDayOfWeek(dateStr);
  
  // Get applicable timeboxes for this day
  const timeboxes = await prisma.timebox.findMany({
    where: {
      userId,
      isActive: true,
      OR: [
        { dayOfWeek },
        { dayOfWeek: null },
      ],
    },
    orderBy: [{ startTime: 'asc' }],
  });
  
  // Dedupe by start time (day-specific takes priority)
  const timeSlotMap = new Map<string, typeof timeboxes[0]>();
  timeboxes
    .filter(t => t.dayOfWeek === null)
    .forEach(t => timeSlotMap.set(t.startTime, t));
  timeboxes
    .filter(t => t.dayOfWeek === dayOfWeek)
    .forEach(t => timeSlotMap.set(t.startTime, t));
  
  const finalTimeboxes = Array.from(timeSlotMap.values());
  
  // Create the daily plan
  const plan = await prisma.dailyPlan.create({
    data: {
      userId,
      date: new Date(dateStr),
      plannedBlocks: {
        create: finalTimeboxes.map(tb => ({
          timeboxId: tb.id,
          plannedActivityId: tb.defaultActivityId,
        })),
      },
    },
    include: {
      plannedBlocks: {
        include: {
          timebox: {
            include: {
              category: { select: { id: true, name: true, color: true } },
            },
          },
          plannedActivity: { select: { id: true, name: true } },
          actualActivity: { select: { id: true, name: true } },
        },
        orderBy: {
          timebox: { startTime: 'asc' },
        },
      },
    },
  });
  
  return plan;
}

// GET /api/plans/:date - Get or create daily plan
router.get('/:date',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const date = req.params.date as string;
    
    if (!isValidDateFormat(date)) {
      throw ApiError.badRequest('Date must be YYYY-MM-DD format');
    }
    
    // Try to find existing plan
    let plan = await prisma.dailyPlan.findUnique({
      where: {
        userId_date: {
          userId: req.user!.userId,
          date: new Date(date),
        },
      },
      include: {
        plannedBlocks: {
          include: {
            timebox: {
              include: {
                category: { select: { id: true, name: true, color: true } },
              },
            },
            plannedActivity: { select: { id: true, name: true } },
            actualActivity: { select: { id: true, name: true } },
          },
          orderBy: {
            timebox: { startTime: 'asc' },
          },
        },
      },
    });
    
    // If no plan exists, generate one from timeboxes
    if (!plan) {
      plan = await generateDailyPlan(req.user!.userId, date);
    }
    
    res.json({
      success: true,
      data: plan,
    });
  })
);

// PUT /api/plans/:date - Update daily plan (rating, notes)
router.put('/:date',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const date = req.params.date as string;
    const { overallRating, notes } = req.body as UpdateDailyPlanRequest;
    
    if (!isValidDateFormat(date)) {
      throw ApiError.badRequest('Date must be YYYY-MM-DD format');
    }
    
    if (overallRating !== undefined && overallRating !== null && !isValidRating(overallRating)) {
      throw ApiError.badRequest('Rating must be 1-5');
    }
    
    // Find or create the plan
    let plan = await prisma.dailyPlan.findUnique({
      where: {
        userId_date: {
          userId: req.user!.userId,
          date: new Date(date),
        },
      },
    });
    
    if (!plan) {
      plan = await generateDailyPlan(req.user!.userId, date);
    }
    
    // Update the plan
    const updated = await prisma.dailyPlan.update({
      where: { id: plan.id },
      data: {
        ...(overallRating !== undefined && { overallRating }),
        ...(notes !== undefined && { notes }),
        ...(overallRating !== undefined && { reviewedAt: new Date() }),
      },
      include: {
        plannedBlocks: {
          include: {
            timebox: {
              include: {
                category: { select: { id: true, name: true, color: true } },
              },
            },
            plannedActivity: { select: { id: true, name: true } },
            actualActivity: { select: { id: true, name: true } },
          },
          orderBy: {
            timebox: { startTime: 'asc' },
          },
        },
      },
    });
    
    res.json({
      success: true,
      data: updated,
      message: 'Daily plan updated',
    });
  })
);

// PUT /api/plans/:date/blocks/:blockId - Update a specific block's planned activity
router.put('/:date/blocks/:blockId',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const date = req.params.date as string;
    const blockId = req.params.blockId as string;
    const { plannedActivityId } = req.body;
    
    if (!isValidDateFormat(date)) {
      throw ApiError.badRequest('Date must be YYYY-MM-DD format');
    }
    
    // Verify the block belongs to this user's plan
    const block = await prisma.plannedBlock.findFirst({
      where: {
        id: blockId,
        dailyPlan: {
          userId: req.user!.userId,
          date: new Date(date),
        },
      },
      include: {
        timebox: true,
      },
    });
    
    if (!block) {
      throw ApiError.notFound('Block not found');
    }
    
    // If setting an activity, verify it belongs to the user and matches category
    if (plannedActivityId) {
      const activity = await prisma.activity.findFirst({
        where: {
          id: plannedActivityId,
          userId: req.user!.userId,
          categoryId: block.timebox.categoryId,
        },
      });
      
      if (!activity) {
        throw ApiError.badRequest('Activity must belong to the same category as the timebox');
      }
    }
    
    const updated = await prisma.plannedBlock.update({
      where: { id: blockId },
      data: {
        plannedActivityId: plannedActivityId || null,
      },
      include: {
        timebox: {
          include: {
            category: { select: { id: true, name: true, color: true } },
          },
        },
        plannedActivity: { select: { id: true, name: true } },
        actualActivity: { select: { id: true, name: true } },
      },
    });
    
    res.json({
      success: true,
      data: updated,
    });
  })
);

// POST /api/plans/:date/blocks/:blockId/checkin - Check in on a block
router.post('/:date/blocks/:blockId/checkin',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const date = req.params.date as string;
    const blockId = req.params.blockId as string;
    const { actualActivityId, deviationReason, deviationNotes, isCompleted } = req.body as CheckInRequest;
    
    if (!isValidDateFormat(date)) {
      throw ApiError.badRequest('Date must be YYYY-MM-DD format');
    }
    
    // Validate deviation reason if provided
    if (deviationReason && !VALID_DEVIATION_REASONS.includes(deviationReason as DeviationReason)) {
      throw ApiError.badRequest('Invalid deviation reason. Must be one of: ENERGY, MOOD, INTERRUPTION, OPPORTUNITY, OVERRUN, SKIP');
    }
    
    // Verify the block belongs to this user's plan
    const block = await prisma.plannedBlock.findFirst({
      where: {
        id: blockId,
        dailyPlan: {
          userId: req.user!.userId,
          date: new Date(date),
        },
      },
      include: {
        timebox: true,
      },
    });
    
    if (!block) {
      throw ApiError.notFound('Block not found');
    }
    
    // If setting an actual activity, verify it belongs to the user
    // Note: Unlike planned activity, actual activity can be any category (allows cross-category deviations)
    if (actualActivityId) {
      const activity = await prisma.activity.findFirst({
        where: {
          id: actualActivityId,
          userId: req.user!.userId,
        },
      });
      
      if (!activity) {
        throw ApiError.notFound('Activity not found');
      }
    }
    
    const updated = await prisma.plannedBlock.update({
      where: { id: blockId },
      data: {
        actualActivityId: actualActivityId || null,
        deviationReason: deviationReason as DeviationReason || null,
        deviationNotes: deviationNotes || null,
        isCompleted: isCompleted ?? true,
        completedAt: isCompleted !== false ? new Date() : null,
      },
      include: {
        timebox: {
          include: {
            category: { select: { id: true, name: true, color: true } },
          },
        },
        plannedActivity: { select: { id: true, name: true } },
        actualActivity: { select: { id: true, name: true } },
      },
    });
    
    res.json({
      success: true,
      data: updated,
      message: 'Check-in recorded',
    });
  })
);

// POST /api/plans/:date/complete-as-planned - Mark all blocks as completed with planned = actual
router.post('/:date/complete-as-planned',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const date = req.params.date as string;
    
    if (!isValidDateFormat(date)) {
      throw ApiError.badRequest('Date must be YYYY-MM-DD format');
    }
    
    // Find the plan
    const plan = await prisma.dailyPlan.findUnique({
      where: {
        userId_date: {
          userId: req.user!.userId,
          date: new Date(date),
        },
      },
      include: {
        plannedBlocks: true,
      },
    });
    
    if (!plan) {
      throw ApiError.notFound('Daily plan not found');
    }
    
    // Update all incomplete blocks
    await prisma.$transaction(
      plan.plannedBlocks
        .filter(b => !b.isCompleted)
        .map(b =>
          prisma.plannedBlock.update({
            where: { id: b.id },
            data: {
              actualActivityId: b.plannedActivityId,
              isCompleted: true,
              completedAt: new Date(),
            },
          })
        )
    );
    
    // Refetch the updated plan
    const updated = await prisma.dailyPlan.findUnique({
      where: { id: plan.id },
      include: {
        plannedBlocks: {
          include: {
            timebox: {
              include: {
                category: { select: { id: true, name: true, color: true } },
              },
            },
            plannedActivity: { select: { id: true, name: true } },
            actualActivity: { select: { id: true, name: true } },
          },
          orderBy: {
            timebox: { startTime: 'asc' },
          },
        },
      },
    });
    
    res.json({
      success: true,
      data: updated,
      message: 'Day marked as completed as planned',
    });
  })
);

// GET /api/plans - List plans for a date range
router.get('/',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !isValidDateFormat(startDate as string)) {
      throw ApiError.badRequest('startDate required in YYYY-MM-DD format');
    }
    
    if (!endDate || !isValidDateFormat(endDate as string)) {
      throw ApiError.badRequest('endDate required in YYYY-MM-DD format');
    }
    
    const plans = await prisma.dailyPlan.findMany({
      where: {
        userId: req.user!.userId,
        date: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        },
      },
      orderBy: { date: 'asc' },
      include: {
        plannedBlocks: {
          include: {
            timebox: {
              include: {
                category: { select: { id: true, name: true, color: true } },
              },
            },
            plannedActivity: { select: { id: true, name: true } },
            actualActivity: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: { plannedBlocks: true },
        },
      },
    });
    
    res.json({
      success: true,
      data: plans,
    });
  })
);

export default router;
