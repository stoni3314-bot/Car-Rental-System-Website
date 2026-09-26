<div align="center">

![GitHub repo size](https://img.shields.io/github/repo-size/withaarzoo/Car-Rental-Website---RentMyRide)
![GitHub stars](https://shields.io/github/stars/withaarzoo/Car-Rental-Website---RentMyRide?style=social)
![GitHub forks](https://shields.io/github/forks/withaarzoo/Car-Rental-Website---RentMyRide?style=social)
[![Twitter Follow](https://shields.io/twitter/follow/withaarzoo?style=social)](https://twitter.com/intent/follow?screen_name=withaarzoo)
[![YouTube Video Views](https://shields.io/youtube/views/SAu7e09vXoQ?style=social)](https://youtu.be/KXymZtuRRyk)

<br />
<br />

<h2 align="center">Car Rental Website - RentMyCar</h2>

Welcome to the RentMyCar project! This repository hosts a sleek, modern car rental website built using HTML, CSS, and JavaScript. The website is ideal for small businesses and car rental shops, providing users with a simple and engaging experience for browsing and renting cars. It includes scroll animations (via ScrollRevealJS) and a collection of icons from Remix Icon to enhance the UI.

<div>
    <a href="https://youtu.be/DjJTXXKETiE?si=fMJJDU_vfIv0QwdL"><strong>➥ Watch Tutorial</strong></a>
    <br>
    <br>
    <a href="tel:+917586073575"><strong>➥ Download Full Source Code : +91 7586073575 ( WhatsApp )</strong></a>
</div>

</div>

## Getting Started

To start using the RentMyCar website, follow these simple steps:

1. Clone the repository to your local machine:

    ```bash
    git clone https://github.com/withaarzoo/Car-Rental-Website---RentMyRide.git
    ```

2. Open the project in your preferred code editor.

3. Customize the pages to reflect your car rental business's branding, images, and offerings.

## Run the Site

The login, account, booking, and payment APIs run in the included Node.js server. Use Node.js 20 or newer; the project has no npm dependencies.

1. Copy `.env.example` to `.env`.
2. Start the server from this folder:

    ```bash
    node server.js
    ```

3. Open `http://localhost:4173` in a browser.

On this Windows PC, the `RentMyRide Local Server` scheduled task runs `start-local.ps1` after sign-in and restarts the server if it exits. This local address works on this computer only; it is not a public URL.

Accounts and bookings are stored locally in `.data/store.json`. Passwords are stored as salted scrypt hashes and login sessions use HTTP-only cookies.

## Fleet Admin and Customer Service

To enable the protected administrator login, set `ADMIN_EMAIL` and a unique password of at least 12 characters in the private `.env` file, then restart the server. Sign in from the account icon using those credentials. Admins can add, edit, and remove cars and review or update customer-service messages. Public registration cannot grant administrator access.

The car list and customer-service form are available to visitors without an account. Messages and fleet changes are saved in `.data/store.json`. The local address `http://localhost:4173` is bound to this PC only. Sharing it over Wi-Fi requires a deliberate LAN setup; internet access requires public hosting.

## Razorpay Payments

For a keyless local walkthrough, set `DEMO_PAYMENTS=true` in `.env`. The checkout will simulate success without collecting card details or charging money. Demo records are explicitly labeled `demo_paid`, are not real payments or reservations, and the server disables this mode whenever `NODE_ENV=production`.

For real online payments, create Razorpay API keys in test mode and add them to `.env` as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. The secret key stays on the server; rental prices and totals are calculated by the server, and successful payments are signature-checked with Razorpay before a booking is marked paid.

For captured-payment updates, configure a Razorpay webhook for `payment.captured` and `payment.failed`, then set its signing secret as `RAZORPAY_WEBHOOK_SECRET`. The webhook endpoint is `/api/payments/webhook`. Use test keys and Razorpay's test payment details before switching to live keys.

## Public Deployment

`render.yaml` uses Render's free Node web-service plan and does not attach paid storage. Render Free services sleep after 15 minutes without traffic, and their filesystem is temporary: account, booking, fleet, and customer-support data saved by this app can disappear whenever the service sleeps, restarts, or deploys. The first visit after sleep can take about a minute to load. Use this setup only as a public preview with test data, not for real customer records or reservations. See [Render's free-service limits](https://render.com/docs/free).

Render deploys from a Git repository. Keep the repository private, then create a Blueprint from `render.yaml`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` as private Render environment variables. Real payments remain unavailable until valid Razorpay credentials and webhook configuration are added as environment variables; demo payments are disabled in production. The hosted site receives a public `onrender.com` address; a custom domain is optional.

## Project Structure

The RentMyCar website is a single-page, static site that includes the following sections:

- **Header**: Navigation links and branding.
- **Home**: Hero section with an introduction to the car rental service.
- **Trending Cars**: Displays popular rental cars.
- **Rental Cars**: A comprehensive list of available cars for rent.
- **Team**: Introduces the team members behind the service.
- **Reviews**: Customer testimonials to build trust.
- **Newsletter**: A subscription form for users to stay updated.
- **Footer**: Includes contact information and additional links.

## Essential Links

- Remix Icon : [visit site](https://remixicon.com/)
- Google Fonts : [visit site](https://www.google.com/fonts)
- ScrollRevealJS: [visit site](https://scrollrevealjs.org/)

## Source Code

For the full source code, you can connect via WhatsApp:

- +917586073575 ( WhatsApp )

## Video Tutorial

Need some extra guidance? Watch our video tutorial on setting up and customizing your website:

- [Car Rental Website Tutorial](https://youtu.be/DjJTXXKETiE?si=fMJJDU_vfIv0QwdL)

## Connect with Me

If you want to contact me you can reach me at [Bento](https://bento.me/withaarzoo).

## Thumbnail

![RentMyCar Thumbnail](./readme-image/Thumbnail-1.png "thumbnail")

---

**Happy Coding!** 🚗
