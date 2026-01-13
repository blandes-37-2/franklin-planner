import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JwtPayload, TokenPair } from '../types';
import prisma from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export function generateAccessToken(payload: JwtPayload): string {
  // @ts-ignore - expiresIn accepts string but types are incorrect
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function createTokenPair(userId: string, email: string): Promise<TokenPair> {
  const accessToken = generateAccessToken({ userId, email });
  const refreshToken = generateRefreshToken();
  
  // Calculate refresh token expiration
  const expiresAt = new Date();
  const daysMatch = JWT_REFRESH_EXPIRES_IN.match(/(\d+)d/);
  if (daysMatch) {
    expiresAt.setDate(expiresAt.getDate() + parseInt(daysMatch[1]));
  } else {
    expiresAt.setDate(expiresAt.getDate() + 7); // Default 7 days
  }
  
  // Store refresh token in database
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt,
    },
  });
  
  return { accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenPair | null> {
  // Find the refresh token
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });
  
  if (!storedToken) {
    return null;
  }
  
  // Check if expired
  if (storedToken.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    return null;
  }
  
  // Delete old token and create new pair
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });
  
  return createTokenPair(storedToken.userId, storedToken.user.email);
}

export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  try {
    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    return true;
  } catch {
    return false;
  }
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}
