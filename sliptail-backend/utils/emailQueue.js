const db = require("../db");
const { sendMail } = require("./mailer");

/**
 * Insert into email_queue and send immediately in-process (MVP).
 * If you later run a worker/cron, you can change this to only enqueue.
 */
async function enqueueAndSend({ to, subject, html, category }) {
  let rec;
  try {
    const { rows } = await db.query(
      `INSERT INTO email_queue (to_email, subject, html, category)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [to, subject, html, category || null]
    );
    rec = rows[0];
  } catch (e) {
    // queue table might not exist; fall back to send directly
  }

  try {
    await sendMail({ to, subject, html });
    if (rec) {
      await db.query(
        `UPDATE email_queue SET status='sent', sent_at=NOW() WHERE id=$1`,
        [rec.id]
      );
    }
  } catch (e) {
    if (rec) {
      await db.query(
        `UPDATE email_queue SET status='failed', error=$2 WHERE id=$1`,
        [rec.id, e.message || String(e)]
      );
    }
    throw e;
  }
}

module.exports = { enqueueAndSend };