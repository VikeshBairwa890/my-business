import { Router } from 'express';
import { ReportController } from '../../controllers/reports/ReportController.mjs';

const reportRouter = Router();

reportRouter.get('/worker/:workerId', ReportController.getWorkerReport);

export default reportRouter;
