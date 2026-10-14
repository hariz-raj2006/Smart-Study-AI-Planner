
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import subjectRoutes from './routes/subjectRoutes.js';
import examRoutes from './routes/examRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import availabilityRoutes from './routes/availabilityRoutes.js';
import planRoutes from './routes/planRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import statsRoutes from './routes/statsRoutes.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());

// Allow both the local development frontend and deployed Render frontend.
const allowedOrigins = new Set([
  'http://localhost:5173',
  'https://smartstudy-client-c1is.onrender.com',
]);

app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header (for example, server-to-server
      // requests or health checks) are allowed.
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Public health check.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// API routes.
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/study-plans', planRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', statsRoutes);

// Unknown API routes.
app.use('/api', notFound);

// Optionally serve the built frontend from the backend.
const clientDist = path.resolve(config.serverRoot, '../client/dist');

if (config.isProduction && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));

  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Centralized error handling.
app.use(errorHandler);

export default app;
