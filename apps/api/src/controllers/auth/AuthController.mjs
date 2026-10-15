import { signUpSchema, loginSchema } from '../../validation/auth/AuthValidation.mjs';
import { SignUpService } from '../../services/auth/SignUpService.mjs';
import { LoginService } from '../../services/auth/LoginService.mjs';

/**
 * AuthController
 * Handles incoming HTTP requests, validates inputs, and calls dedicated services.
 */
export class AuthController {
  /**
   * POST /auth/register
   * Registers a new contractor organization and owner account.
   */
  static async register(req, res) {
    try {
      const validatedData = signUpSchema.parse(req.body);
      const result = await SignUpService.register(validatedData);
      return res.status(201).json(result);
    } catch (error) {
      if (error.name === 'ZodError') {
        const message = error.issues?.[0]?.message || 'Validation error';
        return res.status(400).json({ error: message });
      }
      return res.status(error.status || 500).json({ error: error.message || 'Registration failed' });
    }
  }

  /**
   * POST /auth/login
   * Authenticates user with email and password.
   */
  static async login(req, res) {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await LoginService.login(validatedData);
      return res.status(200).json(result);
    } catch (error) {
      if (error.name === 'ZodError') {
        const message = error.issues?.[0]?.message || 'Validation error';
        return res.status(400).json({ error: message });
      }
      return res.status(error.status || 401).json({ error: error.message || 'Login failed' });
    }
  }

  /**
   * POST /auth/logout
   * Revokes the current session token.
   */
  static async logout(req, res) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (token) {
        await LoginService.logout(token);
      }

      return res.status(200).json({ ok: true, message: 'Logged out successfully' });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Logout failed' });
    }
  }
}

export default AuthController;
