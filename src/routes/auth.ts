import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import prisma from '../utils/prisma';
import { createTokenPair, refreshAccessToken, revokeRefreshToken, revokeAllUserTokens } from '../utils/jwt';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { AuthRequest, ApiResponse, LoginRequest, RegisterRequest, TokenPair } from '../types';

const router = Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').optional().isString().trim(),
  body('timezone').optional().isString(),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

// POST /api/auth/register
router.post('/register',
  validate(registerValidation),
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse<{ user: any; tokens: TokenPair }>>) => {
    const { email, password, name, timezone } = req.body as RegisterRequest;
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw ApiError.conflict('Email already registered');
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        timezone: timezone || 'America/New_York',
      },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        createdAt: true,
      },
    });
    
    // Generate tokens
    const tokens = await createTokenPair(user.id, user.email);
    
    res.status(201).json({
      success: true,
      data: { user, tokens },
      message: 'Registration successful',
    });
  })
);

// POST /api/auth/login
router.post('/login',
  validate(loginValidation),
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse<{ user: any; tokens: TokenPair }>>) => {
    const { email, password } = req.body as LoginRequest;
    
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    
    // Generate tokens
    const tokens = await createTokenPair(user.id, user.email);
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          timezone: user.timezone,
        },
        tokens,
      },
      message: 'Login successful',
    });
  })
);

// POST /api/auth/refresh
router.post('/refresh',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse<TokenPair>>) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw ApiError.badRequest('Refresh token required');
    }
    
    const tokens = await refreshAccessToken(refreshToken);
    if (!tokens) {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }
    
    res.json({
      success: true,
      data: tokens,
    });
  })
);

// POST /api/auth/logout
router.post('/logout',
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

// POST /api/auth/logout-all (requires auth)
router.post('/logout-all',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    await revokeAllUserTokens(req.user!.userId);
    
    res.json({
      success: true,
      message: 'Logged out from all devices',
    });
  })
);

// GET /api/auth/me (requires auth)
router.get('/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        settings: true,
        createdAt: true,
      },
    });
    
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    
    res.json({
      success: true,
      data: user,
    });
  })
);

// PUT /api/auth/me (requires auth)
router.put('/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response<ApiResponse>) => {
    const { name, timezone, settings } = req.body;
    
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(timezone !== undefined && { timezone }),
        ...(settings !== undefined && { settings }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        settings: true,
        createdAt: true,
      },
    });
    
    res.json({
      success: true,
      data: user,
    });
  })
);

export default router;
