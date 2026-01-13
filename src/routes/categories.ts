import { Router, Response } from 'express';
import { body, param } from 'express-validator';
import prisma from '../utils/prisma';
import { validate, isValidHexColor } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { AuthRequest, ApiResponse, CreateCategoryRequest, UpdateCategoryRequest } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation rules
const createValidation = [
  body('name').notEmpty().trim().withMessage('Name required'),
  body('color').optional().custom(isValidHexColor).withMessage('Invalid hex color'),
  body('weeklyGoalHours').optional().isFloat({ min: 0, max: 168 }).withMessage('Weekly goal must be 0-168 hours'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be non-negative integer'),
];

const updateValidation = [
  param('id').isUUID().withMessage('Invalid category ID'),
  body('name').optional().notEmpty().trim().withMessage('Name cannot be empty'),
  body('color').optional().custom(isValidHexColor).withMessage('Invalid hex color'),
  body('weeklyGoalHours').optional({ nullable: true }).isFloat({ min: 0, max: 168 }).withMessage('Weekly goal must be 0-168 hours'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be non-negative integer'),
];

// GET /api/categories - List all categories for user
router.get('/',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const categories = await prisma.category.findMany({
      where: { userId: req.user!.userId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { activities: true, timeboxes: true },
        },
      },
    });
    
    res.json({
      success: true,
      data: categories,
    });
  })
);

// GET /api/categories/:id - Get single category with activities
router.get('/:id',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const category = await prisma.category.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      include: {
        activities: {
          where: { isArchived: false },
          orderBy: [{ isFavorite: 'desc' }, { name: 'asc' }],
        },
      },
    });
    
    if (!category) {
      throw ApiError.notFound('Category not found');
    }
    
    res.json({
      success: true,
      data: category,
    });
  })
);

// POST /api/categories - Create new category
router.post('/',
  validate(createValidation),
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { name, color, weeklyGoalHours, sortOrder } = req.body as CreateCategoryRequest;
    
    // Get max sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const maxSort = await prisma.category.aggregate({
        where: { userId: req.user!.userId },
        _max: { sortOrder: true },
      });
      finalSortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    }
    
    const category = await prisma.category.create({
      data: {
        userId: req.user!.userId,
        name,
        color: color || '#6366f1',
        weeklyGoalHours,
        sortOrder: finalSortOrder,
      },
    });
    
    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created',
    });
  })
);

// PUT /api/categories/:id - Update category
router.put('/:id',
  validate(updateValidation),
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { name, color, weeklyGoalHours, sortOrder } = req.body as UpdateCategoryRequest;
    
    // Verify ownership
    const existing = await prisma.category.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });
    
    if (!existing) {
      throw ApiError.notFound('Category not found');
    }
    
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(weeklyGoalHours !== undefined && { weeklyGoalHours }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    
    res.json({
      success: true,
      data: category,
      message: 'Category updated',
    });
  })
);

// DELETE /api/categories/:id - Delete category
router.delete('/:id',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    // Verify ownership
    const existing = await prisma.category.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      include: {
        _count: {
          select: { activities: true, timeboxes: true },
        },
      },
    });
    
    if (!existing) {
      throw ApiError.notFound('Category not found');
    }
    
    // Warn if category has associated data
    if (existing._count.activities > 0 || existing._count.timeboxes > 0) {
      // Delete anyway - cascade will handle it
      // In production, might want to soft-delete or require confirmation
    }
    
    await prisma.category.delete({
      where: { id: req.params.id },
    });
    
    res.json({
      success: true,
      message: 'Category deleted',
    });
  })
);

// POST /api/categories/reorder - Batch update sort orders
router.post('/reorder',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { order } = req.body; // Array of { id, sortOrder }
    
    if (!Array.isArray(order)) {
      throw ApiError.badRequest('Order must be an array');
    }
    
    // Update all in a transaction
    await prisma.$transaction(
      order.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
        prisma.category.updateMany({
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
      message: 'Categories reordered',
    });
  })
);

export default router;
