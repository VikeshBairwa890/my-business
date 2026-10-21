import { workerSchema } from '../../validation/workers/WorkerValidation.mjs';
import { WorkerService } from '../../services/workers/WorkerService.mjs';

export class WorkerController {
  static async getAll(req, res) {
    try {
      const workers = await WorkerService.list(req.user.orgId);
      return res.json(workers);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const worker = await WorkerService.getById(req.user.orgId, req.params.id);
      return res.json(worker);
    } catch (err) {
      return res.status(err.status || 404).json({ error: err.message });
    }
  }

  static async create(req, res) {
    try {
      const validated = workerSchema.parse(req.body);
      const worker = await WorkerService.create(req.user.orgId, validated);
      return res.status(201).json(worker);
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: err.issues?.[0]?.message || 'Validation error' });
      }
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  static async update(req, res) {
    try {
      const validated = workerSchema.partial().parse(req.body);
      const worker = await WorkerService.update(req.user.orgId, req.params.id, validated);
      return res.json(worker);
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: err.issues?.[0]?.message || 'Validation error' });
      }
      return res.status(err.status || 500).json({ error: err.message });
    }
  }
}

export default WorkerController;
