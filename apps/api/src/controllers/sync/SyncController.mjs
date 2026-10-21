import { z } from 'zod';
import { SyncService } from '../../services/sync/SyncService.mjs';

const commandSchema = z.object({
  key: z.string().uuid(),
  action: z.enum([
    'site.create',
    'site.update',
    'worker.create',
    'worker.update',
    'attendance.save',
    'entry.create',
    'entry.void',
    'profile.update',
  ]),
  entity_id: z.string().uuid().optional(),
  data: z.record(z.string(), z.unknown()),
}).strict();

export class SyncController {
  static async snapshot(req, res) {
    try {
      const data = await SyncService.getSnapshot(req.user.orgId, req.user.id);
      return res.json(data);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  static async command(req, res) {
    try {
      const validated = commandSchema.parse(req.body);
      const result = await SyncService.executeCommand(req.user.orgId, req.user.id, validated);
      return res.json(result);
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: err.issues?.[0]?.message || 'Validation error' });
      }
      return res.status(err.status || 500).json({ error: err.message });
    }
  }
}

export default SyncController;
