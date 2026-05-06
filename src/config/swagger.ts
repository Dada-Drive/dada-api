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
  },
  apis: [path.join(__dirname, '../routes/*.{ts,js}')],
};

const swaggerSpec = swaggerJsdoc(options);

export { swaggerSpec };
