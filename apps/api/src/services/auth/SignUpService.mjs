import { randomBytes } from 'node:crypto';
import prisma from '../../prisma.mjs';
import { hashPassword, hashToken } from './password.util.mjs';

export class SignUpService {
  /**
   * Registers a new contractor organization and owner account.
   */
  static async register({ name, organization, email, password, phone = '' }) {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      const error = new Error('An account with this email already exists.');
      error.status = 409;
      throw error;
    }

    // 2. Hash password securely
    const passwordHash = await hashPassword(password);

    // 3. Atomically create Organization, User, and Initial Session
    return await prisma.$transaction(async (tx) => {
      // Create Organization
      const org = await tx.organization.create({
        data: {
          name: organization.trim(),
          phone: phone ? phone.trim() : '',
        },
      });

      // Create Owner User
      const user = await tx.user.create({
        data: {
          orgId: org.id,
          name: name.trim(),
          email: normalizedEmail,
          phone: phone ? phone.trim() : '',
          passwordHash,
          role: 'OWNER',
        },
      });

      // Create 30-day Session Token
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await tx.session.create({
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
          phone: user.phone || '',
          avatar: user.avatar || '',
          role: user.role,
          orgId: org.id,
          organizationName: org.name,
        },
      };
    });
  }
}

export default SignUpService;
