import swaggerJsdoc from 'swagger-jsdoc';
import {Express} from 'express';
import path from 'path';

/**
 * Swagger configuration options
 */
const swaggerOptions = {
  'definition': {
    'openapi': '3.0.0',
    'info': {
      'title': 'Production Ready REST API',
      'version': '1.0.0',
      'description': 'A comprehensive, production-ready REST API boilerplate with authentication, real-time features, and comprehensive security',
      'contact': {
        'name': 'API Support',
        'email': 'support@example.com',
        'url': 'https://github.com/your-repo/productionready-rest-api-boilerplate'
      },
      'license': {
        'name': 'MIT',
        'url': 'https://opensource.org/licenses/MIT'
      }
    },
    'servers': [
      {
        'url': process.env.NODE_ENV === 'production'
          ? 'https://your-domain.com'
          : 'http://localhost:3000',
        'description': process.env.NODE_ENV === 'production'
          ? 'Production server'
          : 'Development server'
      }
    ],
    'components': {
      'securitySchemes': {
        'bearerAuth': {
          'type': 'http',
          'scheme': 'bearer',
          'bearerFormat': 'JWT',
          'description': 'JWT access token for authentication'
        }
      },
      'schemas': {
        'User': {
          'type': 'object',
          'required': ['id', 'email', 'username', 'role', 'isActive', 'createdAt', 'updatedAt'],
          'properties': {
            'id': {
              'type': 'string',
              'description': 'User unique identifier',
              'example': 'cuid123456789'
            },
            'email': {
              'type': 'string',
              'format': 'email',
              'description': 'User email address',
              'example': 'user@example.com'
            },
            'username': {
              'type': 'string',
              'description': 'Unique username',
              'example': 'john_doe'
            },
            'firstName': {
              'type': 'string',
              'description': 'User first name',
              'example': 'John'
            },
            'lastName': {
              'type': 'string',
              'description': 'User last name',
              'example': 'Doe'
            },
            'avatar': {
              'type': 'string',
              'format': 'uri',
              'description': 'Profile avatar URL',
              'example': 'https://example.com/avatar.jpg'
            },
            'role': {
              'type': 'string',
              'enum': ['USER', 'MODERATOR', 'ADMIN'],
              'description': 'User role',
              'example': 'USER'
            },
            'isActive': {
              'type': 'boolean',
              'description': 'Whether the user account is active',
              'example': true
            },
            'createdAt': {
              'type': 'string',
              'format': 'date-time',
              'description': 'Account creation timestamp'
            },
            'updatedAt': {
              'type': 'string',
              'format': 'date-time',
              'description': 'Last update timestamp'
            }
          }
        },
        'Post': {
          'type': 'object',
          'required': ['id', 'title', 'content', 'authorId', 'createdAt', 'updatedAt'],
          'properties': {
            'id': {
              'type': 'string',
              'description': 'Post unique identifier',
              'example': 'cuid123456789'
            },
            'title': {
              'type': 'string',
              'description': 'Post title',
              'example': 'My First Post'
            },
            'content': {
              'type': 'string',
              'description': 'Post content in Markdown or HTML',
              'example': '# Hello World\nThis is my first post content.'
            },
            'excerpt': {
              'type': 'string',
              'description': 'Brief post summary',
              'example': 'A brief summary of the post content.'
            },
            'slug': {
              'type': 'string',
              'description': 'URL-friendly post identifier',
              'example': 'my-first-post'
            },
            'published': {
              'type': 'boolean',
              'description': 'Whether the post is published',
              'example': true
            },
            'featured': {
              'type': 'boolean',
              'description': 'Whether the post is featured',
              'example': false
            },
            'tags': {
              'type': 'array',
              'items': {
                'type': 'string'
              },
              'description': 'Post tags for categorization',
              'example': ['nodejs', 'typescript', 'api']
            },
            'readTime': {
              'type': 'integer',
              'description': 'Estimated reading time in minutes',
              'example': 5
            },
            'viewCount': {
              'type': 'integer',
              'description': 'Number of times the post has been viewed',
              'example': 42
            },
            'createdAt': {
              'type': 'string',
              'format': 'date-time',
              'description': 'Post creation timestamp'
            },
            'updatedAt': {
              'type': 'string',
              'format': 'date-time',
              'description': 'Last update timestamp'
            },
            'publishedAt': {
              'type': 'string',
              'format': 'date-time',
              'description': 'Publication timestamp'
            },
            'authorId': {
              'type': 'string',
              'description': 'ID of the post author',
              'example': 'cuid123456789'
            },
            'author': {
              '$ref': '#/components/schemas/User',
              'description': 'Post author details'
            }
          }
        },
        'Comment': {
          'type': 'object',
          'required': ['id', 'content', 'authorId', 'postId', 'createdAt', 'updatedAt'],
          'properties': {
            'id': {
              'type': 'string',
              'description': 'Comment unique identifier',
              'example': 'cuid123456789'
            },
            'content': {
              'type': 'string',
              'description': 'Comment content',
              'example': 'Great post! Thanks for sharing.'
            },
            'createdAt': {
              'type': 'string',
              'format': 'date-time',
              'description': 'Comment creation timestamp'
            },
            'updatedAt': {
              'type': 'string',
              'format': 'date-time',
              'description': 'Last update timestamp'
            },
            'authorId': {
              'type': 'string',
              'description': 'ID of the comment author',
              'example': 'cuid123456789'
            },
            'postId': {
              'type': 'string',
              'description': 'ID of the post this comment belongs to',
              'example': 'cuid123456789'
            },
            'parentId': {
              'type': 'string',
              'description': 'ID of the parent comment (for replies)',
              'example': 'cuid123456789'
            },
            'author': {
              '$ref': '#/components/schemas/User',
              'description': 'Comment author details'
            }
          }
        },
        'Error': {
          'type': 'object',
          'required': ['success', 'error', 'code'],
          'properties': {
            'success': {
              'type': 'boolean',
              'description': 'Whether the operation was successful',
              'example': false
            },
            'error': {
              'type': 'string',
              'description': 'Error message',
              'example': 'User not found'
            },
            'code': {
              'type': 'string',
              'description': 'Machine-readable error code',
              'example': 'USER_NOT_FOUND'
            },
            'details': {
              'type': 'object',
              'description': 'Additional error details',
              'example': {'field': 'email', 'message': 'Invalid email format'}
            }
          }
        },
        'Success': {
          'type': 'object',
          'required': ['success', 'message', 'data'],
          'properties': {
            'success': {
              'type': 'boolean',
              'description': 'Whether the operation was successful',
              'example': true
            },
            'message': {
              'type': 'string',
              'description': 'Success message',
              'example': 'Operation completed successfully'
            },
            'data': {
              'type': 'object',
              'description': 'Response data payload',
              'example': {'user': {'id': 'cuid123', 'email': 'user@example.com'}}
            }
          }
        },
        'PaginatedResponse': {
          'type': 'object',
          'required': ['success', 'data'],
          'properties': {
            'success': {
              'type': 'boolean',
              'description': 'Whether the operation was successful',
              'example': true
            },
            'data': {
              'type': 'object',
              'required': ['items', 'pagination'],
              'properties': {
                'items': {
                  'type': 'array',
                  'items': {
                    'type': 'object'
                  },
                  'description': 'Array of items'
                },
                'pagination': {
                  'type': 'object',
                  'required': ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev'],
                  'properties': {
                    'page': {
                      'type': 'integer',
                      'description': 'Current page number',
                      'example': 1
                    },
                    'limit': {
                      'type': 'integer',
                      'description': 'Items per page',
                      'example': 20
                    },
                    'total': {
                      'type': 'integer',
                      'description': 'Total number of items',
                      'example': 100
                    },
                    'totalPages': {
                      'type': 'integer',
                      'description': 'Total number of pages',
                      'example': 5
                    },
                    'hasNext': {
                      'type': 'boolean',
                      'description': 'Whether there is a next page',
                      'example': true
                    },
                    'hasPrev': {
                      'type': 'boolean',
                      'description': 'Whether there is a previous page',
                      'example': false
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    'security': [
      {
        'bearerAuth': []
      }
    ],
    'tags': [
      {
        'name': 'Authentication',
        'description': 'User authentication and authorization endpoints'
      },
      {
        'name': 'Users',
        'description': 'User management endpoints'
      },
      {
        'name': 'Posts',
        'description': 'Post management and content endpoints'
      },
      {
        'name': 'System',
        'description': 'System health and information endpoints'
      }
    ]
  },
  'apis': [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../routes/*.ts')
  ]
};

/**
 * Generate Swagger specification
 */
const specs = swaggerJsdoc(swaggerOptions);

/**
 * Swagger UI configuration
 */
export const swaggerUiOptions = {
  'explorer': true,
  'customCss': `
    .swagger-ui .topbar { 
      background-color: #1a1a1a; 
      border-bottom: 1px solid #333; 
    }
    .swagger-ui .info { 
      margin: 20px 0; 
    }
    .swagger-ui .scheme-container { 
      background: #2a2a2a; 
      border: 1px solid #333; 
      border-radius: 4px; 
      margin: 10px 0; 
    }
  `,
  'customSiteTitle': 'API Documentation'
};

export {specs, swaggerOptions};
