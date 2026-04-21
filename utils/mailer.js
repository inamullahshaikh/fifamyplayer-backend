/**
 * Central Nodemailer transport (single cached instance).
 * Env: MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM, optional MAIL_FROM_NAME, MAIL_SECURE.
 * Legacy fallbacks: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM_ADDRESS.
 * Use a transactional provider (e.g. Resend, SendGrid); MAIL_HOST has no default — set it explicitly.
 */

const nodemailer = require("nodemailer");

/** @type {import('nodemailer').Transporter | null} */
let cachedTransporter = null;

function readBool(v, defaultWhenEmpty = false) {
  if (v == null || v === "") return defaultWhenEmpty;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return defaultWhenEmpty;
}

function getSmtpConfig() {
  const host = String(
    process.env.MAIL_HOST || process.env.SMTP_HOST || "",
  ).trim();
  const port =
    Number(process.env.MAIL_PORT || process.env.SMTP_PORT || 587) || 587;
  const secure =
    readBool(process.env.MAIL_SECURE || process.env.SMTP_SECURE) ||
    port === 465;
  const user = String(
    process.env.MAIL_USER || process.env.SMTP_USER || "",
  ).trim();
  const pass = String(
    process.env.MAIL_PASS || process.env.SMTP_PASS || "",
  ).trim();
  const fromAddress = String(
    process.env.MAIL_FROM || process.env.MAIL_FROM_ADDRESS || user,
  ).trim();
  const fromName = String(
    process.env.MAIL_FROM_NAME || "VirtualXI",
  ).trim();
  return { host, port, secure, user, pass, fromAddress, fromName };
}

function isMailConfigured() {
  const c = getSmtpConfig();
  return Boolean(c.host && c.user && c.pass && c.fromAddress);
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;
  const c = getSmtpConfig();
  cachedTransporter = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    requireTLS: !c.secure,
    auth: { user: c.user, pass: c.pass },
  });
  return cachedTransporter;
}

function htmlToPlainText(html) {
  return String(html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 * @param {{ text?: string, replyTo?: string }} [extra]
 * @returns {Promise<{ ok: true, messageId: string } | { ok: false, skipped?: boolean, error?: string }>}
 */
async function sendMail(to, subject, html, extra = {}) {
  const subjectClean = String(subject || "").trim();
  const toClean = String(to || "").trim();
  if (!toClean || !subjectClean) {
    return { ok: false, error: "Missing to or subject" };
  }
  if (!isMailConfigured()) {
    if (readBool(process.env.MAIL_LOG_SKIPPED, true)) {
      console.warn(
        "[mail] send skipped: set MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM",
      );
    }
    return { ok: false, skipped: true };
  }
  const c = getSmtpConfig();
  const from = `${c.fromName} <${c.fromAddress}>`;
  const transport = getTransporter();
  try {
    const info = await transport.sendMail({
      from,
      to: toClean,
      subject: subjectClean,
      html: String(html || ""),
      text: extra.text != null ? extra.text : htmlToPlainText(html),
      replyTo: extra.replyTo,
    });
    return { ok: true, messageId: String(info.messageId || "") };
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error("[mail] send failed:", msg);
    return { ok: false, error: msg };
  }
}

async function verifyConnection() {
  if (!isMailConfigured()) return { ok: false, skipped: true };
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error("[mail] SMTP verify failed:", msg);
    return { ok: false, error: msg };
  }
}

function logMailStartup() {
  const c = getSmtpConfig();
  if (isMailConfigured()) {
    console.log(
      `📧 Mail: SMTP configured (${c.host}:${c.port}, from ${c.fromAddress}) — auth is checked on first send or when MAIL_VERIFY_ON_START=1`,
    );
  } else {
    console.log(
      "📧 Mail: not configured (set MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM — see .env.example for Resend/SendGrid)",
    );
  }
}

async function maybeVerifyOnStart() {
  if (!readBool(process.env.MAIL_VERIFY_ON_START)) return;
  if (!isMailConfigured()) return;
  const r = await verifyConnection();
  if (r.ok) console.log("📧 Mail: SMTP verify OK");
}

/**
 * Fire-and-forget async work (e.g. send email) without blocking the HTTP response.
 * @param {() => void | Promise<void>} fn
 */
function enqueueEmail(fn) {
  setImmediate(() => {
    void (async () => {
      try {
        await fn();
      } catch (e) {
        console.error("[email] background task error:", e);
      }
    })();
  });
}

module.exports = {
  sendMail,
  isMailConfigured,
  getSmtpConfig,
  verifyConnection,
  logMailStartup,
  maybeVerifyOnStart,
  enqueueEmail,
  htmlToPlainText,
};
