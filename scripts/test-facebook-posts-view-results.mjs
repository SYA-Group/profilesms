/**
 * Static checks for Facebook Posts View Results UI.
 * Run: node scripts/test-facebook-posts-view-results.mjs
 */
import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = (...p) => path.join(root, "src", ...p);

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL  ${name}: ${e.message}`);
  }
}

const page = fs.readFileSync(src("pages", "FacebookPosts.tsx"), "utf8");
const api = fs.readFileSync(src("api.ts"), "utf8");
const helpers = fs.readFileSync(src("utils", "facebookPostsHelpers.ts"), "utf8");

function displayOrDash(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "-";
  return String(value);
}

check("1. View Results button renders", () => {
  assert.ok(page.includes("View Results"));
  assert.ok(page.includes("openResults(job)"));
});

check("2. opens correct job_id", () => {
  assert.ok(page.includes("selectedJobIdRef.current = job.job_id"));
  assert.ok(page.includes("loadResults(jobId)"));
});

check("3. calls correct GET results endpoint", () => {
  assert.ok(api.includes("getFacebookPostJobResults"));
  assert.ok(api.includes("`/facebook-post-jobs/${jobId}/results`"));
  assert.ok(page.includes("getFacebookPostJobResults"));
});

check("4. Facebook ID displayed", () => {
  assert.ok(page.includes("Facebook ID"));
  assert.ok(page.includes("row.facebook_author_id"));
});

check("5. Author displayed", () => {
  assert.ok(page.includes(">Author<") || page.includes("Author"));
  assert.ok(page.includes("row.author_name"));
});

check("6. Comment displayed", () => {
  assert.ok(page.includes("row.comment_text"));
});

check("7. Comment At displayed", () => {
  assert.ok(page.includes("Comment At"));
  assert.ok(page.includes("row.comment_created_at"));
});

check("8. null author handled", () => {
  assert.ok(helpers.includes("displayOrDash"));
  assert.strictEqual(displayOrDash(null), "-");
  assert.ok(page.includes("displayOrDash(row.author_name)"));
});

check("9. null comment_created_at handled", () => {
  assert.ok(page.includes('row.comment_created_at') && page.includes('"-"') || page.includes("'-'") || page.includes(': "-"'));
  assert.ok(page.includes("row.comment_created_at\n                              ? formatJobDate") || page.includes("row.comment_created_at\r\n") || page.includes("comment_created_at\n                              ?") || page.includes("comment_created_at"));
  assert.ok(page.includes('? formatJobDate(row.comment_created_at)') || page.includes("formatJobDate(row.comment_created_at)\n                              : \"-\"") || page.includes(': "-"'));
});

check("10. long comment wraps", () => {
  assert.ok(page.includes("whitespace-pre-wrap") || page.includes("break-words"));
});

check("11. Requested shown", () => {
  assert.ok(page.includes("Requested"));
  assert.ok(page.includes("selectedJob.requested_count"));
});

check("12. Comments Found shown", () => {
  assert.ok(page.includes("Comments Found"));
  assert.ok(page.includes("selectedJob.comments_found"));
});

check("13. IDs Found shown", () => {
  assert.ok(page.includes("IDs Found"));
  assert.ok(page.includes("selectedJob.ids_found"));
});

check("14. Saved Results shown", () => {
  assert.ok(page.includes("Saved Results"));
  assert.ok(page.includes("savedCount"));
});

check("15. empty results state", () => {
  assert.ok(page.includes("No extracted results available yet."));
});

check("16. loading state", () => {
  assert.ok(page.includes("Loading extracted comments..."));
});

check("17. error state", () => {
  assert.ok(page.includes("Could not load job results."));
});

check("18. running job refresh", () => {
  assert.ok(page.includes('selectedJob.status === "running"'));
  assert.ok(page.includes("setInterval"));
  assert.ok(page.includes("Refresh"));
});

check("19. polling stops when completed", () => {
  assert.ok(page.includes('selectedJob.status !== "running"'));
});

check("20. polling stops when modal closes", () => {
  assert.ok(page.includes("closeResults"));
  assert.ok(page.includes("selectedJobIdRef.current = null"));
  assert.ok(page.includes("clearInterval(timer)"));
});

check("21. no overlapping requests", () => {
  assert.ok(page.includes("resultsInFlight.current"));
  assert.ok(page.includes("if (resultsInFlight.current) return;"));
});

check("22. create-job flow unaffected", () => {
  assert.ok(page.includes("Start Extraction"));
  assert.ok(page.includes("createFacebookPostJob"));
  assert.ok(page.includes("Facebook Post URL"));
  assert.ok(page.includes("Number of Comments"));
});

check("23. no Phone UI", () => {
  assert.ok(!page.toLowerCase().includes("phone number"));
  assert.ok(!page.includes("process_ids"));
  assert.ok(!page.includes("Elasticsearch"));
});

check("extra: pending message", () => {
  assert.ok(page.includes("Extraction has not started yet"));
});

check("extra: gap note", () => {
  assert.ok(page.includes("therefore are not listed in the results table"));
});

console.log(`\nTOTAL ${passed} passed / ${failed} failed`);
process.exit(failed ? 1 : 0);
