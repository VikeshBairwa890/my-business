import { randomBytes } from 'node:crypto';
import prisma from '../../prisma.mjs';
import { verifyPassword, hashToken } from './password.util.mjs';

// In-memory cache for fast session verification across requests
const sessionCache = new Map();
const SESSION_CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

export class LoginService {
  /**
   * Authenticates user credentials and issues a new session token.
   */
  static async login({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { organization: true },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      const error = new Error('Email or password is incorrect.');
      error.status = 401;
      throw error;
    }

    if (!user.active) {
      const error = new Error('Your account has been deactivated. Please contact support.');
      error.status = 403;
      throw error;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    const userInfo = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      avatar: user.avatar || '',
      role: user.role,
      orgId: user.orgId,
      organizationName: user.organization?.name || '',
    };

    // Pre-populate session cache
    sessionCache.set(tokenHash, {
      user: {
        ...user,
        organization: user.organization,
      },
      expiresAt,
      cachedAt: Date.now(),
    });

    return {
      token: rawToken,
      user: userInfo,
    };
  }

  /**
   * Revokes session token on logout.
   */
  static async logout(rawToken) {
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);
    sessionCache.delete(tokenHash);
    await prisma.session.deleteMany({
      where: { tokenHash },
    });
  }

  /**
   * Invalidates cached session (e.g. after profile/org update)
   */
  static invalidateSessionCache(rawToken) {
    if (!rawToken) return;
    sessionCache.delete(hashToken(rawToken));
  }

  /**
   * Validates active session token with in-memory caching to eliminate remote DB latency.
   */
  static async validateSession(rawToken) {
    if (!rawToken) return null;
    const tokenHash = hashToken(rawToken);

    const now = Date.now();
    const cached = sessionCache.get(tokenHash);
    if (cached && (now - cached.cachedAt) < SESSION_CACHE_TTL_MS && cached.expiresAt > new Date()) {
      return cached.user;
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: { organization: true },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      sessionCache.delete(tokenHash);
      if (session) {
        await prisma.session.delete({ where: { tokenHash } }).catch(() => { });
      }
      return null;
    }

    sessionCache.set(tokenHash, {
      user: session.user,
      expiresAt: session.expiresAt,
      cachedAt: now,
    });

    return session.user;
  }
}

export default LoginService;
