import { z } from 'zod';

const id = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const short = z.string().trim().max(300).default('');

export const attendanceSchema = z.object({
  siteId: id.optional(),
  site_id: id.optional(),
  workerId: id.optional(),
  worker_id: id.optional(),
  date,
  units: z.union([z.literal(0), z.literal(0.5), z.literal(1), z.literal(1.5)]),
  overtimeMinutes: z.number().int().min(0).max(960).optional(),
  overtime_minutes: z.number().int().min(0).max(960).optional(),
  notes: short,
});
