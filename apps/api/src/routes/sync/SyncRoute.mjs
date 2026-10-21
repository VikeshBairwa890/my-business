import { Router } from 'express';
import { SyncController } from '../../controllers/sync/SyncController.mjs';

const syncRouter = Router();

syncRouter.get('/snapshot', SyncController.snapshot);
syncRouter.post('/commands', SyncController.command);

export default syncRouter;
