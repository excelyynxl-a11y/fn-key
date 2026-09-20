import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import { createApp } from './src/app.js';

const port = Number(process.env.PORT || 5000);
let server;
let stopping = false;

async function shutdown(signal, exitCode = 0) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: shutting down`);
  const deadline = setTimeout(() => process.exit(1), 8000);
  deadline.unref();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  clearTimeout(deadline);
  process.exit(exitCode);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  await connectDB(process.env.MONGO_URI);
  server = createApp().listen(port, '0.0.0.0', () => console.log(`API listening on port ${port}`));
  server.on('error', (error) => {
    console.error('HTTP server failed:', error.message);
    void shutdown('HTTP error', 1);
  });
} catch (error) {
  console.error('Startup failed (including MongoDB connection):', error.message);
  await mongoose.disconnect();
  process.exit(1);
}
