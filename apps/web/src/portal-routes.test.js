import assert from "node:assert/strict";
import test from "node:test";
import "../public/portal-studio/routes.js";

const { normalize, screenPage, siteEntry } = globalThis.BobosPortalRoutes;
const origin = "http://localhost:5173";

test("site and legacy links enter the illustrated Portal", () => {
  assert.equal(siteEntry(new URL("/", origin)).searchParams.get("page"), "login");
  assert.equal(siteEntry(new URL("/", origin), { signedIn: true }).searchParams.get("page"), "overview");
  const previous = siteEntry(new URL("/workspace.html?screen=slot-changes&layout=2&designs=compare#content", origin));
  assert.equal(previous.pathname, "/portal-studio/index.html");
  assert.equal(previous.search, "?preview=live&page=slot-changes");
  assert.equal(previous.hash, "#content");
  assert.equal(siteEntry(new URL("/coordinator/assign-groups", origin)).searchParams.get("page"), "group-assignments");
});

test("embedded workflow transitions resolve to the same page on reload", () => {
  for (const [from, screen] of [["advising", "preferences"], ["preferences", "student-schedules"], ["slot-changes", "my-schedule"]]) {
    const query = new URLSearchParams({ page: from, screen, preview: "live" });
    normalize(query);
    assert.equal(query.get("page"), screenPage(screen));
    assert.equal(query.has("screen"), false);
    const canonical = query.toString();
    normalize(query);
    assert.equal(query.toString(), canonical);
  }
});

test("new illustrated details, service variants, and calendar callbacks retain their intent", () => {
  const course = new URLSearchParams("page=course-detail&course=CSEN+701");
  normalize(course);
  assert.equal(course.toString(), "page=course-detail&course=CSEN+701");
  assert.equal(siteEntry(new URL("/workspace.html?page=copy-offerings", origin)).searchParams.get("page"), "copy-offerings");
  assert.equal(siteEntry(new URL("/?calendar=connected", origin)).search, "?calendar=connected&preview=live&page=calendar-sync&role=normalStudent");
  assert.equal(screenPage("graduation-review", "advisor"), "my-submitted-plans");
  for (const page of ["courses", "terms", "templates"]) {
    const legacy = siteEntry(new URL(`/academic-services.html?screen=${page}`, origin));
    assert.equal(legacy.searchParams.get("page"), page);
  }
  const genericOverview = new URLSearchParams("page=academic-services");
  normalize(genericOverview);
  assert.equal(genericOverview.get("page"), "overview");
  assert.equal(siteEntry(new URL("/workspace.html?screen=records", origin)).searchParams.get("page"), "official-records");
});
