const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);
const root = __dirname;
let dataDirectory = path.join(root, ".data");
let dataFile = path.join(dataDirectory, "store.json");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const catalog = {
  "rental-1": { name: "Punch", dailyRate: 2999 },
  "rental-2": { name: "Nexon", dailyRate: 6999 },
  "rental-3": { name: "Harrier", dailyRate: 4999 },
  "rental-4": { name: "Altroz", dailyRate: 7999 },
  "rental-5": { name: "Tigor", dailyRate: 1399 },
  "rental-6": { name: "Punch", dailyRate: 5999 },
  "rental-7": { name: "Punch", dailyRate: 1999 },
  "rental-8": { name: "GTS40", dailyRate: 11999 },
};
const pendingRegistrationEmails = new Set();
const dummySalt = "rentmyride-fixed-login-salt";
const dummyPasswordHash = crypto.scryptSync("invalid-password", dummySalt, 64).toString("hex");

const loadEnvironment = async () => {
  try {
    const contents = await fs.readFile(path.join(root, ".env"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
};

const emptyStore = () => ({ users: [], sessions: [], bookings: [], webhookEvents: [] });
let store = emptyStore();
let writeQueue = Promise.resolve();

const saveStore = () => {
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    await fs.mkdir(dataDirectory, { recursive: true });
    const temporaryFile = `${dataFile}.tmp`;
    await fs.writeFile(temporaryFile, JSON.stringify(store, null, 2), { mode: 0o600 });
    await fs.rename(temporaryFile, dataFile);
  });
  return writeQueue;
};

const loadStore = async () => {
  try {
    const contents = await fs.readFile(dataFile, "utf8");
    const parsed = JSON.parse(contents);
    store = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      webhookEvents: Array.isArray(parsed.webhookEvents) ? parsed.webhookEvents : [],
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await saveStore();
  }
};

class HttpError extends Error {
  constructor(status, message, code = "REQUEST_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const sendJson = (response, status, value, headers = {}) => {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(JSON.stringify(value));
};

const readRawBody = (request, maximumBytes = 16384) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  request.on("data", (chunk) => {
    size += chunk.length;
    if (size > maximumBytes) {
      reject(new HttpError(413, "Request is too large."));
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });
  request.on("end", () => resolve(Buffer.concat(chunks)));
  request.on("error", reject);
});

const readJson = async (request) => {
  const raw = await readRawBody(request);
  try {
    const value = JSON.parse(raw.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object");
    return value;
  } catch {
    throw new HttpError(400, "Invalid request data.");
  }
};

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email });

const safeEqual = (left, right) => {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const signatureMatches = (expected, received) => {
  if (typeof received !== "string" || !/^[a-f0-9]{64}$/i.test(received)) return false;
  return safeEqual(expected.toLowerCase(), received.toLowerCase());
};

const cookieToken = (request) => {
  const cookie = request.headers.cookie || "";
  const entry = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("rmr_session="));
  return entry ? decodeURIComponent(entry.slice("rmr_session=".length)) : "";
};

const tokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");

const getSession = (request) => {
  const token = cookieToken(request);
  if (!token) return null;
  const hash = tokenHash(token);
  const session = store.sessions.find((item) => item.tokenHash === hash && item.expiresAt > Date.now());
  if (!session) return null;
  const user = store.users.find((item) => item.id === session.userId);
  return user ? { session, user } : null;
};

const requireUser = (request) => {
  const current = getSession(request);
  if (!current) throw new HttpError(401, "Please sign in to continue.", "AUTH_REQUIRED");
  return current.user;
};

const sessionCookie = (token, maxAge) => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const expiry = maxAge ? `; Max-Age=${maxAge}` : "";
  return `rmr_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${expiry}${secure}`;
};

const createSession = async (response, user, remember) => {
  const maxAge = remember ? 30 * 24 * 60 * 60 : 12 * 60 * 60;
  const token = crypto.randomBytes(32).toString("base64url");
  store.sessions = store.sessions.filter((session) => session.expiresAt > Date.now());
  store.sessions.push({
    tokenHash: tokenHash(token),
    userId: user.id,
    expiresAt: Date.now() + maxAge * 1000,
  });
  await saveStore();
  return { "Set-Cookie": sessionCookie(token, remember ? maxAge : 0) };
};

const paymentCredentialsReady = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const razorpayRequest = async (endpoint, options = {}) => {
  const credentials = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  let response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new HttpError(502, "Could not reach the payment provider. Please try again.", "PAYMENT_PROVIDER_UNAVAILABLE");
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 401
      ? "Razorpay rejected the configured keys. Check your test or live credentials."
      : "The payment provider could not create or verify this payment.";
    throw new HttpError(502, message, "PAYMENT_PROVIDER_ERROR");
  }
  return result;
};

const parseDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};

const createPaymentOrder = async (request, response) => {
  const user = requireUser(request);
  if (!paymentCredentialsReady()) {
    throw new HttpError(503, "Online payments are not configured. Add Razorpay keys to the .env file.", "PAYMENTS_NOT_CONFIGURED");
  }
  const body = await readJson(request);
  const car = catalog[body.carId];
  const startDate = parseDate(body.startDate);
  const returnDate = parseDate(body.returnDate);
  if (!car || !startDate || !returnDate) throw new HttpError(400, "Choose a car and valid rental dates.");
  const days = Math.ceil((returnDate.getTime() - startDate.getTime()) / 86400000);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (startDate < today || days < 1 || days > 90) {
    throw new HttpError(400, "Pick-up must be today or later, and rentals can be 1 to 90 days.");
  }

  const total = car.dailyRate * days;
  const bookingId = crypto.randomUUID();
  const receipt = `rr_${crypto.randomUUID().replaceAll("-", "").slice(0, 32)}`;
  const order = await razorpayRequest("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: total * 100,
      currency: "INR",
      receipt,
      notes: { booking_id: bookingId, car_id: body.carId, user_id: user.id },
    }),
  });
  if (!order.id || order.amount !== total * 100 || order.currency !== "INR") {
    throw new HttpError(502, "Payment order details did not match the rental total.", "PAYMENT_ORDER_MISMATCH");
  }

  store.bookings.push({
    id: bookingId,
    userId: user.id,
    carId: body.carId,
    carName: car.name,
    dailyRate: car.dailyRate,
    days,
    startDate: body.startDate,
    returnDate: body.returnDate,
    total,
    currency: "INR",
    orderId: order.id,
    paymentId: null,
    status: "created",
    createdAt: new Date().toISOString(),
  });
  await saveStore();
  sendJson(response, 201, {
    bookingId,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    carName: car.name,
    days,
  });
};

const verifyPayment = async (request, response) => {
  const user = requireUser(request);
  if (!paymentCredentialsReady()) {
    throw new HttpError(503, "Online payments are not configured.", "PAYMENTS_NOT_CONFIGURED");
  }
  const body = await readJson(request);
  const orderId = body.razorpay_order_id;
  const paymentId = body.razorpay_payment_id;
  const signature = body.razorpay_signature;
  if (typeof orderId !== "string" || !/^order_[A-Za-z0-9]+$/.test(orderId)
      || typeof paymentId !== "string" || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    throw new HttpError(400, "Payment details are incomplete.", "INVALID_PAYMENT_DETAILS");
  }
  const booking = store.bookings.find((item) => item.orderId === orderId && item.userId === user.id);
  if (!booking) throw new HttpError(404, "This payment order was not found.", "ORDER_NOT_FOUND");
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${booking.orderId}|${paymentId}`)
    .digest("hex");
  if (!signatureMatches(expected, signature)) {
    throw new HttpError(400, "Payment signature could not be verified.", "INVALID_PAYMENT_SIGNATURE");
  }
  if (booking.status === "paid") {
    sendJson(response, 200, { status: booking.status, bookingId: booking.id });
    return;
  }

  const payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
  if (payment.order_id !== booking.orderId || payment.amount !== booking.total * 100 || payment.currency !== booking.currency) {
    throw new HttpError(400, "Payment details do not match this booking.", "PAYMENT_DETAILS_MISMATCH");
  }
  if (payment.status !== "captured") {
    booking.paymentId = paymentId;
    booking.status = payment.status === "authorized" ? "awaiting_capture" : "failed";
    await saveStore();
    sendJson(response, 202, { status: booking.status });
    return;
  }

  booking.paymentId = paymentId;
  booking.status = "paid";
  booking.paidAt = new Date().toISOString();
  await saveStore();
  sendJson(response, 200, { status: booking.status, bookingId: booking.id });
};

const handlePaymentWebhook = async (request, response) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    throw new HttpError(503, "Payment webhook is not configured.", "WEBHOOK_NOT_CONFIGURED");
  }
  const raw = await readRawBody(request, 1024 * 1024);
  const received = request.headers["x-razorpay-signature"];
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex");
  if (!signatureMatches(expected, received)) throw new HttpError(400, "Webhook signature could not be verified.", "INVALID_WEBHOOK_SIGNATURE");
  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
    if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("Expected an object");
  } catch {
    throw new HttpError(400, "Invalid webhook data.");
  }
  const eventId = request.headers["x-razorpay-event-id"];
  if (eventId && store.webhookEvents.includes(eventId)) {
    sendJson(response, 200, { received: true });
    return;
  }

  const payment = event.payload?.payment?.entity;
  if (payment?.order_id && ["payment.captured", "payment.failed"].includes(event.event)) {
    const booking = store.bookings.find((item) => item.orderId === payment.order_id);
    if (booking && payment.amount === booking.total * 100 && payment.currency === booking.currency) {
      if (event.event === "payment.captured") {
        booking.paymentId = payment.id;
        booking.status = "paid";
        booking.paidAt = new Date().toISOString();
      } else if (booking.status !== "paid") {
        booking.paymentId = payment.id;
        booking.status = "failed";
      }
    }
  }
  if (eventId) store.webhookEvents = [...store.webhookEvents, eventId].slice(-1000);
  await saveStore();
  sendJson(response, 200, { received: true });
};

const authRateLimits = new Map();
const enforceAuthRateLimit = (request) => {
  const address = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = authRateLimits.get(address) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + 15 * 60 * 1000;
  }
  current.count += 1;
  authRateLimits.set(address, current);
  if (authRateLimits.size > 10000) authRateLimits.clear();
  if (current.count > 20) throw new HttpError(429, "Too many attempts. Please try again in 15 minutes.", "RATE_LIMITED");
};

const handleAuth = async (request, response, pathname) => {
  if (pathname === "/api/auth/me" && request.method === "GET") {
    const current = getSession(request);
    sendJson(response, 200, { user: current ? publicUser(current.user) : null });
    return;
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    const current = getSession(request);
    if (current) {
      store.sessions = store.sessions.filter((item) => item.tokenHash !== current.session.tokenHash);
      await saveStore();
    }
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    sendJson(response, 200, { ok: true }, { "Set-Cookie": `rmr_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}` });
    return;
  }

  if (["/api/auth/login", "/api/auth/register"].includes(pathname) && request.method === "POST") {
    enforceAuthRateLimit(request);
    const body = await readJson(request);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new HttpError(400, "Enter a valid email address.", "INVALID_EMAIL");
    }
    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 1024) {
      throw new HttpError(400, "Password must be at least 8 characters.", "INVALID_PASSWORD");
    }

    let user;
    if (pathname.endsWith("/register")) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 80) throw new HttpError(400, "Enter your name.", "INVALID_NAME");
      if (store.users.some((item) => item.email === email) || pendingRegistrationEmails.has(email)) {
        throw new HttpError(409, "An account with this email already exists. Login instead.", "EMAIL_IN_USE");
      }
      pendingRegistrationEmails.add(email);
      try {
        const salt = crypto.randomBytes(16).toString("hex");
        const passwordHash = await scrypt(password, salt, 64);
        user = { id: crypto.randomUUID(), name, email, salt, passwordHash: passwordHash.toString("hex"), createdAt: new Date().toISOString() };
        store.users.push(user);
      } finally {
        pendingRegistrationEmails.delete(email);
      }
    } else {
      user = store.users.find((item) => item.email === email);
      const salt = user?.salt || dummySalt;
      const expected = user?.passwordHash || dummyPasswordHash;
      const candidate = (await scrypt(password, salt, 64)).toString("hex");
      if (!user || !safeEqual(candidate, expected)) {
        throw new HttpError(401, "Email or password is incorrect.", "INVALID_CREDENTIALS");
      }
    }
    const headers = await createSession(response, user, body.remember === true);
    sendJson(response, pathname.endsWith("/register") ? 201 : 200, { user: publicUser(user) }, headers);
    return;
  }

  throw new HttpError(404, "Endpoint not found.", "NOT_FOUND");
};

const serveFile = async (request, response, pathname) => {
  const decoded = decodeURIComponent(pathname);
  const requested = decoded === "/" ? "/index.html" : decoded;
  if (requested !== "/index.html" && !requested.startsWith("/assets/")) {
    throw new HttpError(404, "File not found.", "NOT_FOUND");
  }
  const filePath = path.resolve(root, `.${requested}`);
  const relative = path.relative(root, filePath);
  const normalizedRelative = relative.split(path.sep).join("/");
  if (relative.startsWith("..") || path.isAbsolute(relative)
      || (normalizedRelative !== "index.html" && !normalizedRelative.startsWith("assets/"))) {
    throw new HttpError(404, "File not found.", "NOT_FOUND");
  }
  let contents;
  try {
    contents = await fs.readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") throw new HttpError(404, "File not found.", "NOT_FOUND");
    throw error;
  }
  response.writeHead(200, {
    "Cache-Control": path.extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600",
    "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method === "HEAD") response.end();
  else response.end(contents);
};

const handleRequest = async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    const pathname = url.pathname;
    if (pathname === "/api/config" && request.method === "GET") {
      sendJson(response, 200, {
        enabled: paymentCredentialsReady(),
        keyId: paymentCredentialsReady() ? process.env.RAZORPAY_KEY_ID : "",
      });
      return;
    }
    if (pathname.startsWith("/api/auth/")) {
      await handleAuth(request, response, pathname);
      return;
    }
    if (pathname === "/api/bookings" && request.method === "GET") {
      const user = requireUser(request);
      const bookings = store.bookings
        .filter((booking) => booking.userId === user.id && ["paid", "awaiting_capture"].includes(booking.status))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(({ id, carName, startDate, returnDate, days, total, status, createdAt }) => ({
          id, carName, startDate, returnDate, days, total, status, createdAt,
        }));
      sendJson(response, 200, { bookings });
      return;
    }
    if (pathname === "/api/payments/order" && request.method === "POST") {
      await createPaymentOrder(request, response);
      return;
    }
    if (pathname === "/api/payments/verify" && request.method === "POST") {
      await verifyPayment(request, response);
      return;
    }
    if (pathname === "/api/payments/webhook" && request.method === "POST") {
      await handlePaymentWebhook(request, response);
      return;
    }
    if (pathname.startsWith("/api/")) throw new HttpError(404, "Endpoint not found.", "NOT_FOUND");
    if (!["GET", "HEAD"].includes(request.method)) throw new HttpError(405, "Method not allowed.", "METHOD_NOT_ALLOWED");
    await serveFile(request, response, pathname);
  } catch (error) {
    if (response.headersSent || response.destroyed) return;
    if (!(error instanceof HttpError)) console.error(error);
    sendJson(response, error.status || 500, {
      error: error instanceof HttpError ? error.message : "The server encountered an error.",
      code: error.code || "INTERNAL_ERROR",
    });
  }
};

const start = async () => {
  await loadEnvironment();
  if (process.env.DATA_DIR) {
    dataDirectory = path.resolve(root, process.env.DATA_DIR);
    dataFile = path.join(dataDirectory, "store.json");
  }
  await loadStore();
  const port = Number(process.env.PORT) || 4173;
  const host = process.env.HOST || "127.0.0.1";
  const server = http.createServer((request, response) => void handleRequest(request, response));
  server.listen(port, host, () => console.log(`RentMyRide listening at http://${host}:${port}`));
};

start().catch((error) => {
  console.error("Could not start RentMyRide:", error);
  process.exitCode = 1;
});
