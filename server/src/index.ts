import { createApp } from './app';
import { config } from './config';
import { checkUploadDir } from './services/uploads';

if (config.isProduction && !process.env.UPLOAD_DIR) {
  console.warn(
    `[server] UPLOAD_DIR is not set: images are stored in ${config.uploadDir}. ` +
      'Set it to a folder outside the app so redeploys never delete uploads.',
  );
}

// Shows the upload folder actually used (UPLOAD_DIR) and whether files can be written/deleted there.
void checkUploadDir(config.uploadDir).then(({ ok, error }) => {
  if (ok) console.log(`[server] uploads: ${config.uploadDir} (writable)`);
  else console.error(`[server] uploads: ${config.uploadDir} is NOT writable (${error})`);
});

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
