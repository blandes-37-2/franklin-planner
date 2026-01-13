import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import prisma from '../utils/prisma';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { AuthRequest, ApiResponse, CreateActivityRequest, UpdateActivityRequest } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation rules
const createValidation = [
  body('categoryId').isUUID().withMessage('Valid category ID required'),
  body('name').notEmpty().trim().withMessage('Name required'),
  body('notes').optional().isString(),
  body('isFavorite').optional().isBoolean(),
];

const updateValidation = [
  param('id').isUUID().withMessage('Invalid activity ID'),
  body('categoryId').optional().isUUID().withMessage('Valid category ID required'),
  body('name').optional().notEmpty().trim().withMessage('Name cannot be empty'),
  body('notes').optional({ nullable: true }).isString(),
  body('isArchived').optional().isBoolean(),
  body('isFavorite').optional().isBoolean(),
];

// GET /api/activities - List activities for user
router.get('/',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { categoryId, includeArchived } = req.query;
    
    const activities = await prisma.activity.findMany({
      where: {
        userId: req.user!.userId,
        ...(categoryId && { categoryId: categoryId as string }),
        ...(includeArchived !== 'true' && { isArchived: false }),
      },
      orderBy: [{ isFavorite: 'desc' }, { name: 'asc' }],
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });
    
    res.json({
      success: true,
      data: activities,
    });
  })
);

// GET /api/activities/favorites - List favorite activities
router.get('/favorites',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const activities = await prisma.activity.findMany({
      where: {
        userId: req.user!.userId,
        isFavorite: true,
        isArchived: false,
      },
      orderBy: { name: 'asc' },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });
    
    res.json({
      success: true,
      data: activities,
    });
  })
);

// GET /api/activities/:id - Get single activity
router.get('/:id',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const activity = await prisma.activity.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });
    
    if (!activity) {
      throw ApiError.notFound('Activity not found');
    }
    
    res.json({
      success: true,
      data: activity,
    });
  })
);

// POST /api/activities - Create new activity
router.post('/',
  validate(createValidation),
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { categoryId, name, notes, isFavorite } = req.body as CreateActivityRequest;
    
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
    
    const activity = await prisma.activity.create({
      data: {
        userId: req.user!.userId,
        categoryId,
        name,
        notes,
        isFavorite: isFavorite || false,
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });
    
    res.status(201).json({
      success: true,
      data: activity,
      message: 'Activity created',
    });
  })
);

// PUT /api/activities/:id - Update activity
router.put('/:id',
  validate(updateValidation),
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { categoryId, name, notes, isArchived, isFavorite } = req.body as UpdateActivityRequest;
    
    // Verify ownership
    const existing = await prisma.activity.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });
    
    if (!existing) {
      throw ApiError.notFound('Activity not found');
    }
    
    // If changing category, verify new category belongs to user
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
    
    const activity = await prisma.activity.update({
      where: { id: req.params.id },
      data: {
        ...(categoryId !== undefined && { categoryId }),
        ...(name !== undefined && { name }),
        ...(notes !== undefined && { notes }),
        ...(isArchived !== undefined && { isArchived }),
        ...(isFavorite !== undefined && { isFavorite }),
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });
    
    res.json({
      success: true,
      data: activity,
      message: 'Activity updated',
    });
  })
);

// DELETE /api/activities/:id - Delete activity (or archive)
router.delete('/:id',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { permanent } = req.query;
    
    // Verify ownership
    const existing = await prisma.activity.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });
    
    if (!existing) {
      throw ApiError.notFound('Activity not found');
    }
    
    if (permanent === 'true') {
      // Permanent delete
      await prisma.activity.delete({
        where: { id: req.params.id },
      });
      
      res.json({
        success: true,
        message: 'Activity permanently deleted',
      });
    } else {
      // Soft delete (archive)
      await prisma.activity.update({
        where: { id: req.params.id },
        data: { isArchived: true },
      });
      
      res.json({
        success: true,
        message: 'Activity archived',
      });
    }
  })
);

// POST /api/activities/:id/restore - Restore archived activity
router.post('/:id/restore',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const activity = await prisma.activity.updateMany({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
        isArchived: true,
      },
      data: { isArchived: false },
    });
    
    if (activity.count === 0) {
      throw ApiError.notFound('Archived activity not found');
    }
    
    res.json({
      success: true,
      message: 'Activity restored',
    });
  })
);

// POST /api/activities/:id/toggle-favorite - Toggle favorite status
router.post('/:id/toggle-favorite',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    // Get current state
    const activity = await prisma.activity.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });
    
    if (!activity) {
      throw ApiError.notFound('Activity not found');
    }
    
    // Toggle
    const updated = await prisma.activity.update({
      where: { id: req.params.id },
      data: { isFavorite: !activity.isFavorite },
    });
    
    res.json({
      success: true,
      data: updated,
      message: updated.isFavorite ? 'Added to favorites' : 'Removed from favorites',
    });
  })
);

export default router;
