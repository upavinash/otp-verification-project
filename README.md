<<<<<<< HEAD
# Email and Phone OTP Verification

This project has a React/Vite frontend and a Node.js/Express API backed by MySQL.
The API uses Gmail with Nodemailer for email codes and Twilio for SMS codes.

## Configure and start

1. Keep the existing MySQL database and tables. The API expects `users` to have
   `name`, `email`, `phone`, `password_hash`, `email_verified`, and
   `phone_verified` columns. It uses `otp_challenges` columns `user_id`,
   `channel`, `otp_hash`, `expires_at`, `attempts`, and `consumed_at`.
2. In a terminal, go to `backend` and copy `.env.example` to `.env`. Fill in the
   MySQL settings and your Gmail address and Gmail App Password. Do not use your
   normal Gmail password. Keep `.env` private and never put these settings in
   the frontend.
3. Start the API from either the project folder or `backend`:

   ```powershell
   cd backend
   npm start
   ```

   The server loads `backend/.env` relative to `server.js`, so its working
   directory does not affect configuration loading.
4. In another terminal, go to `frontend` and start the React app:

   ```powershell
   cd frontend
   npm run dev
   ```

   Open the local URL printed by Vite. Requests to `/api` are forwarded to the
   backend at `http://localhost:5000`.

## How verification works

- Signing up stores a bcrypt-hashed password. The frontend then requests an
  email code; only a bcrypt hash of each OTP is stored in MySQL.
- Codes expire after five minutes, allow five incorrect attempts, and can only
  be used once. Requesting a replacement code makes the newest code the one
  that can be verified.
- Phone numbers must use international E.164 format, for example
  `+14155552671`.
- Phone OTP sending is disabled until all three Twilio settings are present in
  `backend/.env`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and
  `TWILIO_PHONE_NUMBER`. Configure a Twilio sender that is permitted to message
  your destination numbers, then restart the backend. Until configured, the API
  returns a clear service-not-configured error and does not create a phone OTP.
- API responses never contain passwords, OTP values, password hashes, or OTP
  hashes.

## Test the features

1. Check backend and database connectivity in PowerShell:

   ```powershell
   curl.exe http://localhost:5000/api/health
   ```

   Expect HTTP 200 and `"success":true`.
2. Use the signup form with an email inbox you can access and a phone number in
   E.164 format. The app creates the account and requests an email code.
3. Enter the emailed code within five minutes. Successful verification advances
   the account to phone verification.
4. With Twilio configured, send and enter the SMS code. Without Twilio
   configured, confirm that the page reports phone verification is not
   configured instead of claiming that a text was sent.
5. To test backend validation without creating a user, send an incomplete
   request:

   ```powershell
   curl.exe -X POST http://localhost:5000/api/auth/signup `
     -H "Content-Type: application/json" `
     -d "{}"
   ```

   Expect HTTP 400 with a user-friendly validation message.
6. To exercise OTP protections, request a fresh code and try an incorrect
   six-digit code five times; the challenge is then unusable. A correct code
   used once or a code older than five minutes must also be rejected. Request a
   replacement code to continue.

Run the frontend checks from `frontend`:

```powershell
npm run lint
npm run build
```
=======
# otp-verification-project
>>>>>>> be8e4fbc1dc94ef2348d5c5361f59d075cdfad4a
