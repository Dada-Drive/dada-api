'use strict';

require('dotenv').config();
const { Sequelize } = require('sequelize');
const { execSync } = require('child_process');
const path = require('path');

const dbConfig = require('../config/database.js');

const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env];

// Safety: refuse to run against production
if (env === 'production') {
  console.error('ERROR: db:clean cannot run in production environment.');
  process.exit(1);
}

const ALL_TABLES = [
  'notifications',
  'device_tokens',
  'refresh_tokens',
  'otp_codes',
  'wallet_transactions',
  'ratings',
  'shared_ride_passengers',
  'ride_stops',
  'ride_offers',
  'rides',
  'wallets',
  'vehicles',
  'driver_profiles',
  'users',
];

async function clean() {
  const sequelize = new Sequelize(config.url, {
    dialect: config.dialect,
    logging: false,
  });

  try {
    await sequelize.authenticate();
    console.log(`Connected to ${env} database.`);

    // Discover which tables actually exist in the database
    const [rows] = await sequelize.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'SequelizeMeta';`,
    );
    const existingTables = new Set(rows.map((r) => r.tablename));
    const tables = ALL_TABLES.filter((t) => existingTables.has(t));

    if (tables.length === 0) {
      console.log('No tables to truncate.');
    } else {
      console.log(`Truncating ${tables.length} tables...`);
      await sequelize.query(
        `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} CASCADE;`,
      );
      console.log(`Truncated: ${tables.join(', ')}`);
    }

    const shouldSeed = process.argv.includes('--seed');
    if (shouldSeed) {
      console.log('Re-seeding data...');
      execSync('npx sequelize-cli db:seed:all', {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '../..'),
      });
      console.log('Seeding complete.');
    }

    console.log('Done.');
  } catch (error) {
    console.error('db:clean failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

clean();
