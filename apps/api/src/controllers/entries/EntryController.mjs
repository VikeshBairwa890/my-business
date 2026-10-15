import { entrySchema } from '../../validation/entries/EntryValidation.mjs';
import { EntryService } from '../../services/entries/EntryService.mjs';

export class EntryController {
  static async getBySite(req, res) {
    try {
      const siteId = req.params.siteId || req.query.siteId;
      if (!siteId) return res.status(400).json({ error: 'Site ID is required' });
      const entries = await EntryService.listBySite(req.user.orgId, siteId);
      return res.json(entries);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  static async create(req, res) {
    try {
      const validated = entrySchema.parse(req.body);
      const entry = await EntryService.create(req.user.orgId, validated);
      return res.status(201).json(entry);
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: err.issues?.[0]?.message || 'Validation error' });
      }
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  static async void(req, res) {
    try {
      const reason = req.body?.reason || 'Voided by user';
      const entry = await EntryService.void(req.user.orgId, req.params.id, reason);
      return res.json(entry);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }
}

export default EntryController;
