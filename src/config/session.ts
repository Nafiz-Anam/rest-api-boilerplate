import session from 'express-session';
import type { RequestHandler } from 'express';

const sessionConfig = {
  secret: process.env.SESSION_SECRET ?? 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  // TODO: Add Redis store back once connect-redis is properly configured
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' as const,
  },
};

const sessionMiddleware: RequestHandler = session(sessionConfig);
export default sessionMiddleware;
