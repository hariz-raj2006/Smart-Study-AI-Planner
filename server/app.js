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
// Only the SmartStudy frontend may call the API from a browser, and cookies are allowed for it.
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Public: lets you check that the backend is running.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), environment: config.nodeEnv });
});

app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/study-plans', planRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', statsRoutes); // GET /api/dashboard and GET /api/progress

app.use('/api', notFound);

// Optional: in production the backend can also serve the built frontend (client/dist).
const clientDist = path.resolve(config.serverRoot, '../client/dist');
if (config.isProduction && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(errorHandler);

export default app;