const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendOtpEmail } = require("../services/emailService");
const {
  assertSmsConfigured,
  sendOtpSms,
} = require("../services/smsService");

const MAX_OTP_ATTEMPTS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

const channels = {
  email: {
    contactField: "email",
    verifiedColumn: "email_verified",
    send: sendOtpEmail,
    label: "Email",
    normalize: (value) => value.trim().toLowerCase(),
    isValid: (value) => value.length <= 254 && EMAIL_PATTERN.test(value),
  },
  phone: {
    contactField: "phone",
    verifiedColumn: "phone_verified",
    send: sendOtpSms,
    label: "Phone",
    normalize: (value) => value.trim(),
    isValid: (value) => PHONE_PATTERN.test(value),
  },
};

function getContact(body, channel) {
  const value = body?.[channel.contactField];
  return typeof value === "string" ? channel.normalize(value) : "";
}

function sendOtpError(res, error, label) {
  console.error(`${label} OTP error:`, error.code || error.name);
  const notConfigured =
    error.code === "EMAIL_NOT_CONFIGURED" ||
    error.code === "SMS_NOT_CONFIGURED";

  return res.status(notConfigured ? 503 : 500).json({
    success: false,
    message: notConfigured
      ? `${label} verification is not configured on the server yet.`
      : `Could not send the ${label.toLowerCase()} verification code. Please try again.`,
  });
}

async function createAndSendOtp(req, res, channelName) {
  const channel = channels[channelName];
  const contact = getContact(req.body, channel);

  if (!channel.isValid(contact)) {
    return res.status(400).json({
      success: false,
      message:
        channelName === "email"
          ? "Enter a valid email address."
          : "Enter a valid phone number with country code, such as +14155552671.",
    });
  }

  try {
    if (channelName === "phone") {
      assertSmsConfigured();
    }

    const [users] = await pool.execute(
      `SELECT id, ${channel.verifiedColumn} AS verified FROM users WHERE ${channel.contactField} = ?`,
      [contact]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No account found. Please sign up first.",
      });
    }

    const user = users[0];
    if (user.verified) {
      return res.status(400).json({
        success: false,
        message: `${channel.label} is already verified.`,
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const [result] = await pool.execute(
      `INSERT INTO otp_challenges (user_id, channel, otp_hash, expires_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
      [user.id, channelName, otpHash]
    );

    try {
      await channel.send(contact, otp);
    } catch (error) {
      try {
        await pool.execute("DELETE FROM otp_challenges WHERE id = ?", [
          result.insertId,
        ]);
      } catch (cleanupError) {
        console.error(
          "OTP cleanup error:",
          cleanupError.code || cleanupError.name
        );
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      message: `Verification code sent. It expires in 5 minutes.`,
    });
  } catch (error) {
    return sendOtpError(res, error, channel.label);
  }
}

const signup = async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name || !email || !phone || !password) {
    return res.status(400).json({
      success: false,
      message: "Please fill in all fields.",
    });
  }

  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({
      success: false,
      message: "Name must be between 2 and 100 characters.",
    });
  }

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid email address.",
    });
  }

  if (!PHONE_PATTERN.test(phone)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid phone number with country code, such as +14155552671.",
    });
  }

  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters and no more than 72 bytes.",
    });
  }

  try {
    const [existingUsers] = await pool.execute(
      "SELECT id FROM users WHERE email = ? OR phone = ?",
      [email, phone]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email or phone number is already registered.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `INSERT INTO users
       (name, email, phone, password_hash, email_verified, phone_verified)
       VALUES (?, ?, ?, ?, FALSE, FALSE)`,
      [name, email, phone, passwordHash]
    );

    return res.status(201).json({
      success: true,
      message: "Signup successful. You can now verify your email and phone.",
      userId: result.insertId,
    });
  } catch (error) {
    console.error("Signup error:", error.code || error.name);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email or phone number is already registered.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong during signup. Please try again.",
    });
  }
};

async function verifyOtp(req, res, channelName) {
  const channel = channels[channelName];
  const contact = getContact(req.body, channel);
  const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";

  if (!channel.isValid(contact)) {
    return res.status(400).json({
      success: false,
      message:
        channelName === "email"
          ? "Enter a valid email address."
          : "Enter a valid phone number with country code.",
    });
  }

  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({
      success: false,
      message: "Enter the 6-digit verification code.",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [users] = await connection.execute(
      `SELECT id, ${channel.verifiedColumn} AS verified
       FROM users WHERE ${channel.contactField} = ? FOR UPDATE`,
      [contact]
    );

    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "No account found. Please sign up first.",
      });
    }

    const user = users[0];
    if (user.verified) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `${channel.label} is already verified.`,
      });
    }

    const [challenges] = await connection.execute(
      `SELECT id, otp_hash, attempts, consumed_at,
              (expires_at <= NOW()) AS expired
       FROM otp_challenges
       WHERE user_id = ? AND channel = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1 FOR UPDATE`,
      [user.id, channelName]
    );

    if (challenges.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Request a ${channel.label.toLowerCase()} verification code first.`,
      });
    }

    const challenge = challenges[0];
    if (challenge.consumed_at) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "This verification code has already been used. Request a new one.",
      });
    }

    if (Number(challenge.expired) === 1) {
      await connection.execute(
        "UPDATE otp_challenges SET consumed_at = NOW() WHERE id = ?",
        [challenge.id]
      );
      await connection.commit();
      return res.status(400).json({
        success: false,
        message: "This verification code has expired. Request a new one.",
      });
    }

    const attempts = Number(challenge.attempts || 0);
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Too many incorrect attempts. Request a new verification code.",
      });
    }

    const matches = await bcrypt.compare(otp, challenge.otp_hash);
    if (!matches) {
      const nextAttempts = attempts + 1;
      await connection.execute(
        `UPDATE otp_challenges
         SET attempts = ?, consumed_at = IF(? >= ?, NOW(), consumed_at)
         WHERE id = ?`,
        [nextAttempts, nextAttempts, MAX_OTP_ATTEMPTS, challenge.id]
      );
      await connection.commit();

      return res.status(400).json({
        success: false,
        message:
          nextAttempts >= MAX_OTP_ATTEMPTS
            ? "Too many incorrect attempts. Request a new verification code."
            : `Incorrect code. ${MAX_OTP_ATTEMPTS - nextAttempts} attempts remaining.`,
      });
    }

    await connection.execute(
      "UPDATE otp_challenges SET consumed_at = NOW() WHERE id = ?",
      [challenge.id]
    );
    await connection.execute(
      `UPDATE users SET ${channel.verifiedColumn} = TRUE WHERE id = ?`,
      [user.id]
    );
    await connection.commit();

    return res.status(200).json({
      success: true,
      message: `${channel.label} verified successfully.`,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("OTP rollback error:", rollbackError.code || rollbackError.name);
      }
    }
    console.error(`${channel.label} verification error:`, error.code || error.name);
    return res.status(500).json({
      success: false,
      message: `Could not verify your ${channel.label.toLowerCase()}. Please try again.`,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

const sendEmailOtp = (req, res) => createAndSendOtp(req, res, "email");
const sendPhoneOtp = (req, res) => createAndSendOtp(req, res, "phone");
const verifyEmailOtp = (req, res) => verifyOtp(req, res, "email");
const verifyPhoneOtp = (req, res) => verifyOtp(req, res, "phone");

module.exports = {
  signup,
  sendEmailOtp,
  verifyEmailOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
};
