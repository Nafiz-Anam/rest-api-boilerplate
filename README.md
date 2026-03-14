# Production Ready REST API Boilerplate

A comprehensive, production-ready REST API boilerplate built with TypeScript, Express, Prisma, and modern best practices. This boilerplate includes authentication, real-time features, security measures, logging, and everything you need for a scalable production application.

## 🚀 Features

- **🔐 Authentication & Authorization**: JWT-based auth with role-based access control
- **🔄 Real-time Features**: WebSocket support for watchers and subscribers
- **🛡️ Security**: Comprehensive security middleware (CORS, rate limiting, helmet)
- **📊 Data Validation**: Zod schemas for robust input validation
- **📝 Logging**: Winston-based structured logging
- **🗄️ Database**: Prisma ORM with PostgreSQL
- **📄 Pagination**: Advanced pagination and sorting utilities
- **⚡ Error Handling**: Comprehensive error handling with custom error classes
- **🔧 TypeScript**: Full TypeScript support with strict typing
- **📦 Production Ready**: Environment-based configuration, health checks, graceful shutdown

## 📋 Requirements

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd productionready-rest-api-boilerplate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Configure your `.env` file:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/mydb?schema=public"
   
   # JWT
   JWT_SECRET="your-super-secret-jwt-key-here"
   JWT_EXPIRES_IN="7d"
   
   # Server
   PORT=3000
   NODE_ENV="development"
   
   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   
   # CORS
   CORS_ORIGIN="http://localhost:3000"
   
   # Logging
   LOG_LEVEL="info"
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   
   # (Optional) Open Prisma Studio
   npm run db:studio
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
src/
├── config/
│   ├── logger.ts          # Winston logger configuration
│   └── prisma.ts          # Prisma client setup
├── middleware/
│   ├── auth.ts            # Authentication middleware
│   ├── errorHandler.ts    # Error handling middleware
│   └── security.ts        # Security middleware (CORS, rate limiting)
├── services/
│   └── websocket.ts       # WebSocket service for real-time features
├── utils/
│   ├── pagination.ts      # Pagination and sorting utilities
│   └── validation.ts      # Zod validation schemas
├── routes/               # API routes (to be implemented)
├── controllers/          # Route controllers (to be implemented)
├── types/               # TypeScript type definitions
└── index.ts             # Main application entry point
```

## 🔐 Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### User Roles

- **USER**: Standard user permissions
- **MODERATOR**: Can moderate content
- **ADMIN**: Full administrative access

## 🔄 Real-time Features

The API includes WebSocket support for real-time updates:

### Connecting to WebSocket

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});

socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

// Subscribe to events
socket.emit('subscribe', {
  eventTypes: ['post_created', 'comment_added'],
  postId: 'optional-post-id'
});

// Listen for events
socket.on('event', (data) => {
  console.log('Received event:', data);
});
```

### Available Events

- `post_created`: New post created
- `post_updated`: Post updated
- `post_deleted`: Post deleted
- `comment_added`: New comment added
- `comment_updated`: Comment updated
- `user_registered`: New user registered
- `user_banned`: User banned (admin/moderator only)

## 📊 Pagination

All list endpoints support pagination:

```
GET /api/posts?page=1&limit=10&sortBy=createdAt&sortOrder=desc
```

### Response Headers

- `X-Total-Count`: Total number of items
- `X-Page-Count`: Total number of pages
- `X-Current-Page`: Current page number
- `X-Per-Page`: Items per page
- `X-Has-Next`: Whether next page exists
- `X-Has-Prev`: Whether previous page exists

## 🔒 Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request rate limiting
- **Input Validation**: Zod schema validation
- **Password Hashing**: bcrypt for secure password storage
- **JWT Tokens**: Secure authentication tokens

## 📝 API Endpoints

### Health Check
- `GET /health` - Application health status

### API Info
- `GET /api` - API information and endpoints

### WebSocket Info
- `GET /api/websocket/info` - WebSocket connection information

### Authentication (planned)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token

### Users (planned)
- `GET /api/users` - List users (paginated)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user profile
- `DELETE /api/users/:id` - Delete user

### Posts (planned)
- `GET /api/posts` - List posts (paginated)
- `POST /api/posts` - Create new post
- `GET /api/posts/:id` - Get post by ID
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

## 🛠️ Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm test` - Run tests

## 🌍 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | JWT token expiration | `7d` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `CORS_ORIGIN` | Allowed CORS origins | `http://localhost:3000` |
| `LOG_LEVEL` | Logging level | `info` |

## 🚀 Deployment

### Docker Deployment

1. **Build Docker image**
   ```bash
   docker build -t productionready-api .
   ```

2. **Run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

### Serverless Deployment

The boilerplate is structured to work with serverless platforms like Vercel or AWS Lambda. The serverless configuration can be added based on your preferred platform.

## 📊 Monitoring & Logging

- **Structured Logging**: Winston-based logging with JSON format
- **Request Logging**: HTTP request/response logging
- **Error Logging**: Comprehensive error tracking
- **Activity Logging**: User activity tracking
- **Performance Monitoring**: Request timing and performance metrics

## 🧪 Testing

The project is set up for testing with Jest:

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) - Web framework
- [Prisma](https://www.prisma.io/) - Database ORM
- [Socket.IO](https://socket.io/) - Real-time communication
- [Zod](https://zod.dev/) - Schema validation
- [Winston](https://github.com/winstonjs/winston) - Logging
- [Helmet](https://helmetjs.github.io/) - Security middleware

## 📞 Support

If you have any questions or need support, please open an issue on the GitHub repository.

---

**Built with ❤️ for modern web development**
