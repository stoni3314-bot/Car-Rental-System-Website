const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "..");

const startServer = async () => {
  const dataDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "rentmyride-admin-test-"));
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(projectRoot, "server.js")], {
    cwd: projectRoot,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "development",
      DEMO_PAYMENTS: "false",
      ADMIN_EMAIL: "owner@example.test",
      ADMIN_PASSWORD: "strong-local-admin-password",
      DATA_DIR: dataDirectory,
    },
    stdio: "ignore",
  });
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Test server exited with code ${child.exitCode}`);
    try {
      if ((await fetch(`${baseUrl}/api/cars`)).ok) return { baseUrl, child, dataDirectory };
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

const postJson = (url, body, cookie, origin) => fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(cookie ? { Cookie: cookie } : {}),
    ...(origin ? { Origin: origin } : {}),
  },
  body: JSON.stringify(body),
});

test("public visitors can browse and contact support; only the configured admin can manage fleet and tickets", async (t) => {
  const server = await startServer();
  t.after(() => stopServer(server));

  const homeResponse = await fetch(`${server.baseUrl}/`);
  assert.equal(homeResponse.headers.get("x-frame-options"), "DENY");
  assert.match(homeResponse.headers.get("content-security-policy"), /frame-ancestors 'none'/);

  const carsResponse = await fetch(`${server.baseUrl}/api/cars`);
  assert.equal(carsResponse.status, 200);
  assert.equal(carsResponse.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await carsResponse.json()).cars.length, 8);

  const supportResponse = await postJson(`${server.baseUrl}/api/support`, {
    name: "Visitor",
    email: "visitor@example.test",
    subject: "Rental question",
    message: "Can I pick up a car on Saturday?",
  });
  assert.equal(supportResponse.status, 201);
  const { ticketId } = await supportResponse.json();

  const deniedAnonymous = await fetch(`${server.baseUrl}/api/admin/support`);
  assert.equal(deniedAnonymous.status, 401);

  const customerRegistration = await postJson(`${server.baseUrl}/api/auth/register`, {
    name: "Customer",
    email: "customer@example.test",
    password: "customer-password-123",
  });
  assert.equal(customerRegistration.status, 201);
  const customerCookie = customerRegistration.headers.get("set-cookie").split(";")[0];
  const deniedCustomer = await fetch(`${server.baseUrl}/api/admin/support`, { headers: { Cookie: customerCookie } });
  assert.equal(deniedCustomer.status, 403);

  const reservedRegistration = await postJson(`${server.baseUrl}/api/auth/register`, {
    name: "Impersonator",
    email: "owner@example.test",
    password: "customer-password-123",
  });
  assert.equal(reservedRegistration.status, 409);

  const wrongAdminLogin = await postJson(`${server.baseUrl}/api/auth/login`, {
    email: "owner@example.test",
    password: "wrong-admin-password",
  });
  assert.equal(wrongAdminLogin.status, 401);

  const adminLogin = await postJson(`${server.baseUrl}/api/auth/login`, {
    email: "owner@example.test",
    password: "strong-local-admin-password",
  }, undefined, server.baseUrl);
  assert.equal(adminLogin.status, 200);
  const { user } = await adminLogin.json();
  assert.equal(user.isAdmin, true);
  assert.doesNotMatch(adminLogin.headers.get("set-cookie"), /Max-Age=/i);
  const adminCookie = adminLogin.headers.get("set-cookie").split(";")[0];

  const crossOriginMutation = await fetch(`${server.baseUrl}/api/admin/cars`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://attacker.example",
      "Sec-Fetch-Site": "cross-site",
      Cookie: adminCookie,
    },
    body: JSON.stringify({ name: "Injected car" }),
  });
  assert.equal(crossOriginMutation.status, 403);

  const ticketsResponse = await fetch(`${server.baseUrl}/api/admin/support`, { headers: { Cookie: adminCookie } });
  const tickets = await ticketsResponse.json();
  assert.equal(ticketsResponse.status, 200);
  assert.equal(tickets.tickets[0].id, ticketId);

  const updateTicket = await fetch(`${server.baseUrl}/api/admin/support/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ status: "resolved" }),
  });
  assert.equal(updateTicket.status, 200);

  const createCar = await postJson(`${server.baseUrl}/api/admin/cars`, {
    name: "Test EV",
    category: "EV",
    transmission: "Automatic",
    dailyRate: 4200,
    image: "assets/images/rental-1.png",
  }, adminCookie);
  assert.equal(createCar.status, 201);
  const { car } = await createCar.json();

  const publicCarsAfterAdd = await fetch(`${server.baseUrl}/api/cars`).then((response) => response.json());
  assert.equal(publicCarsAfterAdd.cars.length, 9);
  assert.equal(publicCarsAfterAdd.cars.at(-1).id, car.id);

  const updateCar = await fetch(`${server.baseUrl}/api/admin/cars/${car.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ ...car, name: "Updated EV", dailyRate: 4500 }),
  });
  assert.equal(updateCar.status, 200);
  assert.equal((await updateCar.json()).car.name, "Updated EV");

  const deleteCar = await fetch(`${server.baseUrl}/api/admin/cars/${car.id}`, {
    method: "DELETE",
    headers: { Cookie: adminCookie },
  });
  assert.equal(deleteCar.status, 200);
  const publicCarsAfterDelete = await fetch(`${server.baseUrl}/api/cars`).then((response) => response.json());
  assert.equal(publicCarsAfterDelete.cars.length, 8);
});

test("administrator login locks out repeated password failures", async (t) => {
  const server = await startServer();
  t.after(() => stopServer(server));

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await postJson(`${server.baseUrl}/api/auth/login`, {
      email: "owner@example.test",
      password: "incorrect-admin-password",
    });
    assert.equal(response.status, 401);
  }

  const locked = await postJson(`${server.baseUrl}/api/auth/login`, {
    email: "owner@example.test",
    password: "strong-local-admin-password",
  });
  assert.equal(locked.status, 429);
  assert.equal((await locked.json()).code, "ADMIN_LOGIN_LOCKED");
});
