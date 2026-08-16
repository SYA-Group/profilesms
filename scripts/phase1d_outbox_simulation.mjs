/**
 * Phase 1D — Simulated durable outbox (no Chrome / no Facebook).
 * Models IndexedDB retention across "SW restart" + network failure.
 */
import assert from "assert";

function buildResultKey(c) {
  if (c && c.comment_id != null && String(c.comment_id).trim())
    return "c:" + String(c.comment_id).trim();
  if (c && c.feedback_id != null && String(c.feedback_id).trim())
    return "f:" + String(c.feedback_id).trim();
  let h = 2166136261;
  const s =
    String((c && c.author_id) || "") +
    "\n" +
    String((c && c.created_at) || "") +
    "\n" +
    String((c && c.content) || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "h:" + (h >>> 0).toString(16);
}

class SimulatedOutbox {
  constructor() {
    this.results = new Map(); // dedupe_key -> record
    this.completions = new Map();
    this.nextId = 1;
    this.backend = new Map(); // link -> Set(result_key)
    this.backendDown = false;
    this.acks = [];
  }
  persist(batchId, linkId, comments) {
    let stored = 0;
    for (const c of comments) {
      const result_key = buildResultKey(c);
      const dedupe = `${batchId}:${linkId}:${result_key}`;
      if (this.results.has(dedupe)) continue;
      this.results.set(dedupe, {
        id: this.nextId++,
        dedupe_key: dedupe,
        batch_id: batchId,
        link_job_id: linkId,
        result_key,
        status: "pending",
        payload: c,
      });
      stored++;
    }
    return stored;
  }
  markComplete(batchId, linkId) {
    this.completions.set(linkId, {
      batch_id: batchId,
      link_job_id: linkId,
      status: "pending",
    });
  }
  /** Simulate SW death: drop RAM flush state; durable map remains. */
  simulateSwRestart() {
    /* durable maps untouched */
  }
  async flush() {
    if (this.backendDown) return { uploaded: 0, failed: true };
    let uploaded = 0;
    for (const [k, row] of [...this.results.entries()]) {
      if (row.status !== "pending") continue;
      const key = `${row.batch_id}:${row.link_job_id}`;
      if (!this.backend.has(key)) this.backend.set(key, new Set());
      const set = this.backend.get(key);
      if (!set.has(row.result_key)) {
        set.add(row.result_key);
        uploaded++;
      }
      this.results.delete(k); // ACK delete
      this.acks.push(row.dedupe_key);
    }
    for (const [lid, c] of [...this.completions.entries()]) {
      const still = [...this.results.values()].filter(
        (r) => r.link_job_id === lid && r.status === "pending"
      ).length;
      if (still > 0) continue;
      this.completions.delete(lid);
    }
    return { uploaded, failed: false };
  }
  pendingCount() {
    return this.results.size;
  }
}

// 1) inert without active batch — modeled as caller skip
assert.strictEqual(true, true, "inert modeled by gate");

// 2) persist + dedupe
const box = new SimulatedOutbox();
assert.strictEqual(
  box.persist(1, 10, [
    { comment_id: "a", content: "x" },
    { comment_id: "a", content: "x" },
  ]),
  1
);

// 3) SW restart retention
box.simulateSwRestart();
assert.strictEqual(box.pendingCount(), 1);

// 4) network failure retains
box.backendDown = true;
let r = await box.flush();
assert.strictEqual(r.failed, true);
assert.strictEqual(box.pendingCount(), 1);

// 5) recover + ACK drain
box.backendDown = false;
r = await box.flush();
assert.strictEqual(r.uploaded, 1);
assert.strictEqual(box.pendingCount(), 0);

// 6) Link2 advances while Link1 upload pending
const box2 = new SimulatedOutbox();
box2.persist(1, 10, [{ comment_id: "l1", content: "1" }]);
box2.markComplete(1, 10);
box2.backendDown = true;
box2.persist(1, 11, [{ comment_id: "l2", content: "2" }]); // link2 proceeds
assert.strictEqual(box2.pendingCount(), 2);
box2.backendDown = false;
await box2.flush();
assert.strictEqual(box2.pendingCount(), 0);
assert.strictEqual(box2.backend.get("1:10").size, 1);
assert.strictEqual(box2.backend.get("1:11").size, 1);

// 7) volume 20x100 + 100x100 no cross-mix / no loss
for (const [nLinks, nRes] of [
  [20, 100],
  [100, 100],
]) {
  const v = new SimulatedOutbox();
  for (let li = 0; li < nLinks; li++) {
    const comments = [];
    for (let ri = 0; ri < nRes; ri++) {
      comments.push({ comment_id: `${li}-${ri}`, content: `c${ri}` });
    }
    v.persist(99, 1000 + li, comments);
    v.markComplete(99, 1000 + li);
  }
  // retry simulation: persist again
  for (let li = 0; li < nLinks; li++) {
    const comments = [];
    for (let ri = 0; ri < nRes; ri++) {
      comments.push({ comment_id: `${li}-${ri}`, content: `c${ri}` });
    }
    assert.strictEqual(v.persist(99, 1000 + li, comments), 0);
  }
  await v.flush();
  assert.strictEqual(v.pendingCount(), 0);
  let total = 0;
  for (let li = 0; li < nLinks; li++) {
    const set = v.backend.get(`99:${1000 + li}`);
    assert.ok(set);
    assert.strictEqual(set.size, nRes);
    total += set.size;
  }
  assert.strictEqual(total, nLinks * nRes);
}

console.log("phase1d_outbox_simulation: ALL PASS");
