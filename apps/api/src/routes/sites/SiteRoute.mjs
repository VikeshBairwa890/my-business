import { Router } from 'express';
import { SiteController } from '../../controllers/sites/SiteController.mjs';

const siteRouter = Router();

siteRouter.get('/', SiteController.getAll);
siteRouter.get('/:id', SiteController.getById);
siteRouter.post('/', SiteController.create);
siteRouter.put('/:id', SiteController.update);

export default siteRouter;
