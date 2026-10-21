import { Router } from 'express';
import authRouter from './auth/AuthRoute.mjs';
import reportRouter from './reports/ReportRoute.mjs';
import siteRouter from './sites/SiteRoute.mjs';
import workerRouter from './workers/WorkerRoute.mjs';
import attendanceRouter from './attendance/AttendanceRoute.mjs';
import entryRouter from './entries/EntryRoute.mjs';
import documentRouter from './documents/DocumentRoute.mjs';
import syncRouter from './sync/SyncRoute.mjs';
import { requireAuth } from '../middlewares/AuthMiddleware.mjs';

const apiRouter = Router();

// Public Endpoints
apiRouter.use('/auth', authRouter);
apiRouter.use('/report', reportRouter);

// Authenticated Endpoints
apiRouter.use(requireAuth);
apiRouter.use('/', syncRouter);
apiRouter.use('/sites', siteRouter);
apiRouter.use('/workers', workerRouter);
apiRouter.use('/attendance', attendanceRouter);
apiRouter.use('/entries', entryRouter);
apiRouter.use('/documents', documentRouter);

export default apiRouter;
