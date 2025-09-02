const express = require("express");
const Stripe = require("stripe");
const db = require("../db");
const { requireAuth, requireCreator } = require("../middleware/auth");

const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * POST /api/stripe-connect/create-link
 * Creates (or reuses) a Stripe Express account for the creator and returns an onboarding link.
 */
router.post("/create-link", requireAuth, requireCreator, async (req, res) => {
  const userId = req.user.id;

  // 1) ensure the user has a Connect account
  let acctId;
  const { rows } = await db.query(`SELECT stripe_account_id, email FROM users WHERE id=$1`, [userId]);
  const me = rows[0];
  if (!me) return res.status(404).json({ error: "User not found" });

  if (me.stripe_account_id) {
    acctId = me.stripe_account_id;
  } else {
    const acct = await stripe.accounts.create({
      type: "express",
      email: me.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      }
    });
    acctId = acct.id;
    await db.query(`UPDATE users SET stripe_account_id=$1 WHERE id=$2`, [acctId, userId]);
  }

  // 2) create a one-time onboarding/update link
  const link = await stripe.accountLinks.create({
    account: acctId,
    refresh_url: `${process.env.APP_URL.replace(/\/$/,'')}/creator/onboarding/refresh`,
    return_url: `${process.env.APP_URL.replace(/\/$/,'')}/creator/onboarding/complete`,
    type: "account_onboarding"
  });

  res.json({ url: link.url, account_id: acctId });
});

/**
 * GET /api/stripe-connect/status
 * Returns charges/payouts enabled so you can show status in the creator dashboard.
 */
router.get("/status", requireAuth, requireCreator, async (req, res) => {
  const userId = req.user.id;
  const { rows } = await db.query(`SELECT stripe_account_id FROM users WHERE id=$1`, [userId]);
  const acctId = rows[0]?.stripe_account_id;
  if (!acctId) return res.json({ has_account: false });

  const acct = await stripe.accounts.retrieve(acctId);
  res.json({
    has_account: true,
    charges_enabled: acct.charges_enabled,
    payouts_enabled: acct.payouts_enabled,
    details_submitted: acct.details_submitted
  });
});

module.exports = router;