const jwt = require("jsonwebtoken");

// ✅ Use this on routes that require a logged-in user
function requireAuth(req, res, next) {
  try {
    // Expecting:  Authorization: Bearer <token>
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    // Decode + verify the token using your .env JWT_SECRET
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Put the user info on req so route handlers can use it
    req.user = { id: payload.userId, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ✅ Use this when only creators should access a route
function requireCreator(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== "creator")
    return res.status(403).json({ error: "Creator access only" });
  next();
}

// ✅ Use this when only admins should access a route
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Admin access only" });
  next();
}

module.exports = { requireAuth, requireCreator, requireAdmin };