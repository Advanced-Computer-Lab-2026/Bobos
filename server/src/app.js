import express from 'express';
import morgan from 'morgan';
import cors from 'cors';

// Feature routers. Keep this list alphabetical and ADD ONLY - do not reorder or
// remove another team's line, this file is shared by the whole team.
import devRoutes from './routes/dev.js';
import groupAssignmentRoutes from './routes/groupAssignments.js';
import scheduleRoutes from './routes/schedules.js';

const app = express();

if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// TEMPORARY DEV SHIM - never mounted in production. Delete this block once
// requirement 1 (login) is implemented by team A1.
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', devRoutes);
}

app.use('/api/group-assignments', groupAssignmentRoutes); // requirement 30
app.use('/api/schedules', scheduleRoutes); // requirement 31

// Not found
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'test') console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
});

export default app;
