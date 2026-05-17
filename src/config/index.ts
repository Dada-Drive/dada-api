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
    username: process.env.EASYSENDSMS_USERNAME || '',
    password: process.env.EASYSENDSMS_PASSWORD || '',
    sender: process.env.OTP_SENDER || '',
  },
  upload: {
    storage: (process.env.UPLOAD_STORAGE || 'local') as 'local' | 's3' | 'cloudinary',
    s3: {
      bucket: process.env.UPLOAD_S3_BUCKET || '',
      region: process.env.UPLOAD_S3_REGION || '',
    },
    cloudinary: {
      cloud: process.env.UPLOAD_CLOUDINARY_CLOUD || '',
      apiKey: process.env.UPLOAD_CLOUDINARY_KEY || '',
      apiSecret: process.env.UPLOAD_CLOUDINARY_SECRET || '',
    },
  },
  flouci: {
    appToken: process.env.FLOUCI_APP_TOKEN || '',
    appSecret: process.env.FLOUCI_APP_SECRET || '',
  },
  fare: {
    serviceTypes: {
      taxi: {
        economy: { baseFare: 2.5, perKm: 1.2, perMin: 0.3 },
        premium: { baseFare: 5.0, perKm: 2.0, perMin: 0.5 },
        van: { baseFare: 4.0, perKm: 1.6, perMin: 0.4 },
        motorcycle: { baseFare: 2.0, perKm: 1.0, perMin: 0.25 },
      },
      covoiturage: {
        economy: { baseFare: 2.0, perKm: 1.0, perMin: 0.25 },
        premium: { baseFare: 3.5, perKm: 1.5, perMin: 0.35 },
        van: { baseFare: 3.0, perKm: 1.3, perMin: 0.3 },
        motorcycle: { baseFare: 1.5, perKm: 0.8, perMin: 0.2 },
      },
      cours_partage: {
        economy: { baseFare: 1.5, perKm: 0.8, perMin: 0.2 },
        premium: { baseFare: 2.5, perKm: 1.2, perMin: 0.3 },
        van: { baseFare: 2.0, perKm: 1.0, perMin: 0.25 },
        motorcycle: { baseFare: 1.2, perKm: 0.7, perMin: 0.15 },
      },
      vespa: {
        economy: { baseFare: 1.5, perKm: 0.9, perMin: 0.2 },
        premium: { baseFare: 1.5, perKm: 0.9, perMin: 0.2 },
        van: { baseFare: 1.5, perKm: 0.9, perMin: 0.2 },
        motorcycle: { baseFare: 1.5, perKm: 0.9, perMin: 0.2 },
      },
    },
    currency: 'TND',
    offerValiditySeconds: 30,
    offerCooldownSeconds: 30,
    offerFareToleranceTnd: 1,
    offerMaxFareMultiplier: 5,
  },
  socket: {
    transports: ['websocket', 'polling'] as const,
    pingInterval: 25000,
    pingTimeout: 20000,
    tokenCheckIntervalMs: 5 * 60 * 1000,
    locationDbWriteIntervalMs: 10 * 1000,
    rideSearchRadiusKm: 5,
  },
  jobs: {
    notification: { attempts: 3, backoff: { type: 'exponential' as const, delay: 2000 } },
    paymentVerification: { attempts: 5, backoff: { type: 'exponential' as const, delay: 5000 } },
    rideExpiration: { attempts: 2, backoff: { type: 'fixed' as const, delay: 3000 } },
    scheduledRideActivation: {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5000 },
    },
    otpDelivery: { attempts: 2, backoff: { type: 'fixed' as const, delay: 1000 } },
    ratingRecalculation: { attempts: 3, backoff: { type: 'exponential' as const, delay: 3000 } },
    offerExpiration: { attempts: 2, backoff: { type: 'fixed' as const, delay: 3000 } },
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  },
  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) || ['*'],
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
  },
  performance: {
    slowQueryWarnMs: Number(process.env.SLOW_QUERY_WARN_MS) || 200,
    slowQueryErrorMs: Number(process.env.SLOW_QUERY_ERROR_MS) || 500,
    slowRouteMs: Number(process.env.SLOW_ROUTE_MS) || 1000,
  },
} as const;

export { config };
