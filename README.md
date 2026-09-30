# Car Rental System

A responsive car-rental website with a Node.js server for accounts, fleet management, customer support, and rental demos.

## Run Locally

Use Node.js 20 or newer. This project has no npm dependencies.

```powershell
Copy-Item .env.example .env
npm start
```

Open `http://localhost:4174/`.

Set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 12 characters in `.env` to enable administrator access. Keep `.env` private; never commit credentials.

Administrator sign-in uses a server-side password hash, a browser-session HTTP-only cookie that expires after four hours, same-origin checks for changes, security response headers, and a temporary lockout after repeated failed admin logins. Use a randomly generated password of 16 or more characters. The lockout is held in memory and resets if the server restarts; for a public deployment, also enable your host's rate limiting and monitoring. Do not use this demo with real customer or payment data.

## Demo Payments

Checkout is simulated for demonstration only. It does not collect card details, contact a payment provider, charge money, or reserve a real rental. Demo records are labeled `demo_paid`. Real payment order, verification, and webhook endpoints are not available. Demo checkout is disabled in production.

## Public Preview

The GitHub Pages preview is view-only; accounts, booking, payments, fleet management, and customer support require the Node.js server. The repository is public, so use only sample data and never commit secrets.

The optional `render.yaml` deployment is a preview configuration. Free hosting may sleep and uses temporary storage, so saved data can be lost after restarts or deploys. Do not use it for real customer records or reservations.

## Repository

[Car Rental System on GitHub](https://github.com/stoni3314-bot/Car-Rental-System-Website)
