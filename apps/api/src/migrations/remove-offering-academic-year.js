import mongoose from "mongoose";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CourseOffering, AcademicTerm } from "../models/catalogue.js";

// Only the obsolete offering copy is removed; term years and offering references
// remain untouched. Readers already derive the year, so cleanup can be deferred.
export async function removeOfferingAcademicYear({ apply = false } = {}) {
  const offerings = CourseOffering.collection;
  const [summary] = await offerings.aggregate([
    { $match: { academicYear: { $exists: true } } },
    { $lookup: { from: AcademicTerm.collection.name, localField: "term", foreignField: "_id", as: "linkedTerm" } },
    { $group: {
      _id: null,
      redundantFields: { $sum: 1 },
      orphanedOfferings: { $sum: { $cond: [{ $eq: [{ $size: "$linkedTerm" }, 0] }, 1, 0] } },
      mismatchedYears: { $sum: { $cond: [{ $and: [
        { $gt: [{ $size: "$linkedTerm" }, 0] },
        { $ne: ["$academicYear", { $arrayElemAt: ["$linkedTerm.academicYear", 0] }] },
      ] }, 1, 0] } },
    } },
    { $project: { _id: 0 } },
  ]).toArray();
  const report = { applied: apply, redundantFields: 0, orphanedOfferings: 0, mismatchedYears: 0, ...summary };
  if (!apply) return report;
  if (report.orphanedOfferings) throw new Error("Repair orphaned offering term references before removing legacy years.");
  const result = await offerings.updateMany({ academicYear: { $exists: true } }, { $unset: { academicYear: "" } });
  const indexes = await offerings.indexes();
  const oldYearIndexes = indexes.filter((index) => Object.keys(index.key).length === 1 && index.key.academicYear === 1);
  for (const index of oldYearIndexes) await offerings.dropIndex(index.name);
  return { ...report, removedFields: result.modifiedCount, droppedIndexes: oldYearIndexes.map((index) => index.name) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some((arg) => arg !== "--apply")) throw new Error("Usage: migrate:offering-years [-- --apply]");
    if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI to the intended database. The default run is read-only; add --apply to remove legacy copies.");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(JSON.stringify(await removeOfferingAcademicYear({ apply: process.argv.includes("--apply") }), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
