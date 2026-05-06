const config = {
  server: {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  db: {
    url: process.env.DATABASE_URL || '',
    ssl: process.env.DB_SSL === 'true',
    poolMin: Number(process.env.DB_POOL_MIN) || 2,
    poolMax: Number(process.env.DB_POOL_MAX) || 10,
  },
  redis: {
    url: process.env.REDIS_URL || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || '',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID || '',
    iosClientId: process.env.GOOGLE_IOS_CLIENT_ID || '',
  },
  otp: {
    expiresInMinutes: Number(process.env.OTP_EXPIRES_IN) || 5,
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS) || 3,
    maxPerPhonePerHour: 3,
    maxGlobalPerMinute: 100,
  },
  vonage: {
    apiKey: process.env.VONAGE_API_KEY || '',
    apiSecret: process.env.VONAGE_API_SECRET || '',
    whatsappFrom: process.env.VONAGE_WHATSAPP_FROM || '',
  },
  easySendSms: {
    apiKey: process.env.EASYSENDSMS_API_KEY || '',
    sender: process.env.OTP_SENDER || '',
  },
  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) || ['*'],
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;

export { config };
