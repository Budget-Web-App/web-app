export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
  sessionCookie: 'sid',
};

export const isProduction = config.nodeEnv === 'production';
