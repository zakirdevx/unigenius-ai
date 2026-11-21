// Vercel entry point: every /api/... request is handled by the same Express app used everywhere else.
import { createApp } from '../server/app.js';

export default createApp();
