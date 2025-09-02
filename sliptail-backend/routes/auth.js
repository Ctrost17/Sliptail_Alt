const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db");
const { enqueueAndSend } = require("../utils/emailQueue");
const { validate } = require("../middleware/validate");
const { authSignup, authLogin } = require("../validators/schemas");
const { strictLimiter } = require("../middleware/rateLimit");

const router = express.Router();

const {
  JWT_SECRET,
  APP_URL = "http://localhost:5000",
} = process.env;

const BASE_URL = APP_URL.replace(/\/$/, "");

// ---------- helpers ----------
function toSafeUser(u) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    email_verified_at: u.email_verified_at,
    created_at: u.created_at
  };
}

function issueJwt(user) {
  // include a small subset on the token
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role || "user",
      email_verified_at: user.email_verified_at
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function sendVerifyEmail(userId, email) {
  // invalidate any prior unconsumed verify tokens
  await db.query(
    `UPDATE user_tokens
        SET consumed_at = NOW()
      WHERE user_id = $1 AND token_type='email_verify' AND consumed_at IS NULL`,
    [userId]
  );

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await db.query(
    `INSERT INTO user_tokens (user_id, token, token_type, expires_at)
     VALUES ($1,$2,'email_verify',$3)`,
    [userId, token, expires]
  );

  const verifyUrl = `${BASE_URL}/api/email/verify/${token}`;
  const html = `
    <h2>Verify your email</h2>
    <p>Click the link to verify your email:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>This link expires in 24 hours.</p>
  `;

  await enqueueAndSend({
    to: email,
    subject: "Verify your email",
    html,
    category: "email_verify",
  });
}

// ---------- routes ----------

/**
 * POST /api/auth/signup
 * Body: { email, password, username? }
 * Creates the user, sends verify email, DOES NOT issue JWT yet.
 */
router.post("/signup", strictLimiter, validate(authSignup), async (req, res) => {
  try {
    const { email, password, username } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const { rows: exists } = await db.query(
      `SELECT id FROM users WHERE email=$1 LIMIT 1`,
      [email.toLowerCase()]
    );
    if (exists.length) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (email, password, username, role, created_at)
       VALUES ($1,$2,$3,'user',NOW())
       RETURNING *`,
      [email.toLowerCase(), hash, username || null]
    );

    const user = rows[0];

    // Send verification email (no login yet)
    await sendVerifyEmail(user.id, user.email);

    return res.status(202).json({ checkEmail: true });
  } catch (e) {
    console.error("signup error:", e);
    return res.status(500).json({ error: "Failed to sign up" });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Requires email to be verified first.
 */
router.post("/login", strictLimiter, validate(authLogin), async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const { rows } = await db.query(
      `SELECT * FROM users WHERE email=$1 LIMIT 1`,
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !user.password) {
      // either no user or it's a social login only
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    // block unverified users
    if (!user.email_verified_at) {
      return res.status(403).json({ error: "Please verify your email to continue." });
    }

    const token = issueJwt(user);
    return res.json({ token, user: toSafeUser(user) });
  } catch (e) {
    console.error("login error:", e);
    return res.status(500).json({ error: "Failed to login" });
  }
});

/**
 * POST /api/auth/forgot
 * Body: { email }
 * Always responds success (prevents user enumeration)
 */
router.post("/forgot", strictLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email is required" });

    const { rows } = await db.query(`SELECT id FROM users WHERE email=$1 LIMIT 1`, [email.toLowerCase()]);
    if (rows.length) {
      const userId = rows[0].id;

      // invalidate old tokens
      await db.query(
        `UPDATE user_tokens
            SET consumed_at = NOW()
          WHERE user_id=$1 AND token_type='password_reset' AND consumed_at IS NULL`,
        [userId]
      );

      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

      await db.query(
        `INSERT INTO user_tokens (user_id, token, token_type, expires_at)
         VALUES ($1,$2,'password_reset',$3)`,
        [userId, token, expires]
      );

      const resetUrl = `${BASE_URL}/reset-password?token=${token}`;
      const html = `
        <h2>Reset your password</h2>
        <p>Click to set a new password (valid 1 hour):</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you didn't request this, you can ignore this email.</p>
      `;

      await enqueueAndSend({
        to: email.toLowerCase(),
        subject: "Reset your password",
        html,
        category: "password_reset",
      });
    }

    return res.json({ success: true, message: "If this email exists, a reset link was sent." });
  } catch (e) {
    console.error("forgot error:", e);
    return res.status(500).json({ error: "Failed to process request" });
  }
});

/**
 * POST /api/auth/reset
 * Body: { token, password }
 * Consumes token and sets new password
 */
router.post("/reset", strictLimiter, async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: "token and password are required" });
    }

    const { rows } = await db.query(
      `SELECT user_id, expires_at, consumed_at
         FROM user_tokens
        WHERE token=$1 AND token_type='password_reset'`,
      [token]
    );
    const t = rows[0];
    if (!t) return res.status(400).json({ error: "Invalid token" });
    if (t.consumed_at) return res.status(400).json({ error: "Token already used" });
    if (new Date(t.expires_at) < new Date()) return res.status(400).json({ error: "Token expired" });

    const hashed = await bcrypt.hash(password, 10);

    await db.query("BEGIN");
    await db.query(`UPDATE users SET password=$1 WHERE id=$2`, [hashed, t.user_id]);
    await db.query(`UPDATE user_tokens SET consumed_at=NOW() WHERE token=$1`, [token]);
    await db.query("COMMIT");

    return res.json({ success: true, message: "Password updated" });
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    console.error("reset error:", e);
    return res.status(500).json({ error: "Failed to reset password" });
  }
});

module.exports = router;