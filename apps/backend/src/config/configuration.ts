export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  database: {
    path: process.env.DATABASE_PATH || './data/timeoff.db',
  },
  hcm: {
    baseUrl: process.env.HCM_BASE_URL || 'http://localhost:3001',
    apiKey: process.env.HCM_API_KEY || 'mock-api-key',
    timeoutMs: parseInt(process.env.HCM_TIMEOUT_MS || '5000', 10),
  },
  sync: {
    reconcileIntervalMs: parseInt(process.env.RECONCILE_INTERVAL_MS || '900000', 10),
  },
});
