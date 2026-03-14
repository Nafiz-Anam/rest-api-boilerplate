import * as passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { prisma } from './prisma';
import * as bcrypt from 'bcryptjs';
import logger from './logger';

// JWT Strategy options
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET!,
  issuer: 'productionready-api',
  audience: 'productionready-api-users',
};

// Local Strategy options
const localOptions = {
  usernameField: 'email',
  passwordField: 'password',
  session: false,
};

// Google OAuth Strategy options
const googleOptions = {
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL:
    process.env.GOOGLE_CALLBACK_URL ||
    'http://localhost:3000/api/auth/google/callback',
};

// GitHub OAuth Strategy options
const githubOptions = {
  clientID: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  callbackURL:
    process.env.GITHUB_CALLBACK_URL ||
    'http://localhost:3000/api/auth/github/callback',
};

// JWT Strategy
passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          firstName: true,
          lastName: true,
          avatar: true,
        },
      });

      if (!user || !user.isActive) {
        return done(null, false);
      }

      return done(null, user);
    } catch (error) {
      logger.error('JWT Strategy Error:', error);
      return done(error, false);
    }
  })
);

// Local Strategy (username/password)
passport.use(
  new LocalStrategy(localOptions, async (email, password, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          password: true,
        },
      });

      if (!user) {
        return done(null, false, { message: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return done(null, false, { message: 'Account is inactive' });
      }

      const isPasswordValid = await bcrypt.compare(
        password,
        user.password || ''
      );
      if (!isPasswordValid) {
        return done(null, false, { message: 'Invalid credentials' });
      }

      // Remove password from user object
      const { password: _, ...userWithoutPassword } = user;

      return done(null, userWithoutPassword);
    } catch (error) {
      logger.error('Local Strategy Error:', error);
      return done(error);
    }
  })
);

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    googleOptions,
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists with Google ID
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { googleId: profile.id },
              { email: profile.emails?.[0]?.value },
            ],
          },
        });

        if (user) {
          // Update Google ID if not present
          if (!user.googleId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { googleId: profile.id },
            });
          }
          return done(null, user);
        }

        // Create new user
        const newUser = await prisma.user.create({
          data: {
            email: profile.emails?.[0]?.value || '',
            username:
              profile.displayName ||
              profile.emails?.[0]?.value?.split('@')[0] ||
              '',
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            avatar: profile.photos?.[0]?.value || '',
            googleId: profile.id,
            isActive: true,
            role: 'USER', // Default role for social auth users
          },
        });

        logger.info(`New user created via Google OAuth: ${newUser.email}`);
        return done(null, newUser);
      } catch (error) {
        logger.error('Google Strategy Error:', error);
        return done(error);
      }
    }
  )
);

// GitHub OAuth Strategy
passport.use(
  new GitHubStrategy(
    githubOptions,
    async (
      accessToken: string,
      refreshToken: string,
      profile: any,
      done: any
    ) => {
      try {
        // Check if user already exists with GitHub ID
        let user = await prisma.user.findFirst({
          where: {
            OR: [{ githubId: profile.id }, { email: profile.email }],
          },
        });

        if (user) {
          // Update GitHub ID if not present
          if (!user.githubId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { githubId: profile.id },
            });
          }
          return done(null, user);
        }

        // Create new user
        const newUser = await prisma.user.create({
          data: {
            email: profile.email || '',
            username: profile.username || profile.login || '',
            firstName: profile.name?.split(' ')[0] || '',
            lastName: profile.name?.split(' ')[1] || '',
            avatar: profile.photos?.[0]?.value || '',
            githubId: profile.id,
            isActive: true,
            role: 'USER', // Default role for social auth users
          },
        });

        logger.info(`New user created via GitHub OAuth: ${newUser.email}`);
        return done(null, newUser);
      } catch (error) {
        logger.error('GitHub Strategy Error:', error);
        return done(error);
      }
    }
  )
);

// Serialization and deserialization
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        firstName: true,
        lastName: true,
        avatar: true,
      },
    });

    done(null, user || false);
  } catch (error) {
    logger.error('Deserialize User Error:', error);
    done(error, false);
  }
});

// Helper functions for authentication
export const authenticateJWT = passport.authenticate('jwt', { session: false });
export const authenticateLocal = passport.authenticate('local', {
  session: false,
});
export const authenticateGoogle = passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
});
export const authenticateGitHub = passport.authenticate('github', {
  scope: ['user:email'],
  session: false,
});

// Role-based authorization middleware
export const authorize = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };
};

// Optional authentication middleware
export const optionalAuth = (req: any, res: any, next: any) => {
  passport.authenticate(
    'jwt',
    { session: false },
    (err: any, user: any, info: any) => {
      if (user) {
        req.user = user;
      }
      next();
    }
  )(req, res, next);
};

export default passport;
