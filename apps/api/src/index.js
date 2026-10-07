import mongoose from "mongoose";
import app from "./app.js";
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bobos?replicaSet=rs0";

try {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");
} catch {
  console.error("Could not connect to MongoDB. Check MONGODB_URI and that the database server is running.");
  process.exit(1);
}

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});

export default app;
