# Development Setup Guide

This guide covers the complete setup process for the production-ready REST API with Passport.js authentication and enforced best practices.

## Prerequisites

### Required Software
- **Node.js**: >= 18.20.0 (enforced via package.json)
- **pnpm**: >= 8.0.0 (enforced via package.json)
- **PostgreSQL**: >= 14.0
- **Redis**: >= 6.0.0 (for session storage)
- **Git**: Latest version

### Recommended Tools
- **VS Code**: For TypeScript development
- **Docker Desktop**: For containerized development
- **PostgreSQL Client**: pgAdmin or DBeaver
- **Redis Client**: RedisInsight or similar

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd productionready-rest-api-boilerplate

# Install dependencies using pnpm (enforced)
pnpm install

# Or if you must use npm
npm install
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Required Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT tokens
- `JWT_REFRESH_SECRET`: Secret for refresh tokens
- `SESSION_SECRET`: Secret for session management
- `REDIS_URL`: Redis connection string

**Optional for Development:**
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: For Google OAuth
- `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET`: For GitHub OAuth

### 3. Database Setup

```bash
# Start PostgreSQL and Redis
# Using Docker:
docker-compose up -d postgresql redis

# Or install locally:
# PostgreSQL: Follow official installation guide
# Redis: Follow official installation guide
```

### 4. Database Migrations

```bash
# Generate Prisma client
pnpm run db:generate

# Run database migrations
pnpm run db:migrate

# (Optional) Open Prisma Studio
pnpm run db:studio
```

### 5. Development Server

```bash
# Start development server
pnpm run dev

# The server will start on http://localhost:3000
# Health check available at: http://localhost:3000/health
# API documentation at: http://localhost:3000/api
```

## Code Quality Tools

### ESLint Configuration
- **Config File**: `.eslintrc.js`
- **Rules**: Strict TypeScript and security rules
- **Pre-commit Hook**: Runs automatically via Husky

### Prettier Configuration
- **Config File**: `.prettierrc`
- **Integration**: Runs automatically on commit via lint-staged

### Pre-commit Hooks
- **Husky**: Git hooks management
- **lint-staged**: Runs linters and formatters on staged files
- **Commitlint**: Enforces conventional commit messages

## Development Workflow

### 1. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes
```bash
# Make your changes
# Code will be automatically formatted and linted on commit

# Run tests
pnpm test

# Run linting manually
pnpm run lint
pnpm run lint:fix
```

### 3. Commit Changes
```bash
# Stage changes
git add .

# Commit (conventional commits enforced)
git commit -m "feat: add user authentication"

# The commit will trigger:
# - ESLint checks
# - Prettier formatting
# - TypeScript compilation
# - Tests (if configured)
```

### 4. Push Changes
```bash
git push origin feature/your-feature-name
```

## Security Considerations

### Environment Security
- Never commit `.env` files
- Use environment-specific secrets
- Enable security audits: `pnpm audit`

### Database Security
- Use database migrations for schema changes
- Review SQL queries for security implications
- Use parameterized queries to prevent SQL injection

## Testing

### Unit Tests
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage
pnpm test --coverage
```

### Integration Testing
```bash
# Test API endpoints
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Test WebSocket connection
# Use WebSocket client library or browser dev tools
```

## Docker Development

### Development with Docker
```bash
# Build and run with Docker Compose
docker-compose up --build

# View logs
docker-compose logs -f api
```

### Production Considerations
- Use Docker for consistent environments
- Set proper resource limits
- Configure health checks
- Use load balancers for scalability

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>
```

#### Database Connection Issues
```bash
# Check database connection
pnpm run db:studio

# Test connection string
psql $DATABASE_URL -c "SELECT 1;"
```

#### Dependency Issues
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Use specific package manager
pnpm install --force
```

#### TypeScript Errors
```bash
# Check TypeScript compilation
npx tsc --noEmit

# Update types
pnpm run db:generate
```

## Performance Monitoring

### Development
- Use `pnpm run dev` for hot reloading
- Monitor memory usage: `node --inspect`
- Profile slow queries with Prisma

### Production
- Use APM tools (DataDog, New Relic)
- Monitor database performance
- Set up proper logging and metrics

## IDE Configuration

### VS Code Extensions
- **Prisma**: Official Prisma extension
- **TypeScript Import**: For better IntelliSense
- **ESLint**: Real-time linting
- **Prettier**: Code formatting
- **GitLens**: Enhanced Git capabilities

### VS Code Settings
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true
  }
}
```

## Best Practices

### Code Organization
- Follow the established folder structure
- Use barrel exports for clean imports
- Keep components small and focused
- Use TypeScript interfaces for type safety

### Security Best Practices
- Validate all inputs
- Use parameterized queries
- Implement proper authentication and authorization
- Keep dependencies updated
- Use HTTPS in production

### Performance Best Practices
- Use database indexes appropriately
- Implement caching where beneficial
- Optimize bundle size
- Use connection pooling

This setup ensures code quality, security, and maintainability throughout the development lifecycle.
