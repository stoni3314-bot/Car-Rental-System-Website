const menuIcon = document.querySelector(".menu-icon");
const navbar = document.querySelector(".navbar");
const loginModal = document.querySelector("#login-modal");
const bookingModal = document.querySelector("#booking-modal");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const bookingForm = document.querySelector("#booking-form");
const paymentMessage = document.querySelector("#payment-message");
const paymentButton = document.querySelector("#payment-submit");
const paymentButtonIcon = paymentButton.querySelector("i");
const paymentButtonLabel = document.querySelector("#payment-button-label");
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
let carCatalog = [];
let paymentConfig = { enabled: false, demoEnabled: false, keyId: "" };
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
  document.querySelector("#auth-kicker").textContent = isRegistering ? "Join Car Rental System" : "Welcome back";
  document.querySelector("#login-title").textContent = isRegistering ? "Create your account" : "Login to Car Rental System";
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
      status.textContent = booking.status === "demo_paid"
        ? "Demo only: no real payment or rental"
        : booking.status === "paid" ? "Paid" : "Payment pending capture";
      const total = document.createElement("strong");
      total.textContent = `Rs. ${Number(booking.total).toLocaleString("en-IN")}`;
      row.append(title, dates, status, total);
      history.append(row);
    });
  } catch {
    history.textContent = "Bookings could not be loaded. Please try again.";
  }
};

const loadCars = async () => {
  const grid = document.querySelector("#rentals-content");
  const status = document.querySelector("#car-list-status");
  grid.replaceChildren();
  try {
    const { cars } = await api("/api/cars");
    carCatalog = cars;
    status.textContent = cars.length ? "" : "No cars are currently listed.";
    cars.forEach((car) => {
      const card = document.createElement("article");
      card.className = "rental-box";
      const top = document.createElement("div");
      top.className = "rental-top";
      const category = document.createElement("h3");
      category.textContent = car.category;
      const icon = document.createElement("i");
      icon.className = "ri-car-line";
      icon.setAttribute("aria-hidden", "true");
      top.append(category, icon);

      const image = document.createElement("img");
      image.src = car.image;
      image.alt = car.name;
      image.loading = "lazy";
      const name = document.createElement("h2");
      name.textContent = car.name;
      const transmission = document.createElement("h4");
      transmission.textContent = car.transmission;
      const priceButton = document.createElement("div");
      priceButton.className = "price-btn";
      const price = document.createElement("p");
      price.textContent = `Rs. ${Number(car.dailyRate).toLocaleString("en-IN")} `;
      const perDay = document.createElement("span");
      perDay.textContent = "/day";
      price.append(perDay);
      const rent = document.createElement("button");
      rent.type = "button";
      rent.className = "rental-btn";
      rent.dataset.carId = car.id;
      rent.textContent = "Rent";
      priceButton.append(price, rent);
      card.append(top, image, name, transmission, priceButton);
      grid.append(card);
    });
  } catch {
    status.textContent = "Car list could not be loaded. Please refresh the page.";
  }
};

const resetAdminCarForm = () => {
  const form = document.querySelector("#admin-car-form");
  form.reset();
  form.elements.id.value = "";
  document.querySelector("#admin-car-submit").textContent = "Add car";
  document.querySelector("#admin-car-cancel").hidden = true;
  document.querySelector("#admin-car-status").textContent = "";
};

const loadAdminCars = async () => {
  const list = document.querySelector("#admin-car-list");
  list.replaceChildren();
  carCatalog.forEach((car) => {
    const row = document.createElement("div");
    row.className = "admin-car-row";
    const label = document.createElement("strong");
    label.textContent = `${car.name} (${car.category})`;
    const rate = document.createElement("span");
    rate.textContent = `Rs. ${Number(car.dailyRate).toLocaleString("en-IN")} / day`;
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "admin-action-button";
    edit.dataset.editCar = car.id;
    edit.textContent = "Edit";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "admin-action-button danger";
    remove.dataset.deleteCar = car.id;
    remove.textContent = "Delete";
    row.append(label, rate, edit, remove);
    list.append(row);
  });
};

const loadAdminTickets = async () => {
  const list = document.querySelector("#admin-ticket-list");
  list.replaceChildren();
  try {
    const { tickets } = await api("/api/admin/support");
    if (!tickets.length) {
      list.textContent = "No customer messages yet.";
      return;
    }
    tickets.forEach((ticket) => {
      const row = document.createElement("article");
      row.className = "admin-ticket-row";
      const subject = document.createElement("strong");
      subject.textContent = ticket.subject;
      const contact = document.createElement("span");
      contact.textContent = `${ticket.name} | ${ticket.email} | ${new Date(ticket.createdAt).toLocaleString()}`;
      const message = document.createElement("p");
      message.textContent = ticket.message;
      const status = document.createElement("select");
      status.setAttribute("aria-label", `Status for ${ticket.subject}`);
      status.dataset.ticketId = ticket.id;
      ["open", "in-progress", "resolved"].forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value.replace("-", " ");
        option.selected = value === ticket.status;
        status.append(option);
      });
      row.append(subject, contact, message, status);
      list.append(row);
    });
  } catch (error) {
    list.textContent = error.message;
  }
};

const openProfile = async () => {
  document.querySelector("#auth-view").hidden = true;
  document.querySelector("#profile-view").hidden = false;
  document.querySelector("#profile-email").textContent = currentUser.email;
  document.querySelector("#profile-message").textContent = "";
  const adminTools = document.querySelector("#admin-tools");
  adminTools.hidden = !currentUser.isAdmin;
  await loadBookings();
  if (currentUser.isAdmin) await Promise.all([loadAdminCars(), loadAdminTickets()]);
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
  paymentButton.disabled = !paymentConfig.demoEnabled;
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
  paymentMessage.textContent = paymentConfig.demoEnabled
    ? "Demo only: no money will be charged and no real rental is reserved."
    : "Demo checkout is disabled. This site does not accept real payments.";
  updateBookingEstimate();
  showModal(bookingModal, bookingStart);
};

const beginPayment = async (event) => {
  event.preventDefault();
  paymentMessage.textContent = "";
  if (!paymentConfig.demoEnabled) {
    paymentMessage.textContent = "Demo checkout is disabled. This site does not accept real payments.";
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
    const result = await api("/api/payments/demo", {
      method: "POST",
      body: JSON.stringify({
        carId: selectedCar.id,
        startDate: bookingStart.value,
        returnDate: bookingReturn.value,
      }),
    });

    paymentMessage.textContent = result.status === "demo_paid"
      ? "Demo complete. No money was charged and no real rental is reserved."
      : "Demo payment could not be completed.";
    await loadBookings();
    window.setTimeout(() => hideModal(bookingModal), 2200);
  } catch (error) {
    paymentMessage.textContent = error.message;
    paymentButton.disabled = !paymentConfig.demoEnabled;
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
document.querySelector("#rentals-content").addEventListener("click", (event) => {
  const trigger = event.target.closest(".rental-btn");
  if (!trigger) return;
  closeMenu();
  const car = carCatalog.find((item) => item.id === trigger.dataset.carId);
  if (!car) return;
  if (currentUser) openBooking(car);
  else openLogin(car);
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

document.querySelector("#support-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const status = document.querySelector("#support-status");
  submit.disabled = true;
  status.textContent = "";
  const values = new FormData(form);
  try {
    await api("/api/support", {
      method: "POST",
      body: JSON.stringify({
        name: values.get("name"),
        email: values.get("email"),
        subject: values.get("subject"),
        message: values.get("message"),
      }),
    });
    form.reset();
    status.textContent = "Message sent. Our customer-service team will get back to you.";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#admin-car-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const id = values.get("id");
  const button = document.querySelector("#admin-car-submit");
  const status = document.querySelector("#admin-car-status");
  button.disabled = true;
  status.textContent = "";
  try {
    await api(id ? `/api/admin/cars/${encodeURIComponent(id)}` : "/api/admin/cars", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify({
        name: values.get("name"),
        category: values.get("category"),
        transmission: values.get("transmission"),
        dailyRate: Number(values.get("dailyRate")),
        image: values.get("image"),
      }),
    });
    resetAdminCarForm();
    await loadCars();
    await loadAdminCars();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#admin-car-cancel").addEventListener("click", resetAdminCarForm);
document.querySelector("#admin-car-list").addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit-car]");
  const remove = event.target.closest("[data-delete-car]");
  const form = document.querySelector("#admin-car-form");
  const status = document.querySelector("#admin-car-status");
  if (edit) {
    const car = carCatalog.find((item) => item.id === edit.dataset.editCar);
    if (!car) return;
    form.elements.id.value = car.id;
    form.elements.name.value = car.name;
    form.elements.category.value = car.category;
    form.elements.transmission.value = car.transmission;
    form.elements.dailyRate.value = car.dailyRate;
    form.elements.image.value = car.image;
    document.querySelector("#admin-car-submit").textContent = "Save changes";
    document.querySelector("#admin-car-cancel").hidden = false;
    status.textContent = "";
    form.elements.name.focus();
  } else if (remove && window.confirm("Remove this car from the public list?")) {
    status.textContent = "";
    try {
      await api(`/api/admin/cars/${encodeURIComponent(remove.dataset.deleteCar)}`, { method: "DELETE" });
      resetAdminCarForm();
      await loadCars();
      await loadAdminCars();
    } catch (error) {
      status.textContent = error.message;
    }
  }
});

document.querySelector("#admin-ticket-list").addEventListener("change", async (event) => {
  const select = event.target.closest("select[data-ticket-id]");
  if (!select) return;
  try {
    await api(`/api/admin/support/${encodeURIComponent(select.dataset.ticketId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: select.value }),
    });
  } catch (error) {
    document.querySelector("#profile-message").textContent = error.message;
    await loadAdminTickets();
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
    paymentButtonIcon.className = config.demoEnabled ? "ri-flask-line" : "ri-lock-line";
    paymentButtonLabel.textContent = config.demoEnabled ? "Simulate demo payment" : "Demo checkout disabled";
    if (selectedCar && bookingModal.classList.contains("show")) {
      updateBookingEstimate();
      paymentMessage.textContent = config.demoEnabled
        ? "Demo only: no money will be charged and no real rental is reserved."
        : "Demo checkout is disabled. This site does not accept real payments.";
    }
  })
  .catch(() => {});

api("/api/auth/me")
  .then(({ user }) => {
    if (user) setUser(user);
  })
  .catch(() => setUser(null));

loadCars();
