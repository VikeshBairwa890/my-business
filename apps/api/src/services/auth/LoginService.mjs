import { randomBytes } from 'node:crypto';
import prisma from '../../prisma.mjs';
import { verifyPassword, hashToken } from './password.util.mjs';

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

    return {
      token: rawToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.orgId,
        organizationName: user.organization?.name || '',
      },
    };
  }

  /**
   * Revokes session token on logout.
   */
  static async logout(rawToken) {
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);
    await prisma.session.deleteMany({
      where: { tokenHash },
    });
  }

  /**
   * Validates active session token.
   */
  static async validateSession(rawToken) {
    if (!rawToken) return null;
    const tokenHash = hashToken(rawToken);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: { organization: true },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.session.delete({ where: { tokenHash } }).catch(() => {});
      }
      return null;
    }

    return session.user;
  }
}

export default LoginService;
