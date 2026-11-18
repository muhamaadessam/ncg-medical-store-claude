import { createApp } from './app';
import { config } from './config';

if (config.isProduction && !process.env.UPLOAD_DIR) {
  console.warn(
    `[server] UPLOAD_DIR is not set: images are stored in ${config.uploadDir}. ` +
      'Set it to a folder outside the app so redeploys never delete uploads.',
  );
}

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[server] ${config.nodeEnv} listening on port ${config.port}`);
});

const shutdown = (signal: string) => {
  console.log(`[server] ${signal} received, closing`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
