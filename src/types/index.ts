import { Request } from 'express';

// Extend Express Request to include authenticated user
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  timezone?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
}

// Category types
export interface CreateCategoryRequest {
  name: string;
  color?: string;
  weeklyGoalHours?: number;
  sortOrder?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  color?: string;
  weeklyGoalHours?: number | null;
  sortOrder?: number;
}

// Activity types
export interface CreateActivityRequest {
  categoryId: string;
  name: string;
  notes?: string;
  isFavorite?: boolean;
}

export interface UpdateActivityRequest {
  categoryId?: string;
  name?: string;
  notes?: string;
  isArchived?: boolean;
  isFavorite?: boolean;
}

// Timebox types
export interface CreateTimeboxRequest {
  categoryId: string;
  defaultActivityId?: string;
  startTime: string; // "HH:mm" format
  endTime: string;
  dayOfWeek?: number | null; // 0-6 or null for all days
  sortOrder?: number;
}

export interface UpdateTimeboxRequest {
  categoryId?: string;
  defaultActivityId?: string | null;
  startTime?: string;
  endTime?: string;
  dayOfWeek?: number | null;
  isActive?: boolean;
  sortOrder?: number;
}

// Daily Plan types
export interface CreateDailyPlanRequest {
  date: string; // "YYYY-MM-DD" format
}

export interface UpdateDailyPlanRequest {
  overallRating?: number | null;
  notes?: string | null;
}

// Planned Block types
export interface UpdatePlannedBlockRequest {
  plannedActivityId?: string | null;
  actualActivityId?: string | null;
  deviationReason?: string | null;
  deviationNotes?: string | null;
  isCompleted?: boolean;
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface CheckInRequest {
  actualActivityId?: string | null;
  deviationReason?: string | null;
  deviationNotes?: string | null;
  isCompleted?: boolean;
}

// Insights types
export interface InsightsSummary {
  totalPlannedBlocks: number;
  completedBlocks: number;
  deviatedBlocks: number;
  adherenceRate: number;
  averageRating: number | null;
  categoryBreakdown: CategoryInsight[];
  deviationReasons: DeviationBreakdown[];
  streaks: StreakData;
}

export interface CategoryInsight {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  plannedHours: number;
  actualHours: number;
  adherenceRate: number;
  goalHours: number | null;
  goalProgress: number | null;
}

export interface DeviationBreakdown {
  reason: string;
  count: number;
  percentage: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
}

// User settings type
export interface UserSettings {
  dailyReviewTime?: string; // "HH:mm" format, default "21:00"
  weekStartsOn?: number; // 0 = Sunday, 1 = Monday
  enableNotifications?: boolean;
  notificationTime?: string;
}
