const nodemailer = require("nodemailer");

async function sendOtpEmail(to, otp) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailAppPassword) {
    const error = new Error("Email verification is not configured.");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword.replace(/\s/g, ""),
    },
  });

  return transporter.sendMail({
    from: gmailUser,
    to,
    subject: "Your Email Verification OTP",
    text: `Your verification code is ${otp}. It expires in 5 minutes. Do not share this code with anyone.`,
  });
}

module.exports = { sendOtpEmail };
