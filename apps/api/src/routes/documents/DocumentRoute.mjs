import { Router } from 'express';
import { DocumentController } from '../../controllers/documents/DocumentController.mjs';

const documentRouter = Router();

documentRouter.post('/upload', DocumentController.upload);
documentRouter.get('/:id', DocumentController.download);

export default documentRouter;
