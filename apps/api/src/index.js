import express from "express";
import mongoose from "mongoose";
import "./models/index.js";

import catalogueRoutes from "./routes/catalogue.routes.js";
import academicTermRoutes from "./routes/academicTerm.routes.js";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });
const app = express();
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGODB_URI;

app.use(express.json());

// Group Routes
app.use("/api/catalogue", catalogueRoutes);
app.use("/api/academic-terms", academicTermRoutes);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

await mongoose.connect(mongoUri);

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});
