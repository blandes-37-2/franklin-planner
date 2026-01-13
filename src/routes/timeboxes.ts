import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import prisma from '../utils/prisma';
import { validate, isValidTimeFormat, isValidDayOfWeek } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { AuthRequest, ApiResponse, CreateTimeboxRequest, UpdateTimeboxRequest } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation rules
const createValidation = [
  body('categoryId').isUUID().withMessage('Valid category ID required'),
  body('defaultActivityId').optional({ nullable: true }).isUUID().withMessage('Valid activity ID required'),
  body('startTime').custom(isValidTimeFormat).withMessage('Start time must be HH:mm format'),
  body('endTime').custom(isValidTimeFormat).withMessage('End time must be HH:mm format'),
  body('dayOfWeek').optional({ nullable: true }).custom(isValidDayOfWeek).withMessage('Day of week must be 0-6 or null'),
  body('sortOrder').optional().isInt({ min: 0 }),
];

const updateValidation = [
  param('id').isUUID().withMessage('Invalid timebox ID'),
  body('categoryId').optional().isUUID().withMessage('Valid category ID required'),
  body('defaultActivityId').optional({ nullable: true }).isUUID().withMessage('Valid activity ID required'),
  body('startTime').optional().custom(isValidTimeFormat).withMessage('Start time must be HH:mm format'),
  body('endTime').optional().custom(isValidTimeFormat).withMessage('End time must be HH:mm format'),
  body('dayOfWeek').optional({ nullable: true }).custom(isValidDayOfWeek).withMessage('Day of week must be 0-6 or null'),
  body('isActive').optional().isBoolean(),
  body('sortOrder').optional().isInt({ min: 0 }),
];

// GET /api/timeboxes - List all timeboxes for user
router.get('/',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { dayOfWeek, includeInactive } = req.query;
    
    const timeboxes = await prisma.timebox.findMany({
      where: {
        userId: req.user!.userId,
        ...(includeInactive !== 'true' && { isActive: true }),
        ...(dayOfWeek !== undefined && {
          OR: [
            { dayOfWeek: parseInt(dayOfWeek as string) },
            { dayOfWeek: null }, // Include "all days" timeboxes
          ],
        }),
      },
      orderBy: [{ startTime: 'asc' }, { sortOrder: 'asc' }],
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
        defaultActivity: {
          select: { id: true, name: true },
        },
      },
    });
    
    res.json({
      success: true,
      data: timeboxes,
    });
  })
);

// GET /api/timeboxes/schedule/:dayOfWeek - Get schedule for specific day (0-6)
router.get('/schedule/:dayOfWeek',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const dayOfWeek = parseInt(req.params.dayOfWeek as string);
    
    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      throw ApiError.badRequest('Day of week must be 0-6');
    }
    
    // Get timeboxes that apply to this day
    // Either specifically for this day OR for all days (dayOfWeek = null)
    const timeboxes = await prisma.timebox.findMany({
      where: {
        userId: req.user!.userId,
        isActive: true,
        OR: [
          { dayOfWeek },
          { dayOfWeek: null },
        ],
      },
      orderBy: [{ startTime: 'asc' }, { sortOrder: 'asc' }],
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
        defaultActivity: {
          select: { id: true, name: true },
        },
      },
    });
    
    // If there are day-specific timeboxes for a time slot, prefer them over "all days"
    const timeSlots = new Map<string, typeof timeboxes[0]>();
    
    // First, add all "all days" timeboxes
    timeboxes
      .filter(t => t.dayOfWeek === null)
      .forEach(t => timeSlots.set(t.startTime, t));
    
    // Then, override with day-specific timeboxes
    timeboxes
      .filter(t => t.dayOfWeek === dayOfWeek)
      .forEach(t => timeSlots.set(t.startTime, t));
    
    // Convert back to sorted array
    const schedule = Array.from(timeSlots.values())
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    res.json({
      success: true,
      data: schedule,
    });
  })
);

// GET /api/timeboxes/:id - Get single timebox
router.get('/:id',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const timebox = await prisma.timebox.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
        defaultActivity: {
          select: { id: true, name: true },
        },
      },
    });
    
    if (!timebox) {
      throw ApiError.notFound('Timebox not found');
    }
    
    res.json({
      success: true,
      data: timebox,
    });
  })
);

// POST /api/timeboxes - Create new timebox
router.post('/',
  validate(createValidation),
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { categoryId, defaultActivityId, startTime, endTime, dayOfWeek, sortOrder } = req.body as CreateTimeboxRequest;
    
    // Verify category belongs to user
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        userId: req.user!.userId,
      },
    });
    
    if (!category) {
      throw ApiError.notFound('Category not found');
    }
    
    // If default activity specified, verify it belongs to user and category
    if (defaultActivityId) {
      const activity = await prisma.activity.findFirst({
        where: {
          id: defaultActivityId,
          userId: req.user!.userId,
          categoryId,
        },
      });
      
      if (!activity) {
        throw ApiError.badRequest('Default activity must belong to the same category');
      }
    }
    
    // Validate time range
    if (startTime >= endTime) {
      throw ApiError.badRequest('End time must be after start time');
    }
    
    // Get max sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const maxSort = await prisma.timebox.aggregate({
        where: { userId: req.user!.userId },
        _max: { sortOrder: true },
      });
      finalSortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    }
    
    const timebox = await prisma.timebox.create({
      data: {
        userId: req.user!.userId,
        categoryId,
        defaultActivityId,
        startTime,
        endTime,
        dayOfWeek: dayOfWeek ?? null,
        sortOrder: finalSortOrder,
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
        defaultActivity: {
          select: { id: true, name: true },
        },
      },
    });
    
    res.status(201).json({
      success: true,
      data: timebox,
      message: 'Timebox created',
    });
  })
);

// PUT /api/timeboxes/:id - Update timebox
router.put('/:id',
  validate(updateValidation),
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { categoryId, defaultActivityId, startTime, endTime, dayOfWeek, isActive, sortOrder } = req.body as UpdateTimeboxRequest;
    
    // Verify ownership
    const existing = await prisma.timebox.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });
    
    if (!existing) {
      throw ApiError.notFound('Timebox not found');
    }
    
    // If changing category, verify it belongs to user
    const finalCategoryId = categoryId || existing.categoryId;
    if (categoryId && categoryId !== existing.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          userId: req.user!.userId,
        },
      });
      
      if (!category) {
        throw ApiError.notFound('Category not found');
      }
    }
    
    // If default activity specified, verify it belongs to user and category
    if (defaultActivityId) {
      const activity = await prisma.activity.findFirst({
        where: {
          id: defaultActivityId,
          userId: req.user!.userId,
          categoryId: finalCategoryId,
        },
      });
      
      if (!activity) {
        throw ApiError.badRequest('Default activity must belong to the same category');
      }
    }
    
    // Validate time range if both provided
    const finalStartTime = startTime || existing.startTime;
    const finalEndTime = endTime || existing.endTime;
    if (finalStartTime >= finalEndTime) {
      throw ApiError.badRequest('End time must be after start time');
    }
    
    const timebox = await prisma.timebox.update({
      where: { id: req.params.id },
      data: {
        ...(categoryId !== undefined && { categoryId }),
        ...(defaultActivityId !== undefined && { defaultActivityId }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(dayOfWeek !== undefined && { dayOfWeek }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
        defaultActivity: {
          select: { id: true, name: true },
        },
      },
    });
    
    res.json({
      success: true,
      data: timebox,
      message: 'Timebox updated',
    });
  })
);

// DELETE /api/timeboxes/:id - Delete timebox
router.delete('/:id',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    // Verify ownership
    const existing = await prisma.timebox.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });
    
    if (!existing) {
      throw ApiError.notFound('Timebox not found');
    }
    
    await prisma.timebox.delete({
      where: { id: req.params.id },
    });
    
    res.json({
      success: true,
      message: 'Timebox deleted',
    });
  })
);

// POST /api/timeboxes/reorder - Batch update sort orders
router.post('/reorder',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { order } = req.body; // Array of { id, sortOrder }
    
    if (!Array.isArray(order)) {
      throw ApiError.badRequest('Order must be an array');
    }
    
    await prisma.$transaction(
      order.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
        prisma.timebox.updateMany({
          where: {
            id,
            userId: req.user!.userId,
          },
          data: { sortOrder },
        })
      )
    );
    
    res.json({
      success: true,
      message: 'Timeboxes reordered',
    });
  })
);

export default router;
