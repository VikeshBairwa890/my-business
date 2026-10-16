import { z } from 'zod';

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  organization: z.string().trim().min(1, 'Business or firm name is required').max(150),
  email: z.string().trim().email('Invalid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters long').max(128),
  phone: z.string().trim().max(20).optional().default(''),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(254),
  password: z.string().min(1, 'Password is required').max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Please enter a valid registered email address').max(254),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(254),
  otp: z.string().trim().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long').max(128),
});
