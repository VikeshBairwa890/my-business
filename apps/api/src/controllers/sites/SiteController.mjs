import { siteSchema } from '../../validation/sites/SiteValidation.mjs';
import { SiteService } from '../../services/sites/SiteService.mjs';

export class SiteController {
  static async getAll(req, res) {
    try {
      const sites = await SiteService.list(req.user.orgId);
      return res.json(sites);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const site = await SiteService.getById(req.user.orgId, req.params.id);
      return res.json(site);
    } catch (err) {
      return res.status(err.status || 404).json({ error: err.message });
    }
  }

  static async create(req, res) {
    try {
      const validated = siteSchema.parse(req.body);
      const site = await SiteService.create(req.user.orgId, validated);
      return res.status(201).json(site);
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: err.issues?.[0]?.message || 'Validation error' });
      }
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  static async update(req, res) {
    try {
      const validated = siteSchema.partial().parse(req.body);
      const site = await SiteService.update(req.user.orgId, req.params.id, validated);
      return res.json(site);
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: err.issues?.[0]?.message || 'Validation error' });
      }
      return res.status(err.status || 500).json({ error: err.message });
    }
  }
}

export default SiteController;
