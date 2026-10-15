import { z } from 'zod';

const text = z.string().trim().min(1).max(200);
const short = z.string().trim().max(300).default('');
const amount = z.number().min(0).max(99999999999);

export const workerSchema = z.object({
  name: text,
  phone: short,
  skill: text,
  dailyRate: amount.optional(),
  daily_rate: amount.optional(),
  overtimeRate: amount.optional(),
  overtime_rate: amount.optional(),
  active: z.boolean().default(true),
  photo: z.string().default(''),
});
