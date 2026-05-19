// scripts/smoke-test-tenant-icons.mjs
//
// Manual smoke test for the dynamic PWA icon endpoint.
// Requires the dev server running on PORT (default 3000).
//
// Usage:
//   npm run dev          # in one terminal
//   node scripts/smoke-test-tenant-icons.mjs <slug>
//
// What it checks:
//   1. /api/icons/<slug>/192.png?v=test → PNG bytes, dynamic header
//   2. /api/icons/<slug>/180.png?v=test → PNG bytes (apple-touch-icon size)
//   3. /api/icons/<slug>/999.png?v=test → 400 (unsupported size)
//   4. /api/icons/<slug>/192.txt → 400 (bad extension)
//   5. /api/icons/__definitely_not_a_tenant__/192.png → default header
//
// Exit code is non-zero if any check fails.

const PORT = process.env.PORT ?? "3000";
const HOST = `http://localhost:${PORT}`;

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/smoke-test-tenant-icons.mjs <slug>");
  process.exit(2);
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

async function expect(label, fn) {
  try {
    await fn();
    console.log(`✓ ${label}`);
  } catch (err) {
    console.error(`✗ ${label}: ${err.message}`);
    process.exitCode = 1;
  }
}

async function getBytes(url) {
  const res = await fetch(url);
  return { res, body: Buffer.from(await res.arrayBuffer()) };
}

await expect("dynamic 192 PNG returns image bytes", async () => {
  const { res, body } = await getBytes(`${HOST}/api/icons/${slug}/192.png?v=t`);
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  if (res.headers.get("content-type") !== "image/png")
    throw new Error(`content-type ${res.headers.get("content-type")}`);
  if (!body.subarray(0, 4).equals(PNG_MAGIC))
    throw new Error("not a PNG (magic bytes)");
});

await expect("dynamic 180 PNG (apple-touch-icon size)", async () => {
  const { res, body } = await getBytes(`${HOST}/api/icons/${slug}/180.png?v=t`);
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  if (!body.subarray(0, 4).equals(PNG_MAGIC)) throw new Error("not a PNG");
});

await expect("999 → 400", async () => {
  const res = await fetch(`${HOST}/api/icons/${slug}/999.png?v=t`);
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
});

await expect("bad extension → 400", async () => {
  const res = await fetch(`${HOST}/api/icons/${slug}/192.txt`);
  if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
});

await expect("unknown tenant → falls back", async () => {
  const { res, body } = await getBytes(
    `${HOST}/api/icons/__definitely_not_a_tenant__/192.png?v=t`
  );
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  if (res.headers.get("x-topcoach-icon-source") !== "default")
    throw new Error(
      `source header ${res.headers.get("x-topcoach-icon-source")}`
    );
  if (!body.subarray(0, 4).equals(PNG_MAGIC)) throw new Error("not a PNG");
});

if (process.exitCode) {
  console.error("\nSome checks failed.");
} else {
  console.log("\nAll smoke checks passed.");
}
