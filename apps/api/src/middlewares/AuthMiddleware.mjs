import { LoginService } from '../services/auth/LoginService.mjs';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.query?.token || null);

    if (!token) {
      return res.status(401).json({ error: 'Please sign in' });
    }

    const user = await LoginService.validateSession(token);
    if (!user) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    req.user = {
      id: user.id,
      orgId: user.orgId,
      org_id: user.orgId,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization,
    };
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
