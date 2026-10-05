import express from "express";
import {
  getStudentDetails,
  setUserStatus,
  lookupAdvisor,
  addAdvisor,
  removeAdvisor,
} from "../controllers/admin.controller.js";

const router = express.Router();

// Req 9 — student details
router.get("/students/:id", getStudentDetails);

// Req 10 — account activation toggle
router.patch("/users/:id/status", setUserStatus);

// Req 11 — advisor lookup + add
router.get("/advisors/lookup", lookupAdvisor);
router.post("/advisors", addAdvisor);

// Req 12 — advisor removal
router.delete("/advisors/:email", removeAdvisor);

export default router;