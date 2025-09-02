const express = require('express');
const cors = require('cors');
require("dotenv").config();
const db = require('./db');  // DB connection
const authRoutes = require('./routes/auth');
const stripeRoutes = require('./routes/stripe');
const productRoutes = require('./routes/products');
const orderRoutes = require("./routes/orders");
const downloadRoutes = require("./routes/downloads");
const requestRoutes = require("./routes/requests");
const creatorDashboardRoutes = require("./routes/creatorDashboard");
const membershipRoutes = require("./routes/memberships");
const postRoutes = require("./routes/posts");
const creatorRoutes = require("./routes/creators");
const categoryRoutes = require("./routes/categories");
const homeRoutes = require("./routes/home");
const reviewRoutes = require("./routes/reviews");
const emailRoutes = require("./routes/email");
const settingsRoutes = require("./routes/settings");
const cron = require("node-cron");
const { notifyMembershipsExpiring } = require("./utils/notify");
const passport = require("passport");
const googleAuthRoutes = require("./routes/authGoogle");
const notificationRoutes = require("./routes/notifications");
const adminRoutes = require("./routes/admin");
const stripeConnectRoutes = require("./routes/stripeConnect");
const stripeCheckoutRoutes = require("./routes/stripeCheckout");
const stripeWebhook = require("./routes/stripeWebhook");
const { strictLimiter, standardLimiter, superStrictLimiter } = require("./middleware/rateLimit");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();
app.post("/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);
app.use(cors());
app.use(express.json({limit: "25mb"}));


app.use('/api/auth', authRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/products', productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/downloads", downloadRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/creator/dashboard", creatorDashboardRoutes);
app.use("/api/memberships", membershipRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/creators", creatorRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/settings", settingsRoutes);
app.use(passport.initialize());
app.use("/api/auth", googleAuthRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stripe-connect", stripeConnectRoutes);
app.use("/api/stripe-checkout", stripeCheckoutRoutes);
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:5000`);
});

// Test route
app.get('/api/health', (req, res) => {
  res.json({ message: '✅ Server is running!' });
});

// Test DB route
app.get('/test-db', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ now: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Daily at 9:00 AM (server time). Change TZ if you want.
if (process.env.CRON_ENABLED === "true") {
  cron.schedule("0 9 * * *", async () => {
    try {
      // 3-day warning window (tweak as you like)
      await notifyMembershipsExpiring({ days: 3 });
      console.log("Membership-expiring emails sent.");
    } catch (e) {
      console.error("Cron job failed:", e);
    }
  }, { timezone: process.env.CRON_TZ || "America/Chicago" });
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});