import { z } from 'zod';

const text = z.string().trim().min(1).max(200);
const short = z.string().trim().max(300).default('');
const amount = z.number().min(0).max(99999999999);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const siteSchema = z.object({
  name: text,
  ownerName: text.optional(),
  owner_name: text.optional(),
  phone: short,
  address: short,
  workType: z.enum(['LABOUR', 'MATERIAL']).optional(),
  work_type: z.enum(['LABOUR', 'MATERIAL']).optional(),
  pricing: z.enum(['FIXED', 'UNIT', 'DAILY']),
  contractAmount: amount.optional(),
  contract_amount: amount.optional(),
  quantity: z.number().positive().max(10000000).default(1),
  unit: text.default('job'),
  unitRate: amount.optional(),
  unit_rate: amount.optional(),
  remainingEstimate: amount.optional(),
  remaining_estimate: amount.optional(),
  status: z.enum(['UPCOMING', 'ONGOING', 'PAUSED', 'COMPLETED']).default('ONGOING'),
  startDate: date.optional(),
  start_date: date.optional(),
  endDate: date.nullable().optional(),
  end_date: date.nullable().optional(),
  notes: z.string().max(4000).default(''),
});
