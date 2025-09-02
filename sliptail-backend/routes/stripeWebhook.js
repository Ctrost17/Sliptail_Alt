const Stripe = require("stripe");
const db = require("../db");
const { notifyPurchase } = require("../utils/notify");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Export a single handler function.
 * index.js mounts it with express.raw(...) already:
 * app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook)
 */
module.exports = async function stripeWebhook(req, res) {
  let event;

  // 1) Verify Stripe signature (req.body is a Buffer thanks to express.raw)
  try {
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("⚠️  Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 2) De-duplicate events (Stripe can retry)
  try {
    const evId = event.id;
    const { rows } = await db.query(
      `INSERT INTO processed_webhook_events (id)
       VALUES ($1)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [evId]
    );
    // If no row was inserted, we've already processed this event
    if (!rows.length) {
      return res.status(200).end();
    }
  } catch (e) {
    console.error("Webhook de-dup insert failed (continuing):", e);
    // If the table isn't there yet, we still proceed so you don't miss events.
  }

  // 3) Handle relevant events
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        if (session.mode === "payment") {
          // one-time purchase/request
          const orderId =
            session.metadata?.order_id && parseInt(session.metadata.order_id, 10);
          const paymentIntentId = session.payment_intent;

          if (orderId) {
            await db.query(
              `UPDATE orders
                  SET status='paid',
                      stripe_payment_intent_id=$1
                WHERE id=$2 AND status='pending'`,
              [paymentIntentId, orderId]
            );
            await notifyPurchase({ orderId });
          }
        }

        if (session.mode === "subscription") {
          // store customer id on user (optional, helpful later)
          const customer = session.customer;
          const buyerId =
            session.metadata?.buyer_id && parseInt(session.metadata.buyer_id, 10);
          if (customer && buyerId) {
            await db.query(
              `UPDATE users
                 SET stripe_customer_id=$1
               WHERE id=$2 AND (stripe_customer_id IS NULL OR stripe_customer_id <> $1)`,
              [customer, buyerId]
            );
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        // fallback: mark order paid if we put order_id in PI metadata
        const pi = event.data.object;
        const orderId = pi.metadata?.order_id && parseInt(pi.metadata.order_id, 10);
        if (orderId) {
          await db.query(
            `UPDATE orders
                SET status='paid',
                    stripe_payment_intent_id=$1
              WHERE id=$2 AND status <> 'paid'`,
            [pi.id, orderId]
          );
          await notifyPurchase({ orderId });
        }
        break;
      }

      // Subscription lifecycle → upsert memberships
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const status = sub.status; // trialing, active, past_due, canceled, etc.
        const currentPeriodEnd = new Date(sub.current_period_end * 1000);

        const meta = sub.metadata || {};
        const buyerId   = meta.buyer_id && parseInt(meta.buyer_id, 10);
        const creatorId = meta.creator_id && parseInt(meta.creator_id, 10);
        const productId = meta.product_id && parseInt(meta.product_id, 10);

        if (buyerId && creatorId && productId) {
          if (event.type === "customer.subscription.deleted") {
            // canceled: keep access until period end
            await db.query(
              `UPDATE memberships
                  SET status='canceled',
                      current_period_end=$1
                WHERE stripe_subscription_id=$2`,
              [currentPeriodEnd, sub.id]
            );
          } else {
            // create or update
            await db.query(
              `INSERT INTO memberships
                 (buyer_id, creator_id, product_id, stripe_subscription_id, status, current_period_end, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,NOW())
               ON CONFLICT (stripe_subscription_id) DO UPDATE
                 SET status=EXCLUDED.status,
                     current_period_end=EXCLUDED.current_period_end`,
              [buyerId, creatorId, productId, sub.id, status, currentPeriodEnd]
            );
          }
        }
        break;
      }

      case "invoice.paid": {
        // keep period synced on renewals
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const status = sub.status;
          const currentPeriodEnd = new Date(sub.current_period_end * 1000);
          await db.query(
            `UPDATE memberships
                SET status=$1,
                    current_period_end=$2
              WHERE stripe_subscription_id=$3`,
            [status, currentPeriodEnd, subId]
          );
        }
        break;
      }

      default:
        // other events are fine to ignore
        break;
    }
  } catch (e) {
    console.error("Webhook handling error:", e);
    // tell Stripe to retry
    return res.status(500).send("webhook handler error");
  }

  // 4) Always ACK
  res.json({ received: true });
};
