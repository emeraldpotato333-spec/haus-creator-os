import assert from "node:assert/strict";
import test from "node:test";
import { GET as listRecords } from "../src/app/api/headquarters/route";
import { GET as health } from "../src/app/api/headquarters/health/route";
import { GET as readRecord, PATCH as patchRecord } from "../src/app/api/headquarters/[id]/route";

test("unconfigured deployment returns no creator data on list, detail or health", async () => {
  const previous = process.env.HQ_ENABLED;
  process.env.HQ_ENABLED = "false";
  try {
    const context = { params: Promise.resolve({ id: "instagram:sample_creator" }) };
    const responses = await Promise.all([
      listRecords(), readRecord(new Request("https://hq.example.com/api/headquarters/sample"), context), health(),
    ]);
    for (const response of responses) {
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal("records" in body, false);
      assert.equal("data" in body, false);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    }
  } finally {
    if (previous === undefined) delete process.env.HQ_ENABLED;
    else process.env.HQ_ENABLED = previous;
  }
});

test("cross-origin writes are rejected before touching storage", async () => {
  const response = await patchRecord(new Request("https://hq.example.com/api/headquarters/sample", {
    method: "PATCH",
    headers: { origin: "https://untrusted.example.com", "content-type": "application/json" },
    body: JSON.stringify({ version: 1, changes: { owner: "William" } }),
  }), { params: Promise.resolve({ id: "instagram:sample_creator" }) });
  assert.equal(response.status, 403);
  assert.equal("record" in await response.json(), false);
});

test("non-JSON writes fail before parsing or storage", async () => {
  const response = await patchRecord(new Request("https://hq.example.com/api/headquarters/sample", {
    method: "PATCH", headers: { origin: "https://hq.example.com", "content-type": "text/plain" }, body: "not JSON",
  }), { params: Promise.resolve({ id: "instagram:sample_creator" }) });
  assert.equal(response.status, 415);
});
