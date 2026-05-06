interface EnvRequirement {
  key: string;
  required: boolean;
  envs: string[];
}

const requirements: EnvRequirement[] = [
  // Always required
  { key: 'NODE_ENV', required: true, envs: ['development', 'staging', 'production'] },
  { key: 'PORT', required: true, envs: ['development', 'staging', 'production'] },
  { key: 'ALLOWED_ORIGINS', required: true, envs: ['development', 'staging', 'production'] },
  { key: 'LOG_LEVEL', required: true, envs: ['development', 'staging', 'production'] },

  // Database & Redis — required in staging/production, optional in dev (Phase 2+)
  { key: 'DATABASE_URL', required: true, envs: ['staging', 'production'] },
  { key: 'REDIS_URL', required: true, envs: ['staging', 'production'] },

  // JWT — required once auth is implemented (Phase 4+)
  { key: 'JWT_SECRET', required: true, envs: ['staging', 'production'] },
  { key: 'REFRESH_TOKEN_SECRET', required: true, envs: ['staging', 'production'] },
];

function validateEnv(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const missing: string[] = [];

  for (const req of requirements) {
    if (!req.required) continue;
    if (!req.envs.includes(nodeEnv)) continue;

    const value = process.env[req.key];
    if (value === undefined || value === '') {
      missing.push(req.key);
    }
  }

  if (missing.length > 0) {
    const message = [
      '',
      '=== MISSING ENVIRONMENT VARIABLES ===',
      `Environment: ${nodeEnv}`,
      '',
      ...missing.map((key) => `  - ${key}`),
      '',
      'Copy .env.example to .env and fill in the required values.',
      '=====================================',
      '',
    ].join('\n');

    // Logger may not be initialized yet, use stderr directly
    process.stderr.write(message);
    process.exit(1);
  }
}

export { validateEnv };
