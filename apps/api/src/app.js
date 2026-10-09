import express from "express";
import mongoose from "mongoose";
import "./models/index.js";
import catalogueRoutes from "./routes/catalogue.routes.js";
import identityRoutes from "./routes/identity.routes.js";
import notificationRoutes from "./routes/notifications.routes.js";
import academicTermRoutes from "./routes/academicTerm.routes.js";
import academicsRoutes from "./routes/academics.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import advisorRoutes from "./routes/advisor.routes.js";
import groupAssignmentRoutes from "./routes/group-assignments.routes.js";
import scheduleRoutes from "./routes/schedules.routes.js";
import swapRoutes from "./routes/swaps.routes.js";
import { requireAuth } from "./middleware/auth.middleware.js";
import { getProfile } from "./controllers/identity.controller.js";
import { apiErrorHandler } from "./middleware/error.middleware.js";

// Keep app wiring separate from database startup so tests use the real routes.
const app = express();
const jsonParser = express.json();
const allowedOrigins = (process.env.WEB_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.get("Origin");
  const localDevelopmentOrigin = process.env.NODE_ENV !== "production"
    && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");

  if (origin && (allowedOrigins.includes(origin) || localDevelopmentOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  }

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/api/catalogue/courses/import") return next();
  return jsonParser(req, res, next);
});
app.use("/api/catalogue", catalogueRoutes);
app.use("/api/identity", identityRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/communications/notifications", notificationRoutes);
app.use("/api/academic-terms", academicTermRoutes);
app.use("/api/academics", academicsRoutes);
app.use("/api/admin", requireAuth, adminRoutes);
app.use("/api/advisor", requireAuth, advisorRoutes);
app.use("/api/group-assignments", groupAssignmentRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/swaps", swapRoutes);
app.get("/api/profile", requireAuth, getProfile);
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});
app.use(apiErrorHandler);

export default app;
