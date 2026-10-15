import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AuthController } from '../../controllers/auth/AuthController.mjs';

const authRouter = Router();

// Rate limiter for authentication to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
});

// Clean Express Route Mapping
authRouter.post('/register', authLimiter, AuthController.register);
authRouter.post('/login', authLimiter, AuthController.login);
authRouter.post('/logout', AuthController.logout);

export default authRouter;
