import path from 'path';

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DADA Ride-Sharing API',
      version: '1.0.0',
      description:
        'Production-ready ride-sharing backend API serving Android (Kotlin) and iOS (Swift) clients.',
      contact: {
        name: 'DADA Team',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
      {
        url: '/',
        description: 'Root (health check)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Validation failed' },
                details: { type: 'object' },
              },
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
          },
        },
        AuthUser: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            fullName: { type: 'string', example: 'Ali Ben Salem' },
            phone: { type: 'string', example: '+21612345678' },
            email: { type: 'string', nullable: true, example: 'ali@example.com' },
            role: { type: 'string', enum: ['rider', 'driver', 'admin'], example: 'rider' },
            isVerified: { type: 'boolean', example: false },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: { type: 'object' } },
            meta: {
              type: 'object',
              properties: {
                total: { type: 'integer', example: 156 },
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 20 },
                pages: { type: 'integer', example: 8 },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication & authorization' },
      { name: 'Users', description: 'User profile management' },
      { name: 'Driver', description: 'Driver profile, vehicle, status, location' },
      { name: 'Rides', description: 'Ride CRUD and lifecycle' },
      { name: 'Ride Stops', description: 'Ride intermediate stops' },
      { name: 'Shared Rides', description: 'Shared ride management' },
      { name: 'Wallet', description: 'Wallet balance and transactions' },
      { name: 'Ratings', description: 'Ride ratings' },
      { name: 'Admin', description: 'Admin panel operations' },
      { name: 'Vehicles', description: 'Vehicle catalog reference data' },
      { name: 'Meta', description: 'Enum and reference data' },
      { name: 'Notifications', description: 'Device token management' },
      { name: 'Upload', description: 'File uploads' },
      { name: 'Health', description: 'Health check' },
    ],
  },
  apis: [path.join(__dirname, '../routes/*.{ts,js}')],
};

const swaggerSpec = swaggerJsdoc(options);

export { swaggerSpec };
