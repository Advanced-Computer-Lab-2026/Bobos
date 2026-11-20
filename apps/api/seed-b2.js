import mongoose from "mongoose";
import { User, StudentProfile } from "./src/models/identity.js";
import { FinancialTransaction } from "./src/models/finance.js";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/academics";

// Pre-computed bcrypt hash for password: "password"
const DEFAULT_PASSWORD_HASH = "$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEZaCzGQCSGh.66";

async function seedB2() {
  console.log(`Connecting to ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);

  // Read the schema enum for academicStanding dynamically
  const standingEnum = StudentProfile.schema.path("academicStanding")?.enumValues;
  const defaultStanding = standingEnum && standingEnum.length > 0 ? standingEnum[0] : "good";
  console.log(`Available academic standings: ${JSON.stringify(standingEnum)} -> Using "${defaultStanding}"`);

  // 1. Ensure Admin user exists (needed for testing staff refunds & exports)
  let adminUser = await User.findOne({ email: "admin@guc.edu.eg" });
  if (!adminUser) {
    adminUser = await User.create({
      fullName: "System Admin",
      email: "admin@guc.edu.eg",
      role: "administrator",
      passwordHash: DEFAULT_PASSWORD_HASH,
      accountStatus: "active"
    });
    console.log("Created Admin user: admin@guc.edu.eg");
  }

  // 2. Ensure test student 1 exists (advisingStudent)
  let student1User = await User.findOne({ email: "student@student.guc.edu.eg" });
  if (!student1User) {
    student1User = await User.create({
      fullName: "Youssef Antoun",
      email: "student@student.guc.edu.eg",
      role: "advisingStudent",
      passwordHash: DEFAULT_PASSWORD_HASH,
      accountStatus: "active"
    });
    console.log("Created Student 1 user: student@student.guc.edu.eg");
  }

  let student1Profile = await StudentProfile.findOne({ user: student1User._id });
  if (!student1Profile) {
    student1Profile = await StudentProfile.create({
      user: student1User._id,
      studentId: "28-10001",
      studentType: "advising",
      advisingReason: "probation",
      academicStanding: defaultStanding,
      gpa: 2.8,
      faculty: "IET",
      major: "Networks",
      currentSemester: 7
    });
    console.log("Created Student 1 profile: 28-10001");
  }

  // 3. Ensure test student 2 exists (normal student)
  let student2User = await User.findOne({ email: "mariam.nabil@student.guc.edu.eg" });
  if (!student2User) {
    student2User = await User.create({
      fullName: "Mariam Nabil",
      email: "mariam.nabil@student.guc.edu.eg",
      role: "advisingStudent",
      passwordHash: DEFAULT_PASSWORD_HASH,
      accountStatus: "active"
    });
    console.log("Created Student 2 user: mariam.nabil@student.guc.edu.eg");
  }

  let student2Profile = await StudentProfile.findOne({ user: student2User._id });
  if (!student2Profile) {
    student2Profile = await StudentProfile.create({
      user: student2User._id,
      studentId: "28-20002",
      studentType: "normal",
      academicStanding: defaultStanding,
      gpa: 3.4,
      faculty: "MET",
      major: "Computer Science",
      currentSemester: 7
    });
    console.log("Created Student 2 profile: 28-20002");
  }

  // 4. Clear previous test financial records for these students
  await FinancialTransaction.deleteMany({
    student: { $in: [student1Profile._id, student2Profile._id] }
  });

  // 5. Insert B2 Test Data
  const testRecords = [
    {
      student: student1Profile._id,
      type: "EXTRA_HOURS",
      kind: "extra_hours",
      amount: 3000,
      status: "COMPLETED",
      term: "W25",
      receiptId: "REC-2026-001",
      referenceNumber: "REF-EH-9901",
      lineItems: [
        { description: "Extra 3 Credit Hours - CSEN 701", quantity: 3, rate: 1000, amount: 3000 }
      ],
      createdAt: new Date("2026-02-01T10:00:00Z")
    },
    {
      student: student1Profile._id,
      type: "TUITION",
      kind: "tuition",
      amount: 25000,
      status: "REFUNDED",
      term: "W25",
      receiptId: "REC-2026-002",
      referenceNumber: "REF-TUI-8812",
      refundedAt: new Date("2026-02-05T12:00:00Z"),
      refundReason: "Term withdrawal approval",
      createdAt: new Date("2026-01-15T09:30:00Z")
    },
    {
      student: student1Profile._id,
      type: "FEE",
      kind: "fee",
      amount: 500,
      status: "PENDING",
      term: "S26",
      receiptId: "REC-2026-003",
      referenceNumber: "REF-FEE-4410",
      lineItems: [
        { description: "Late Course Registration Fee", quantity: 1, rate: 500, amount: 500 }
      ],
      createdAt: new Date("2026-03-01T14:15:00Z")
    },
    {
      student: student2Profile._id,
      type: "EXTRA_HOURS",
      kind: "extra_hours",
      amount: 4000,
      status: "COMPLETED",
      term: "S26",
      receiptId: "REC-2026-004",
      referenceNumber: "REF-EH-9902",
      lineItems: [
        { description: "Extra 4 Credit Hours - COMM 702", quantity: 4, rate: 1000, amount: 4000 }
      ],
      createdAt: new Date("2026-03-05T11:00:00Z")
    }
  ];

  const inserted = await FinancialTransaction.insertMany(testRecords);
  console.log(`\nSuccessfully seeded ${inserted.length} B2 test records:`);
  inserted.forEach((r) =>
    console.log(` - [${r.status}] ${r.receiptId} | ${r.type} | ${r.amount} EGP (ID: ${r._id})`)
  );

  await mongoose.disconnect();
  console.log("\nDatabase disconnected successfully.");
}

seedB2().catch((err) => {
  console.error("Error seeding B2 data:", err);
  process.exit(1);
});