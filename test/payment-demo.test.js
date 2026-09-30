const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "..");

const getFreePort = async () => {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
};

const startServer = async ({ nodeEnv, demoPayments, razorpayKeys = false }) => {
  const dataDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "rentmyride-demo-test-"));
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    NODE_ENV: nodeEnv,
    DATA_DIR: dataDirectory,
  };
  if (demoPayments === undefined) delete env.DEMO_PAYMENTS;
  else env.DEMO_PAYMENTS = String(demoPayments);
  if (razorpayKeys) {
    env.RAZORPAY_KEY_ID = "rzp_test_demo_only";
    env.RAZORPAY_KEY_SECRET = "not-a-real-secret";
    env.RAZORPAY_WEBHOOK_SECRET = "not-a-real-webhook-secret";
  }
  const child = spawn(process.execPath, [path.join(projectRoot, "server.js")], {
    cwd: projectRoot,
    env,
    stdio: "ignore",
  });

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Test server exited with code ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/config`);
      if (response.ok) return { baseUrl, child, dataDirectory };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  child.kill();
  throw new Error("Test server did not become ready.");
};

const stopServer = async ({ child, dataDirectory }) => {
  if (child.exitCode === null) {
    const exited = once(child, "exit");
    child.kill();
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 2000))]);
  }
  await fs.rm(dataDirectory, { recursive: true, force: true });
};

test("local checkout defaults to an explicitly simulated payment without payment identifiers", async (t) => {
  const server = await startServer({ nodeEnv: "development" });
  t.after(() => stopServer(server));

  const config = await fetch(`${server.baseUrl}/api/config`).then((response) => response.json());
  assert.equal(config.demoEnabled, true);

  const registration = await fetch(`${server.baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Demo User",
      email: `demo-${crypto.randomUUID()}@example.test`,
      password: "demo-password-123",
    }),
  });
  assert.equal(registration.status, 201);
  const cookie = registration.headers.get("set-cookie").split(";")[0];

  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  const returnDate = new Date(startDate);
  returnDate.setUTCDate(returnDate.getUTCDate() + 1);
  const payment = await fetch(`${server.baseUrl}/api/payments/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      carId: "rental-1",
      startDate: startDate.toISOString().slice(0, 10),
      returnDate: returnDate.toISOString().slice(0, 10),
    }),
  });
  assert.equal(payment.status, 201);
  const result = await payment.json();
  assert.equal(result.status, "demo_paid");
  assert.equal(result.total, 2999);
  assert.equal("paymentId" in result, false);

  const history = await fetch(`${server.baseUrl}/api/bookings`, { headers: { Cookie: cookie } }).then((response) => response.json());
  assert.equal(history.bookings[0].status, "demo_paid");
  assert.equal(history.bookings[0].paymentMode, "demo");
  const savedStore = JSON.parse(await fs.readFile(path.join(server.dataDirectory, "store.json"), "utf8"));
  assert.equal(savedStore.bookings[0].status, "demo_paid");
  assert.equal(savedStore.bookings[0].paymentId, null);
  assert.equal(savedStore.bookings[0].orderId, null);
});

test("local demo payments can be disabled explicitly", async (t) => {
  const server = await startServer({ nodeEnv: "development", demoPayments: false });
  t.after(() => stopServer(server));

  const config = await fetch(`${server.baseUrl}/api/config`).then((response) => response.json());
  assert.equal(config.demoEnabled, false);
  const response = await fetch(`${server.baseUrl}/api/payments/demo`, { method: "POST" });
  assert.equal(response.status, 404);
});

test("production never enables the demo payment endpoint", async (t) => {
  const server = await startServer({ nodeEnv: "production", demoPayments: true });
  t.after(() => stopServer(server));

  const config = await fetch(`${server.baseUrl}/api/config`).then((response) => response.json());
  assert.equal(config.demoEnabled, false);
  const response = await fetch(`${server.baseUrl}/api/payments/demo`, { method: "POST" });
  assert.equal(response.status, 404);
});

test("real payment APIs remain unavailable even when provider keys exist", async (t) => {
  const server = await startServer({ nodeEnv: "development", razorpayKeys: true });
  t.after(() => stopServer(server));

  const config = await fetch(`${server.baseUrl}/api/config`).then((response) => response.json());
  assert.equal(config.enabled, false);
  assert.equal(config.keyId, "");
  assert.equal(config.demoEnabled, true);

  for (const endpoint of ["order", "verify", "webhook"]) {
    const response = await fetch(`${server.baseUrl}/api/payments/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 404, `${endpoint} must stay disabled`);
  }
});
