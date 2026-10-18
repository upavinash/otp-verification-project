const twilio = require("twilio");

function assertSmsConfigured() {
  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_PHONE_NUMBER
  ) {
    const error = new Error("SMS verification is not configured.");
    error.code = "SMS_NOT_CONFIGURED";
    throw error;
  }
}

async function sendOtpSms(to, otp) {
  assertSmsConfigured();

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  return client.messages.create({
    body: `Your verification code is ${otp}. It expires in 5 minutes. Do not share this code with anyone.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
  });
}

module.exports = { assertSmsConfigured, sendOtpSms };
