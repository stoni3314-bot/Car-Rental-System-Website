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

3. Open `http://127.0.0.1:4173` in a browser.

Accounts and bookings are stored locally in `.data/store.json`. Passwords are stored as salted scrypt hashes and login sessions use HTTP-only cookies.

## Razorpay Payments

Create Razorpay API keys in test mode and add them to `.env` as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Restart the server to enable checkout. The secret key stays on the server; rental prices and totals are calculated by the server, and successful payments are signature-checked with Razorpay before a booking is marked paid.

For captured-payment updates, configure a Razorpay webhook for `payment.captured` and `payment.failed`, then set its signing secret as `RAZORPAY_WEBHOOK_SECRET`. The webhook endpoint is `/api/payments/webhook`. Use test keys and Razorpay's test payment details before switching to live keys.

## Public Deployment

`render.yaml` is configured for a Render Node web service with a 1 GB persistent disk mounted at `/var/data`. The disk is required because the site stores account and booking data locally; Render's free web services do not preserve local files across restarts. Render currently lists the smallest always-on web service at $7/month and disk storage at $0.25/GB-month, so this configuration starts at about $7.25 USD/month before taxes or other usage. Check [Render pricing](https://render.com/pricing) before creating the service.

Render deploys from a Git repository. Keep the repository private, then create a Blueprint from `render.yaml`. Add Razorpay keys as Render environment variables after deployment to enable online payments. The hosted site receives a public `onrender.com` address; a custom domain is optional.

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
