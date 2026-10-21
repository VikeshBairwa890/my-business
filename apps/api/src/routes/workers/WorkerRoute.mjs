import { Router } from 'express';
import { WorkerController } from '../../controllers/workers/WorkerController.mjs';

const workerRouter = Router();

workerRouter.get('/', WorkerController.getAll);
workerRouter.get('/:id', WorkerController.getById);
workerRouter.post('/', WorkerController.create);
workerRouter.put('/:id', WorkerController.update);

export default workerRouter;
