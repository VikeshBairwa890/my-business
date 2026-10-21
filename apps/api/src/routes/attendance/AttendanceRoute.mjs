import { Router } from 'express';
import { AttendanceController } from '../../controllers/attendance/AttendanceController.mjs';

const attendanceRouter = Router();

attendanceRouter.get('/', AttendanceController.getByDate);
attendanceRouter.post('/', AttendanceController.save);

export default attendanceRouter;
