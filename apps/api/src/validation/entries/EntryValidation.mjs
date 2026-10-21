import { z } from 'zod';

const id = z.string().uuid();
const text = z.string().trim().min(1).max(200);
const short = z.string().trim().max(300).default('');
const amount = z.number().positive().max(99999999999);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const entrySchema = z.object({
  siteId: id.optional(),
  site_id: id.optional(),
  workerId: id.nullable().optional(),
  worker_id: id.nullable().optional(),
  supplierId: id.nullable().optional(),
  supplier_id: id.nullable().optional(),
  kind: z.enum(['RECEIPT', 'WAGE_PAYMENT', 'MATERIAL', 'EXPENSE', 'EXTRA', 'SUPPLIER_PAYMENT']),
  date,
  amount,
  description: text,
  party: short,
  mode: z.enum(['CASH', 'UPI', 'BANK', 'RECORD']).default('CASH'),
  reference: short,
  dueDate: date.nullable().optional(),
  due_date: date.nullable().optional(),
  linkedEntryId: id.nullable().optional(),
  linked_entry_id: id.nullable().optional(),
  quantity: z.number().positive().max(10000000).nullable().optional(),
  unit: short.optional(),
});
