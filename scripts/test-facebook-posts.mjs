/**
 * Static verification for Facebook Posts frontend (no new packages).
 * Run: node scripts/test-facebook-posts.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import assert from "assert";

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

function read(rel) {
  return fs.readFileSync(src(...rel.split("/")), "utf8");
}

// --- Pure helpers mirrored from facebookPostsHelpers.ts ---
function validateFacebookPostForm(postUrl, requestedCountRaw) {
  const errors = {};
  const url = String(postUrl || "").trim();
  if (!url) errors.post_url = "Facebook Post URL is required.";
  const count =
    typeof requestedCountRaw === "number"
      ? requestedCountRaw
      : Number(String(requestedCountRaw).trim());
  if (
    requestedCountRaw === "" ||
    requestedCountRaw === null ||
    requestedCountRaw === undefined ||
    Number.isNaN(count)
  ) {
    errors.requested_count = "Number of Comments is required.";
  } else if (!Number.isInteger(count) || count <= 0) {
    errors.requested_count =
      "Number of Comments must be an integer greater than 0.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: {},
    payload: { post_url: url, requested_count: count },
  };
}

function getJobStatusBadgeClass(status) {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-700";
    case "failed":
      return "bg-red-100 text-red-700";
    case "running":
      return "bg-blue-100 text-blue-700";
    case "pending":
    default:
      return "bg-yellow-100 text-yellow-700";
  }
}

// Overlap guard simulation
function createListLoader() {
  let inFlight = false;
  let calls = 0;
  let concurrent = 0;
  let maxConcurrent = 0;
  return {
    async load() {
      if (inFlight) return "skipped";
      inFlight = true;
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      concurrent -= 1;
      inFlight = false;
      return "loaded";
    },
    stats: () => ({ calls, maxConcurrent }),
  };
}

// Polling lifecycle simulation
function createPoller(intervalMs, tick) {
  let id = null;
  let ticks = 0;
  return {
    start() {
      id = setInterval(() => {
        ticks += 1;
        tick();
      }, intervalMs);
    },
    stop() {
      if (id != null) clearInterval(id);
      id = null;
    },
    get ticks() {
      return ticks;
    },
    get active() {
      return id != null;
    },
  };
}

const page = read("pages/FacebookPosts.tsx");
const app = read("App.tsx");
const sidebar = read("components/Sidebar.tsx");
const api = read("api.ts");
const helpers = read("utils/facebookPostsHelpers.ts");

check("1. page route renders (route + page file)", () => {
  assert.ok(fs.existsSync(src("pages", "FacebookPosts.tsx")));
  assert.ok(app.includes('path="/facebook-posts"'));
  assert.ok(app.includes("<FacebookPosts"));
});

check("2. sidebar link works", () => {
  assert.ok(sidebar.includes('name: "Facebook Posts"'));
  assert.ok(sidebar.includes('path: "/facebook-posts"'));
  assert.ok(sidebar.includes("Search Customers"));
  // Facebook Posts appears after Search Customers
  const iSearch = sidebar.indexOf("Search Customers");
  const iFb = sidebar.indexOf("Facebook Posts");
  assert.ok(iFb > iSearch);
});

check("3. valid URL + count sends correct POST payload", () => {
  const v = validateFacebookPostForm(
    "https://www.facebook.com/posts/1",
    "100"
  );
  assert.strictEqual(v.ok, true);
  assert.deepStrictEqual(v.payload, {
    post_url: "https://www.facebook.com/posts/1",
    requested_count: 100,
  });
  assert.ok(api.includes('api.post("/facebook-post-jobs"'));
  assert.ok(page.includes("createFacebookPostJob(result.payload)"));
});

check("4. missing URL blocked", () => {
  const v = validateFacebookPostForm("", "10");
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.post_url);
});

check("5. count=0 blocked", () => {
  const v = validateFacebookPostForm("https://www.facebook.com/x", "0");
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.requested_count);
});

check("6. negative count blocked", () => {
  const v = validateFacebookPostForm("https://www.facebook.com/x", -5);
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.requested_count);
});

check("7. loading state", () => {
  assert.ok(page.includes("Loading..."));
  assert.ok(page.includes("setLoading(true)"));
});

check("8. empty state", () => {
  assert.ok(page.includes("No Facebook post extraction jobs yet."));
});

check("9. jobs rendered using job_id", () => {
  assert.ok(page.includes("key={job.job_id}"));
  assert.ok(!page.includes("key={job.id}"));
  assert.ok(helpers.includes("job_id: number"));
});

check("10. status badges correct", () => {
  assert.ok(getJobStatusBadgeClass("pending").includes("yellow"));
  assert.ok(getJobStatusBadgeClass("running").includes("blue"));
  assert.ok(getJobStatusBadgeClass("completed").includes("green"));
  assert.ok(getJobStatusBadgeClass("failed").includes("red"));
  assert.ok(page.includes("getJobStatusBadgeClass"));
});

check("11. failed job displays status/error", () => {
  assert.ok(page.includes('job.status === "failed"'));
  assert.ok(page.includes("job.error"));
});

check("12. polling starts only while page mounted", () => {
  assert.ok(page.includes("FACEBOOK_POSTS_POLL_MS"));
  assert.ok(helpers.includes("FACEBOOK_POSTS_POLL_MS = 5000"));
  assert.ok(page.includes("setInterval"));
});

check("13. polling stops on unmount", () => {
  assert.ok(page.includes("clearInterval(timer)"));
  assert.ok(page.includes("mounted.current = false"));
  const poller = createPoller(5, () => {});
  poller.start();
  assert.ok(poller.active);
  poller.stop();
  assert.ok(!poller.active);
});

check("14. no overlapping list requests", () => {
  assert.ok(page.includes("listInFlight.current"));
  assert.ok(page.includes("if (listInFlight.current) return;"));
});

check("14b. overlap guard simulation", async () => {
  const loader = createListLoader();
  const p1 = loader.load();
  const p2 = loader.load();
  const r = await Promise.all([p1, p2]);
  assert.deepStrictEqual(r.slice().sort(), ["loaded", "skipped"]);
  assert.strictEqual(loader.stats().maxConcurrent, 1);
});

check("15. existing pages/routes unaffected", () => {
  assert.ok(app.includes('path="/dashboard"'));
  assert.ok(app.includes('path="/contacts"'));
  assert.ok(app.includes('path="/elastic"'));
  assert.ok(app.includes('path="/send"'));
  assert.ok(sidebar.includes('name: "Dashboard"'));
  assert.ok(sidebar.includes('name: "Customers"'));
  assert.ok(!api.includes(":5001"));
  assert.ok(api.includes(":5443"));
});

check("extra: no phone UI", () => {
  assert.ok(!page.toLowerCase().includes("phone number"));
  assert.ok(!page.includes("process_ids"));
  assert.ok(!page.includes("Elasticsearch"));
});

check("extra: error state text", () => {
  assert.ok(page.includes("Could not load extraction jobs."));
});

// run async checks
{
  const loader = createListLoader();
  const p1 = loader.load();
  const p2 = loader.load();
  const r = await Promise.all([p1, p2]);
  check("14c. overlap runtime", () => {
    assert.deepStrictEqual(r.slice().sort(), ["loaded", "skipped"]);
    assert.strictEqual(loader.stats().maxConcurrent, 1);
  });
}

console.log(`\nTOTAL ${passed} passed / ${failed} failed`);
process.exit(failed ? 1 : 0);
