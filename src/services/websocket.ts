import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/prisma';
import logger from '../config/logger';

export interface SocketUser {
  id: string;
  email: string;
  username: string;
  role: string;
  socketId: string;
  connectedAt: Date;
}

export interface WatchSubscription {
  userId: string;
  postId?: string;
  eventType: string;
  socketId: string;
}

class WebSocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, SocketUser> = new Map();
  private subscriptions: Map<string, WatchSubscription[]> = new Map();

  initialize(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || [
          'http://localhost:3000',
        ],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Authentication middleware for Socket.IO
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);

        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            isActive: true,
          },
        });

        if (!user || !user.isActive) {
          return next(new Error('Invalid or inactive user'));
        }

        socket.data.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', socket => {
      const user = socket.data.user as SocketUser;

      // Store connected user
      const socketUser: SocketUser = {
        ...user,
        socketId: socket.id,
        connectedAt: new Date(),
      };

      this.connectedUsers.set(socket.id, socketUser);
      this.subscriptions.set(socket.id, []);

      logger.info(`User connected: ${user.username} (${socket.id})`);

      // Join user to their personal room
      socket.join(`user:${user.id}`);

      // Send welcome message
      socket.emit('connected', {
        message: 'Successfully connected to real-time updates',
        userId: user.id,
        socketId: socket.id,
      });

      // Handle subscription to events
      socket.on(
        'subscribe',
        async (data: { postId?: string; eventTypes: string[] }) => {
          try {
            const { postId, eventTypes } = data;
            const userSubscriptions = this.subscriptions.get(socket.id) || [];

            for (const eventType of eventTypes) {
              // Check if user is allowed to subscribe to this event
              if (this.canSubscribe(user, eventType, postId)) {
                const subscription: WatchSubscription = {
                  userId: user.id,
                  postId,
                  eventType,
                  socketId: socket.id,
                };

                userSubscriptions.push(subscription);

                // Join socket to appropriate room
                const roomName = postId ? `${eventType}:${postId}` : eventType;
                socket.join(roomName);

                // Store in database for persistence
                if (postId) {
                  await prisma.watcher.upsert({
                    where: {
                      userId_postId_eventType: {
                        userId: user.id,
                        postId,
                        eventType,
                      },
                    },
                    update: { isActive: true },
                    create: {
                      userId: user.id,
                      postId,
                      eventType,
                    },
                  });
                } else {
                  // Handle global event subscriptions without postId
                  await prisma.watcher.upsert({
                    where: {
                      userId_postId_eventType: {
                        userId: user.id,
                        postId: '', // Empty string for global events
                        eventType,
                      },
                    },
                    update: { isActive: true },
                    create: {
                      userId: user.id,
                      postId: '', // Empty string for global events
                      eventType,
                    },
                  });
                }

                logger.info(
                  `User ${user.username} subscribed to ${eventType}${postId ? ` for post ${postId}` : ''}`
                );
              }
            }

            this.subscriptions.set(socket.id, userSubscriptions);

            socket.emit('subscribed', {
              eventTypes,
              postId,
              message: 'Successfully subscribed to events',
            });
          } catch (error) {
            logger.error('Error handling subscription:', error);
            socket.emit('error', { message: 'Failed to subscribe to events' });
          }
        }
      );

      // Handle unsubscription from events
      socket.on(
        'unsubscribe',
        async (data: { postId?: string; eventTypes: string[] }) => {
          try {
            const { postId, eventTypes } = data;
            const userSubscriptions = this.subscriptions.get(socket.id) || [];

            for (const eventType of eventTypes) {
              // Remove from memory
              const index = userSubscriptions.findIndex(
                sub => sub.eventType === eventType && sub.postId === postId
              );
              if (index > -1) {
                userSubscriptions.splice(index, 1);
              }

              // Leave socket room
              const roomName = postId ? `${eventType}:${postId}` : eventType;
              socket.leave(roomName);

              // Update database
              await prisma.watcher.updateMany({
                where: {
                  userId: user.id,
                  postId,
                  eventType,
                },
                data: { isActive: false },
              });

              logger.info(
                `User ${user.username} unsubscribed from ${eventType}${postId ? ` for post ${postId}` : ''}`
              );
            }

            this.subscriptions.set(socket.id, userSubscriptions);

            socket.emit('unsubscribed', {
              eventTypes,
              postId,
              message: 'Successfully unsubscribed from events',
            });
          } catch (error) {
            logger.error('Error handling unsubscription:', error);
            socket.emit('error', {
              message: 'Failed to unsubscribe from events',
            });
          }
        }
      );

      // Handle getting current subscriptions
      socket.on('get_subscriptions', () => {
        const subscriptions = this.subscriptions.get(socket.id) || [];
        socket.emit('subscriptions', subscriptions);
      });

      // Handle disconnection
      socket.on('disconnect', reason => {
        logger.info(
          `User disconnected: ${user.username} (${socket.id}) - ${reason}`
        );

        // Mark all subscriptions as inactive in database
        const userSubscriptions = this.subscriptions.get(socket.id) || [];
        userSubscriptions.forEach(async sub => {
          await prisma.watcher.updateMany({
            where: {
              userId: sub.userId,
              postId: sub.postId,
              eventType: sub.eventType,
            },
            data: { isActive: false },
          });
        });

        this.connectedUsers.delete(socket.id);
        this.subscriptions.delete(socket.id);
      });

      // Handle errors
      socket.on('error', error => {
        logger.error(`Socket error for user ${user.username}:`, error);
      });
    });

    logger.info('WebSocket server initialized');
  }

  // Check if user can subscribe to specific event
  private canSubscribe(
    user: SocketUser,
    eventType: string,
    postId?: string
  ): boolean {
    // Define subscription rules based on user role and event type
    const publicEvents = ['post_created', 'post_updated', 'comment_added'];
    const moderatorEvents = ['post_flagged', 'user_reported'];
    const adminEvents = ['user_banned', 'system_alert'];

    if (publicEvents.includes(eventType)) {
      return true;
    }

    if (
      moderatorEvents.includes(eventType) &&
      ['MODERATOR', 'ADMIN'].includes(user.role)
    ) {
      return true;
    }

    if (adminEvents.includes(eventType) && user.role === 'ADMIN') {
      return true;
    }

    // Users can always subscribe to their own post events
    if (postId) {
      // This would need additional database check to verify ownership
      return true;
    }

    return false;
  }

  // Broadcast event to subscribed users
  async broadcastEvent(eventType: string, data: any, postId?: string) {
    if (!this.io) return;

    try {
      const roomName = postId ? `${eventType}:${postId}` : eventType;

      // Get all active watchers from database
      const watchers = await prisma.watcher.findMany({
        where: {
          eventType,
          postId: postId || null,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      // Prepare event payload
      const eventPayload = {
        type: eventType,
        data,
        postId,
        timestamp: new Date().toISOString(),
        watcherCount: watchers.length,
      };

      // Broadcast to room
      this.io.to(roomName).emit('event', eventPayload);

      // Log the broadcast
      logger.info(
        `Broadcasted ${eventType} event to ${watchers.length} watchers${postId ? ` for post ${postId}` : ''}`
      );

      // Store activity log
      await prisma.activityLog.create({
        data: {
          action: 'broadcast',
          entityType: 'event',
          entityId: postId || 'global',
          newValues: {
            eventType,
            data,
            watcherCount: watchers.length,
          },
        },
      });
    } catch (error) {
      logger.error('Error broadcasting event:', error);
    }
  }

  // Send notification to specific user
  sendToUser(userId: string, event: string, data: any) {
    if (!this.io) return;

    this.io.to(`user:${userId}`).emit(event, {
      type: event,
      data,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Sent ${event} event to user ${userId}`);
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get user subscriptions
  getUserSubscriptions(socketId: string): WatchSubscription[] {
    return this.subscriptions.get(socketId) || [];
  }

  // Get all active subscriptions
  async getAllActiveSubscriptions() {
    return await prisma.watcher.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }
}

export const websocketService = new WebSocketService();
