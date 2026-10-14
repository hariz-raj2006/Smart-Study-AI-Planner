import { config } from './config.js';
import app from './app.js';

const server = app.listen(config.port, () => {
  console.log('');
  console.log(`  SmartStudy AI server running on http://localhost:${config.port}`);
  console.log(`  Health check:      http://localhost:${config.port}/api/health`);
  console.log(`  Data file:         ${config.databasePath}`);
  console.log(
    config.gemini.configured
      ? `  Gemini:            configured (model: ${config.gemini.model})`
      : '  Gemini:            NOT configured. Set GEMINI_API_KEY and GEMINI_MODEL in server/.env'
  );
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Close the other program or change PORT in server/.env.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});