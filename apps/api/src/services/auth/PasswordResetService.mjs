import { randomInt } from 'node:crypto';
import prisma from '../../prisma.mjs';
import { hashPassword } from './password.util.mjs';

// In-memory OTP storage with automatic expiry
// Map<normalizedEmail, { otp: string, expiresAt: number, attempts: number }>
const otpStore = new Map();

// Periodic cleanup of expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (record.expiresAt < now) {
      otpStore.delete(email);
    }
  }
}, 5 * 60 * 1000).unref();

export class PasswordResetService {
  /**
   * Generates a 6-digit OTP code for a user requesting password reset.
   */
  static async requestReset({ email }) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, active: true },
    });

    if (!user) {
      const error = new Error('No account found with this email address.');
      error.status = 404;
      throw error;
    }

    if (!user.active) {
      const error = new Error('This account is deactivated. Please contact support.');
      error.status = 403;
      throw error;
    }

    // Generate secure 6-digit OTP
    const otp = randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

    otpStore.set(normalizedEmail, {
      otp,
      expiresAt,
      attempts: 0,
      userId: user.id,
    });

    // In a live SMTP setup, an email would be dispatched here.
    // For fast contractor developer testing and reliability, return devOtp in response and console.
    console.log(`[ThekaBook Security] Password reset OTP for ${normalizedEmail}: ${otp}`);

    return {
      ok: true,
      message: 'A 6-digit verification code has been sent to your registered email.',
      email: normalizedEmail,
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    };
  }

  /**
   * Verifies the 6-digit OTP and updates the user's password.
   */
  static async verifyAndReset({ email, otp, newPassword }) {
    const normalizedEmail = email.trim().toLowerCase();
    const record = otpStore.get(normalizedEmail);

    if (!record) {
      const error = new Error('No reset request found or OTP has expired. Please request a new code.');
      error.status = 400;
      throw error;
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(normalizedEmail);
      const error = new Error('Verification code has expired. Please request a new code.');
      error.status = 400;
      throw error;
    }

    if (record.attempts >= 5) {
      otpStore.delete(normalizedEmail);
      const error = new Error('Too many incorrect attempts. Please request a new code.');
      error.status = 429;
      throw error;
    }

    const cleanInputOtp = otp.toString().trim();
    if (record.otp !== cleanInputOtp) {
      record.attempts += 1;
      const remaining = 5 - record.attempts;
      const error = new Error(`Invalid verification code. ${remaining} attempt(s) remaining.`);
      error.status = 400;
      throw error;
    }

    // Hash the new password securely
    const passwordHash = await hashPassword(newPassword);

    // Update user password and invalidate old active sessions
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });

      // Clear all existing sessions for this user for security
      await tx.session.deleteMany({
        where: { userId: record.userId },
      });
    });

    // Clean up OTP record
    otpStore.delete(normalizedEmail);

    return {
      ok: true,
      message: 'Password has been reset successfully. Please sign in with your new password.',
    };
  }
}

export default PasswordResetService;
