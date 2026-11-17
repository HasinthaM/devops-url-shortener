import { env } from './env';

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'DevOps URL Shortener REST API',
    version: '1.0.0',
    description:
      'Production-oriented URL Shortener platform engineered for DevOps, SRE, and cloud-native workflows.',
    contact: {
      name: 'Platform Engineering Team',
    },
  },
  servers: [
    {
      url: env.APP_BASE_URL,
      description: 'Current Environment Server',
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'Administrative API key required for URL deletion and management',
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Bearer token alternative for administrative authentication',
      },
    },
    schemas: {
      CreateUrlRequest: {
        type: 'object',
        required: ['originalUrl'],
        properties: {
          originalUrl: {
            type: 'string',
            format: 'uri',
            example: 'https://github.com/features/actions',
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            example: '2026-12-31T23:59:59.000Z',
          },
        },
      },
      CreateUrlResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              shortCode: { type: 'string', example: 'aB8xQ2z' },
              shortUrl: { type: 'string', example: 'http://localhost:3000/aB8xQ2z' },
              originalUrl: { type: 'string', example: 'https://github.com/features/actions' },
              createdAt: { type: 'string', format: 'date-time' },
              expiresAt: { type: 'string', format: 'date-time', nullable: true },
            },
          },
        },
      },
      UrlDetailsResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              shortCode: { type: 'string', example: 'aB8xQ2z' },
              shortUrl: { type: 'string', example: 'http://localhost:3000/aB8xQ2z' },
              originalUrl: { type: 'string', example: 'https://github.com/features/actions' },
              isActive: { type: 'boolean', example: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              expiresAt: { type: 'string', format: 'date-time', nullable: true },
            },
          },
        },
      },
      UrlStatsResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              shortCode: { type: 'string', example: 'aB8xQ2z' },
              originalUrl: { type: 'string', example: 'https://github.com/features/actions' },
              totalClicks: { type: 'integer', example: 142 },
              isActive: { type: 'boolean', example: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              expiresAt: { type: 'string', format: 'date-time', nullable: true },
              lastClickedAt: { type: 'string', format: 'date-time', nullable: true },
            },
          },
        },
      },
      StandardErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'URL_NOT_FOUND' },
              message: { type: 'string', example: 'The requested short URL does not exist.' },
              details: { nullable: true },
            },
          },
        },
      },
    },
  },
  paths: {
    '/api/v1/urls': {
      post: {
        tags: ['URLs'],
        summary: 'Create a shortened URL',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUrlRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Short URL created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateUrlResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error (invalid URL or non-HTTP/HTTPS protocol)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' },
              },
            },
          },
          '429': {
            description: 'Rate limit exceeded',
          },
        },
      },
    },
    '/{shortCode}': {
      get: {
        tags: ['Redirect'],
        summary: 'Redirect to original destination',
        parameters: [
          {
            name: 'shortCode',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Unique Base62 short code',
          },
        ],
        responses: {
          '302': {
            description: 'HTTP 302 Found redirect to original destination',
            headers: {
              Location: {
                schema: { type: 'string' },
                description: 'The target destination URL',
              },
            },
          },
          '404': {
            description: 'Short URL not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' },
              },
            },
          },
          '410': {
            description: 'Short URL expired or inactive',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/urls/{shortCode}': {
      get: {
        tags: ['URLs'],
        summary: 'Retrieve URL metadata',
        parameters: [
          {
            name: 'shortCode',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'URL metadata returned successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UrlDetailsResponse' },
              },
            },
          },
          '404': {
            description: 'URL not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StandardErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['URLs'],
        summary: 'Deactivate / soft-delete a short URL',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          {
            name: 'shortCode',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'URL successfully deactivated',
          },
          '401': {
            description: 'Missing or invalid authentication credentials',
          },
          '404': {
            description: 'URL not found',
          },
        },
      },
    },
    '/api/v1/urls/{shortCode}/stats': {
      get: {
        tags: ['URLs'],
        summary: 'Retrieve URL click statistics',
        parameters: [
          {
            name: 'shortCode',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Click analytics returned successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UrlStatsResponse' },
              },
            },
          },
          '404': {
            description: 'URL not found',
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness probe',
        responses: {
          '200': {
            description: 'Process is alive and responsive',
          },
        },
      },
    },
    '/ready': {
      get: {
        tags: ['System'],
        summary: 'Readiness probe (PostgreSQL database check)',
        responses: {
          '200': {
            description: 'Database connection verified',
          },
          '503': {
            description: 'Database connection failed',
          },
        },
      },
    },
  },
};
