import express from "express";
import mongoose from "mongoose";
import "./models/index.js";

import catalogueRoutes from "./routes/catalogue.routes.js";
import identityRoutes from "./routes/identity.routes.js";
import notificationRoutes from "./routes/notifications.routes.js";
import { requireAuth } from "./middleware/auth.middleware.js";
import { getProfile } from "./controllers/identity.controller.js";
import academicTermRoutes from "./routes/academicTerm.routes.js";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });
const app = express();
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGODB_URI;

app.use(express.json());

// Group Routes
app.use("/api/catalogue", catalogueRoutes);
app.use("/api/identity", identityRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/communications/notifications", notificationRoutes);

// Direct profile endpoint alias
app.get("/api/profile", requireAuth, getProfile);
app.use("/api/academic-terms", academicTermRoutes);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

try {
  await mongoose.connect(mongoUri);
  console.log(`Connected to MongoDB: ${mongoUri}`);
} catch (err) {
  console.warn(`MongoDB connection warning: ${err.message}`);
}

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});

export default app;
