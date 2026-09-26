const menuIcon = document.querySelector(".menu-icon");
const navbar = document.querySelector(".navbar");
const loginModal = document.querySelector("#login-modal");
const bookingModal = document.querySelector("#booking-modal");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const bookingForm = document.querySelector("#booking-form");
const paymentMessage = document.querySelector("#payment-message");
const paymentButton = document.querySelector("#payment-submit");
const nameField = document.querySelector("#name-field");
const nameInput = nameField.querySelector("input");
const emailInput = loginForm.querySelector('input[name="email"]');
const passwordInput = loginForm.querySelector('input[name="password"]');
const bookingStart = document.querySelector("#booking-start-date");
const bookingReturn = document.querySelector("#booking-return-date");

let currentUser = null;
let authMode = "login";
let pendingCar = null;
let selectedCar = null;
let paymentConfig = { enabled: false, keyId: "" };
let previousFocus = null;

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "Something went wrong. Please try again.");
    error.code = result.code;
    throw error;
  }
  return result;
};

const closeMenu = () => {
  if (!menuIcon || !navbar) return;
  menuIcon.classList.remove("move");
  navbar.classList.remove("open-menu");
  menuIcon.setAttribute("aria-expanded", "false");
};

const syncModalLock = () => {
  document.body.classList.toggle(
    "modal-open",
    loginModal.classList.contains("show") || bookingModal.classList.contains("show"),
  );
};

const showModal = (modal, focusTarget) => {
  previousFocus = document.activeElement;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  syncModalLock();
  focusTarget?.focus();
};

const hideModal = (modal) => {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  syncModalLock();
  if (!document.body.classList.contains("modal-open") && previousFocus?.isConnected) {
    previousFocus.focus();
  }
};

const setUser = (user) => {
  currentUser = user;
  document.body.classList.toggle("is-logged-in", Boolean(user));
  const accountButton = document.querySelector(".user-trigger");
  accountButton.setAttribute("aria-label", user ? `Account for ${user.email}` : "Open login");
};

const openLogin = (car = null) => {
  pendingCar = car;
  closeMenu();
  if (currentUser) {
    openProfile();
    return;
  }
  setAuthMode("login");
  document.querySelector("#auth-view").hidden = false;
  document.querySelector("#profile-view").hidden = true;
  showModal(loginModal, emailInput);
};

const setAuthMode = (mode) => {
  authMode = mode;
  const isRegistering = mode === "register";
  nameField.hidden = !isRegistering;
  nameInput.required = isRegistering;
  passwordInput.autocomplete = isRegistering ? "new-password" : "current-password";
  passwordInput.placeholder = isRegistering ? "At least 8 characters" : "Your password";
  document.querySelector("#auth-kicker").textContent = isRegistering ? "Join RentMyRide" : "Welcome back";
  document.querySelector("#login-title").textContent = isRegistering ? "Create your account" : "Login to RentMyRide";
  document.querySelector("#auth-description").textContent = isRegistering
    ? "Create an account to book and manage your rentals."
    : "Sign in to manage your rentals and continue booking.";
  document.querySelector("#login-options").hidden = isRegistering;
  document.querySelector("#login-submit").textContent = isRegistering ? "Create account" : "Login";
  document.querySelector("#auth-switch-label").textContent = isRegistering ? "Already have an account?" : "New here?";
  document.querySelector("#auth-mode-toggle").textContent = isRegistering ? "Login" : "Create account";
  loginForm.reset();
  loginMessage.textContent = "";
};

const loadBookings = async () => {
  const history = document.querySelector("#booking-history");
  history.replaceChildren();
  try {
    const { bookings } = await api("/api/bookings");
    if (!bookings.length) {
      history.textContent = "No confirmed bookings yet.";
      return;
    }
    bookings.forEach((booking) => {
      const row = document.createElement("article");
      row.className = "booking-history-item";
      const title = document.createElement("strong");
      title.textContent = booking.carName;
      const dates = document.createElement("span");
      dates.textContent = `${booking.startDate} to ${booking.returnDate}`;
      const status = document.createElement("span");
      status.className = "booking-status";
      status.textContent = booking.status === "paid" ? "Paid" : "Payment pending capture";
      const total = document.createElement("strong");
      total.textContent = `Rs. ${Number(booking.total).toLocaleString("en-IN")}`;
      row.append(title, dates, status, total);
      history.append(row);
    });
  } catch {
    history.textContent = "Bookings could not be loaded. Please try again.";
  }
};

const openProfile = async () => {
  document.querySelector("#auth-view").hidden = true;
  document.querySelector("#profile-view").hidden = false;
  document.querySelector("#profile-email").textContent = currentUser.email;
  document.querySelector("#profile-message").textContent = "";
  await loadBookings();
  showModal(loginModal, document.querySelector("#logout-button"));
};

const getLocalDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (dateValue, days) => {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDate(date);
};

const rentalDays = (start, end) => {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  return Math.ceil((endTime - startTime) / 86400000);
};

const updateBookingEstimate = () => {
  const start = bookingStart.value;
  const end = bookingReturn.value;
  const days = rentalDays(start, end);
  bookingReturn.min = addDays(start || getLocalDate(), 1);
  if (days < 1 || !selectedCar) {
    document.querySelector("#booking-days").textContent = "Choose a valid return date";
    document.querySelector("#booking-estimate").textContent = "Rs. 0";
    paymentButton.disabled = true;
    return;
  }
  document.querySelector("#booking-days").textContent = `${days} ${days === 1 ? "day" : "days"}`;
  document.querySelector("#booking-estimate").textContent = `Rs. ${(selectedCar.dailyRate * days).toLocaleString("en-IN")}`;
  paymentButton.disabled = !paymentConfig.enabled;
};

const openBooking = (car) => {
  selectedCar = car;
  const summary = document.querySelector("#booking-car-summary");
  summary.replaceChildren();
  const carName = document.createElement("strong");
  carName.textContent = car.name;
  const dailyRate = document.createElement("span");
  dailyRate.textContent = `Rs. ${car.dailyRate.toLocaleString("en-IN")} per day`;
  summary.append(carName, dailyRate);

  const searchStart = document.querySelector("#start-date").value || getLocalDate();
  const searchReturn = document.querySelector("#return-date").value || addDays(searchStart, 7);
  bookingStart.min = getLocalDate();
  bookingStart.value = searchStart < bookingStart.min ? bookingStart.min : searchStart;
  bookingReturn.value = searchReturn > bookingStart.value ? searchReturn : addDays(bookingStart.value, 1);
  paymentMessage.textContent = paymentConfig.enabled
    ? ""
    : "Online checkout is not configured. Add your Razorpay test keys to the .env file to enable payments.";
  updateBookingEstimate();
  showModal(bookingModal, bookingStart);
};

const readCarFromCard = (trigger) => {
  const card = trigger.closest(".rental-box");
  const price = card.querySelector(".price-btn p").textContent.match(/[\d,]+/);
  return {
    id: trigger.dataset.carId,
    name: card.querySelector(".rental-box h2").textContent.trim(),
    dailyRate: Number(price?.[0].replaceAll(",", "") || 0),
  };
};

const loadRazorpay = () => new Promise((resolve, reject) => {
  if (window.Razorpay) {
    resolve();
    return;
  }
  const script = document.createElement("script");
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.onload = resolve;
  script.onerror = () => reject(new Error("Secure checkout could not load. Check your internet connection and try again."));
  document.head.append(script);
});

const beginPayment = async (event) => {
  event.preventDefault();
  paymentMessage.textContent = "";
  if (!paymentConfig.enabled) {
    paymentMessage.textContent = "Online checkout is not configured. Add your Razorpay test keys to the .env file to enable payments.";
    return;
  }
  if (!currentUser) {
    hideModal(bookingModal);
    openLogin(selectedCar);
    return;
  }
  paymentButton.disabled = true;
  paymentButton.classList.add("is-loading");

  try {
    await loadRazorpay();
    const order = await api("/api/payments/order", {
      method: "POST",
      body: JSON.stringify({
        carId: selectedCar.id,
        startDate: bookingStart.value,
        returnDate: bookingReturn.value,
      }),
    });

    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "RentMyRide",
      description: `${order.carName} rental for ${order.days} ${order.days === 1 ? "day" : "days"}`,
      order_id: order.orderId,
      prefill: { name: currentUser.name || "", email: currentUser.email },
      theme: { color: "#5a6d8c" },
      handler: async (response) => {
        paymentMessage.textContent = "Verifying your payment...";
        try {
          const result = await api("/api/payments/verify", {
            method: "POST",
            body: JSON.stringify(response),
          });
          paymentMessage.textContent = result.status === "paid"
            ? "Payment confirmed. Your booking is ready."
            : result.status === "awaiting_capture"
              ? "Payment received. Your booking will be confirmed when capture completes."
              : "Payment did not complete. No booking was confirmed.";
          await loadBookings();
          window.setTimeout(() => hideModal(bookingModal), 1800);
        } catch (error) {
          paymentMessage.textContent = error.message;
          paymentButton.disabled = !paymentConfig.enabled;
          paymentButton.classList.remove("is-loading");
        }
      },
      modal: {
        ondismiss: () => {
          paymentButton.disabled = false;
          paymentButton.classList.remove("is-loading");
        },
      },
    });

    checkout.on("payment.failed", (response) => {
      paymentMessage.textContent = response.error?.description || "Payment did not complete. Please try again.";
      paymentButton.disabled = false;
      paymentButton.classList.remove("is-loading");
    });
    checkout.open();
  } catch (error) {
    paymentMessage.textContent = error.message;
    paymentButton.disabled = false;
    paymentButton.classList.remove("is-loading");
  }
};

if (menuIcon && navbar) {
  menuIcon.addEventListener("click", () => {
    const isOpen = navbar.classList.toggle("open-menu");
    menuIcon.classList.toggle("move", isOpen);
    menuIcon.setAttribute("aria-expanded", String(isOpen));
  });
  document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", closeMenu));
  window.addEventListener("scroll", closeMenu);
}

document.querySelector(".user-trigger").addEventListener("click", () => openLogin());
document.querySelectorAll(".rental-btn").forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    closeMenu();
    const car = readCarFromCard(trigger);
    if (currentUser) openBooking(car);
    else openLogin(car);
  });
});

document.querySelectorAll("[data-close-login]").forEach((button) => button.addEventListener("click", () => hideModal(loginModal)));
document.querySelectorAll("[data-close-booking]").forEach((button) => button.addEventListener("click", () => hideModal(bookingModal)));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (bookingModal.classList.contains("show")) hideModal(bookingModal);
    else if (loginModal.classList.contains("show")) hideModal(loginModal);
  }
});

document.querySelector("#auth-mode-toggle").addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "register" : "login");
  (authMode === "register" ? nameInput : emailInput).focus();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = document.querySelector("#login-submit");
  submit.disabled = true;
  loginMessage.textContent = "";
  const form = new FormData(loginForm);
  try {
    const result = await api(`/api/auth/${authMode === "register" ? "register" : "login"}`, {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        remember: form.get("remember") === "on",
      }),
    });
    setUser(result.user);
    hideModal(loginModal);
    const nextCar = pendingCar;
    pendingCar = null;
    if (nextCar) openBooking(nextCar);
  } catch (error) {
    loginMessage.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  const button = document.querySelector("#logout-button");
  button.disabled = true;
  try {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    setUser(null);
    pendingCar = null;
    hideModal(loginModal);
  } catch (error) {
    document.querySelector("#profile-message").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

bookingStart.addEventListener("change", () => {
  if (bookingReturn.value <= bookingStart.value) bookingReturn.value = addDays(bookingStart.value, 1);
  updateBookingEstimate();
});
bookingReturn.addEventListener("change", updateBookingEstimate);
bookingForm.addEventListener("submit", beginPayment);

document.querySelector("#vehicle-search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const start = document.querySelector("#start-date").value;
  const end = document.querySelector("#return-date").value;
  const status = document.querySelector("#search-status");
  if (!start || !end || end <= start) {
    status.textContent = "Choose a return date after your pick-up date.";
    return;
  }
  status.textContent = "Choose a car to see your rental total.";
  document.querySelector("#cars").scrollIntoView({ behavior: "smooth" });
});

const today = getLocalDate();
const startInput = document.querySelector("#start-date");
const returnInput = document.querySelector("#return-date");
startInput.min = today;
returnInput.min = addDays(today, 1);
startInput.value = today;
returnInput.value = addDays(today, 7);
startInput.addEventListener("change", () => {
  returnInput.min = addDays(startInput.value, 1);
  if (returnInput.value <= startInput.value) returnInput.value = returnInput.min;
});

api("/api/config")
  .then((config) => {
    paymentConfig = config;
    if (selectedCar && bookingModal.classList.contains("show")) updateBookingEstimate();
  })
  .catch(() => {});

api("/api/auth/me")
  .then(({ user }) => {
    if (user) setUser(user);
  })
  .catch(() => setUser(null));
