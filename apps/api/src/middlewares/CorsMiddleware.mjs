import cors from 'cors';

const allowed = (process.env.CORS_ORIGINS || 'http://localhost:8081,http://localhost:19006')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export const corsMiddleware = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowed.includes(origin)) return cb(null, true);
    try {
      const u = new URL(origin);
      if (
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.hostname === '::1' ||
        u.hostname.endsWith('.local') ||
        !u.hostname.includes('.') ||
        /^192\.168\.\d+\.\d+$/.test(u.hostname) ||
        /^10\.\d+\.\d+\.\d+$/.test(u.hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(u.hostname)
      ) {
        return cb(null, true);
      }
    } catch { }
    if (!process.env.CORS_ORIGINS) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
});

export default corsMiddleware;
