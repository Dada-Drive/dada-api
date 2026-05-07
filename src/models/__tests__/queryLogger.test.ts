jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    http: jest.fn(),
  },
}));

import { queryLogger } from '@/models/index';
import { logger } from '@/utils/logger';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('queryLogger', () => {
  it('logs at debug level for queries under warn threshold', () => {
    queryLogger('SELECT * FROM users', 50);

    expect(logger.debug).toHaveBeenCalledWith('SELECT * FROM users', {
      duration: 50,
      component: 'sequelize',
    });
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs at warn level for queries exceeding warn threshold', () => {
    queryLogger('SELECT * FROM rides WHERE status = $1', 250);

    expect(logger.warn).toHaveBeenCalledWith('Slow query detected', {
      sql: 'SELECT * FROM rides WHERE status = $1',
      duration: 250,
      component: 'sequelize',
    });
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs at error level for queries exceeding error threshold', () => {
    queryLogger('SELECT * FROM wallet_transactions', 600);

    expect(logger.error).toHaveBeenCalledWith('Slow query detected', {
      sql: 'SELECT * FROM wallet_transactions',
      duration: 600,
      component: 'sequelize',
    });
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('defaults to duration 0 when timing is undefined', () => {
    queryLogger('SELECT 1');

    expect(logger.debug).toHaveBeenCalledWith('SELECT 1', {
      duration: 0,
      component: 'sequelize',
    });
  });
});
