import mongoose from "mongoose";
import app from "./app.js";
import { StudentTermStanding } from "./models/academics.js";
import { Notification } from "./models/communications.js";
import { WholeScheduleSwapRequest } from "./models/requests.js";
import { probationWarningsEnabled, startProbationWarnings } from "./services/probation-warnings.js";
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bobos?replicaSet=rs0";

try {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");
} catch {
  console.error("Could not connect to MongoDB. Check MONGODB_URI and that the database server is running.");
  process.exit(1);
}

try {
  await Promise.all([WholeScheduleSwapRequest.init(), Notification.init(), StudentTermStanding.init()]);
} catch (error) {
  console.error("Could not initialize application indexes:", error.message);
  process.exit(1);
}

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
  if (probationWarningsEnabled()) startProbationWarnings();
});

export default app;
