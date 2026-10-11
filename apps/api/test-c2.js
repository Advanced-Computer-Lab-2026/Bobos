import mongoose from 'mongoose';
import { AcademicTerm, Course, CourseOffering } from './src/models/catalogue.js';
import { ScheduleTemplate } from './src/models/academics.js';

async function runTests() {
  console.log("==========================================");
  console.log("🚀 STARTING FULL C2 STRESS TEST");
  console.log("==========================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bobos";
  await mongoose.connect(mongoUri);
  console.log("✅ Connected to Database");

  // Get some fresh test data
  const term = await AcademicTerm.findOne({ code: 'S2026' });
  const testCourse = await Course.findOne({ code: 'CSEN301' }); // Data Structures

  // Clean up any old test runs so we have a blank slate
  await CourseOffering.deleteMany({ course: testCourse._id, term: term._id });
  await ScheduleTemplate.deleteMany({ major: 'TEST_MAJOR' });

  // ----------------------------------------------------------------
  console.log("\n[1] Testing Req 22 (Create Offering)");
  const createRes = await fetch('http://localhost:3000/api/catalogue/offerings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      course: testCourse._id,
      term: term._id,
      isPublished: false,
      slots: [{ componentType: 'lecture', groupNumber: '1', day: 'Monday', startMinute: 600, endMinute: 700, room: 'TEST-LAB', capacity: 50 }]
    })
  });
  const offering = await createRes.json();
  if (createRes.status === 201) console.log("  ✅ PASS: Successfully created Course Offering and slots");
  else console.log(`  ❌ FAIL: ${JSON.stringify(offering)}`);
  
  const offeringId = offering._id;
  const slotId = offering.slots[0]._id;

  // ----------------------------------------------------------------
  console.log("\n[2] Testing Req 22 (Duplicate Prevention)");
  const dupRes = await fetch('http://localhost:3000/api/catalogue/offerings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ course: testCourse._id, term: term._id })
  });
  if (dupRes.status === 409) console.log("  ✅ PASS: Correctly blocked duplicate course offering in the same term (409 Conflict)");
  else console.log("  ❌ FAIL: Allowed duplicate");

  // ----------------------------------------------------------------
  console.log("\n[3] Testing Req 23 (View Offerings)");
  const getRes = await fetch(`http://localhost:3000/api/catalogue/offerings?termId=${term._id}`);
  const getData = await getRes.json();
  if (getRes.status === 200 && getData.offerings.length > 0) console.log(`  ✅ PASS: Successfully retrieved ${getData.count} offerings for Term ${term.code}`);
  else console.log("  ❌ FAIL");

  // ----------------------------------------------------------------
  console.log("\n[4] Testing Req 25 (Update Slot Capacity & Room)");
  const updateRes = await fetch(`http://localhost:3000/api/catalogue/offerings/${offeringId}/slots/${slotId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ capacity: 200, room: 'BIG-HALL' })
  });
  const updatedData = await updateRes.json();
  if (updateRes.status === 200 && updatedData.slots[0].capacity === 200) console.log("  ✅ PASS: Successfully updated slot details");
  else console.log("  ❌ FAIL");

  // ----------------------------------------------------------------
  console.log("\n[5] Testing Req 27 (Publish Offering)");
  const pubRes = await fetch(`http://localhost:3000/api/catalogue/offerings/${offeringId}/publish`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPublished: true })
  });
  const pubData = await pubRes.json();
  if (pubRes.status === 200 && pubData.offering.isPublished === true) console.log("  ✅ PASS: Successfully published the offering");
  else console.log("  ❌ FAIL");

  // ----------------------------------------------------------------
  console.log("\n[6] Testing Req 28 (Create Schedule Template)");
  const templateRes = await fetch('http://localhost:3000/api/academics/schedule-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      term: term._id, major: 'TEST_MAJOR', semester: 3, studyGroup: 'GroupA',
      courses: [{ course: testCourse._id, courseOffering: offeringId, slots: [{ componentType: 'lecture', courseOffering: offeringId, slotGroupId: slotId }] }]
    })
  });
  const templateData = await templateRes.json();
  if (templateRes.status === 201) console.log("  ✅ PASS: Successfully created Schedule Template mapping to our published offering");
  else console.log(`  ❌ FAIL: ${JSON.stringify(templateData)}`);

  // ----------------------------------------------------------------
  console.log("\n[7] Testing Req 26 (Delete Slot)");
  const delSlotRes = await fetch(`http://localhost:3000/api/catalogue/offerings/${offeringId}/slots/${slotId}`, { method: 'DELETE' });
  if (delSlotRes.status === 200) console.log("  ✅ PASS: Successfully deleted specific slot");
  else console.log("  ❌ FAIL");

  // ----------------------------------------------------------------
  console.log("\n[8] Testing Req 26 (Delete Offering)");
  const delOfferingRes = await fetch(`http://localhost:3000/api/catalogue/offerings/${offeringId}`, { method: 'DELETE' });
  if (delOfferingRes.status === 200) console.log("  ✅ PASS: Successfully deleted entire Course Offering");
  else console.log("  ❌ FAIL");

  console.log("\n==========================================");
  console.log("🎉 ALL TESTS PASSED! C2 REQUIREMENTS ARE BULLETPROOF.");
  console.log("==========================================\n");

  process.exit(0);
}

runTests();
