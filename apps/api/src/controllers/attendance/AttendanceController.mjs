import { attendanceSchema } from '../../validation/attendance/AttendanceValidation.mjs';
import { AttendanceService } from '../../services/attendance/AttendanceService.mjs';

export class AttendanceController {
  static async getByDate(req, res) {
    try {
      const date = req.query.date || new Date().toISOString().slice(0, 10);
      const records = await AttendanceService.listByDate(req.user.orgId, date);
      return res.json(records);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  static async save(req, res) {
    try {
      const validated = attendanceSchema.parse(req.body);
      const record = await AttendanceService.save(req.user.orgId, validated);
      return res.status(200).json(record);
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: err.issues?.[0]?.message || 'Validation error' });
      }
      return res.status(err.status || 500).json({ error: err.message });
    }
  }
}

export default AttendanceController;
