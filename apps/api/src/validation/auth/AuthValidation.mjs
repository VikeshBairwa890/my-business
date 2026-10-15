import { z } from 'zod';

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  organization: z.string().trim().min(1, 'Business or firm name is required').max(150),
  email: z.string().trim().email('Invalid email address').max(254),
  password: z.string().min(10, 'Password must be at least 10 characters long').max(128),
  phone: z.string().trim().max(20).optional().default(''),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(254),
  password: z.string().min(1, 'Password is required').max(128),
});
