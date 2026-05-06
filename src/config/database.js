require('dotenv').config();

module.exports = {
  development: {
    url: process.env.DATABASE_URL || 'postgresql://dada:dada@localhost:5432/dada',
    dialect: 'postgres',
    logging: false,
  },
  test: {
    url: process.env.DATABASE_URL || 'postgresql://dada_test:dada_test@localhost:5433/dada_test',
    dialect: 'postgres',
    logging: false,
  },
  staging: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        rejectUnauthorized: true,
      },
    },
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        rejectUnauthorized: true,
      },
    },
  },
};
