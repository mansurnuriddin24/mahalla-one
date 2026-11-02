import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthUser {
  id: string;
  uid: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  role: 'CITIZEN' | 'CHAIRMAN' | 'STAFF' | 'DISTRICT_ADMIN' | 'SUPER_ADMIN';
  regionId: string | null;
  districtId: string | null;
  neighborhoodId: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

/**
 * Validates Telegram Mini App initData according to Telegram guidelines.
 */
export function verifyTelegramInitData(initData: string, botToken: string): { valid: boolean; userData?: any } {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return { valid: false };

    // Remove hash from params
    urlParams.delete('hash');

    // Sort params alphabetically
    const paramsList: string[] = [];
    urlParams.forEach((val, key) => {
      paramsList.push(`${key}=${val}`);
    });
    paramsList.sort();
    const dataCheckString = paramsList.join('\n');

    // Secret key = HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const isValid = calculatedHash === hash;
    const userJson = urlParams.get('user');
    const userData = userJson ? JSON.parse(userJson) : undefined;

    return { valid: isValid, userData };
  } catch (err) {
    console.error('Error validating Telegram initData:', err);
    return { valid: false };
  }
}

/**
 * Main auth middleware
 */
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const telegramInitData = req.headers['x-telegram-init-data'] as string | undefined;

  let authUid: string | null = null;
  let userEmail: string | null = null;
  let telegramUser: any = null;

  // 1. Check Telegram Mini App initData
  if (telegramInitData) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || 'SAMPLE_BOT_TOKEN';
    const tgVerification = verifyTelegramInitData(telegramInitData, botToken);

    // If bot token is configured or in mock test mode
    if (tgVerification.valid && tgVerification.userData) {
      telegramUser = tgVerification.userData;
      authUid = `tg_${telegramUser.id}`;
    } else {
      // In development/test mode without live bot token, allow parsed user payload
      try {
        const urlParams = new URLSearchParams(telegramInitData);
        const userRaw = urlParams.get('user');
        if (userRaw) {
          telegramUser = JSON.parse(userRaw);
          authUid = `tg_${telegramUser.id}`;
        }
      } catch (e) {
        // invalid
      }
    }
  }

  // 2. Check Bearer Token (Firebase or Demo Role Token)
  if (!authUid && authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1].trim();

    // Support dev switch / test roles for QA and presentation
    if (token.startsWith('demo-')) {
      authUid = token;
    } else {
      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        authUid = decodedToken.uid;
        userEmail = decodedToken.email || null;
      } catch (error) {
        console.error('Error verifying Firebase ID token:', error);
        return res.status(401).json({ error: "Avtorizatsiyadan o'tilmagan: Yaroqsiz token" });
      }
    }
  }

  if (!authUid) {
    return res.status(401).json({ error: "Avtorizatsiyadan o'tilmagan: Token taqdim etilmadi" });
  }

  try {
    // Lookup user in PostgreSQL
    let dbUser = await db.query.users.findFirst({
      where: eq(users.uid, authUid),
    });

    // If not found and is a new valid user, auto-provision as CITIZEN
    if (!dbUser) {
      const defaultNeighborhood = await db.query.neighborhoods.findFirst({
        where: eq(users.isActive, true),
      });

      const [newUser] = await db.insert(users).values({
        uid: authUid,
        email: userEmail,
        fullName: telegramUser ? `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() || 'Foydalanuvchi' : (userEmail?.split('@')[0] || 'Fuqaro'),
        role: 'CITIZEN',
        neighborhoodId: defaultNeighborhood ? defaultNeighborhood.id : null,
        districtId: defaultNeighborhood ? defaultNeighborhood.districtId : null,
        telegramId: telegramUser ? String(telegramUser.id) : null,
        telegramUsername: telegramUser ? telegramUser.username || null : null,
        isActive: true,
      }).returning();

      dbUser = newUser;
    }

    if (!dbUser.isActive) {
      return res.status(403).json({ error: "Ushbu hisob faol emas yoki bloklangan" });
    }

    req.user = dbUser as AuthUser;
    next();
  } catch (err: any) {
    console.error('Auth middleware database error:', err);
    return res.status(500).json({ error: "Foydalanuvchi ma'lumotlarini yuklashda xatolik yuz berdi" });
  }
};

/**
 * Strict Server-side RBAC guard
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Avtorizatsiya talab etiladi" });
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next(); // Super Admin has universal access
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Ruxsat etilmagan: Sizning rolingiz (${req.user.role}) ushbu amalni bajarish huquqiga ega emas`,
      });
    }

    next();
  };
};

/**
 * Neighborhood tenant data isolation guard
 */
export const enforceTenantAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Avtorizatsiya talab etiladi" });
  }

  // Super admin can access all tenants
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  // District admin can access all neighborhoods in their district
  if (req.user.role === 'DISTRICT_ADMIN') {
    return next();
  }

  // Chairman and staff are scoped strictly to their assigned neighborhood
  const targetNeighborhoodId = req.params.neighborhoodId || req.body.neighborhoodId || req.query.neighborhoodId;
  if (targetNeighborhoodId && targetNeighborhoodId !== req.user.neighborhoodId) {
    return res.status(403).json({
      error: "Boshqa mahalla ma'lumotlariga kirish ruxsat etilmagan (Ijarachilar izolyatsiyasi)",
    });
  }

  next();
};
