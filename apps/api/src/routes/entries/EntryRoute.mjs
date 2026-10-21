import { Router } from 'express';
import { EntryController } from '../../controllers/entries/EntryController.mjs';

const entryRouter = Router();

entryRouter.get('/', EntryController.getBySite);
entryRouter.post('/', EntryController.create);
entryRouter.post('/:id/void', EntryController.void);

export default entryRouter;
