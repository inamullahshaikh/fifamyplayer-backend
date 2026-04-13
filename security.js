const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");

/** Browsers hit these when the SPA runs on Vite (dev / preview). */
const LOCAL_SPA_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function buildCorsOptions() {
  const raw = process.env.CORS_ORIGINS;
  if (!raw || !String(raw).trim()) return undefined;
  const list = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const prod = process.env.NODE_ENV === "production";
  const allowed = prod ? list : [...new Set([...LOCAL_SPA_ORIGINS, ...list])];
  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  };
}

/**
 * Trust proxy (Render / Heroku), HTTPS expectation, Helmet, Morgan, CORS.
 * CSP is omitted on the API — the SPA host should send CSP for HTML.
 */
function applySecurity(app) {
  const prod = process.env.NODE_ENV === "production";

  if (prod || process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
  }

  if (prod && process.env.ENFORCE_HTTPS !== "0") {
    app.use((req, res, next) => {
      const p = req.headers["x-forwarded-proto"];
      if (p && p !== "https") {
        return res.status(403).json({ error: "HTTPS required" });
      }
      next();
    });
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    }),
  );

  app.use(morgan(prod ? "combined" : "dev"));

  const corsOpts = buildCorsOptions();
  app.use(cors(corsOpts));

  if (prod && !process.env.CORS_ORIGINS) {
    console.warn(
      "⚠️  CORS_ORIGINS not set. Other sites can call this API from browsers. Set CORS_ORIGINS to your SPA origin(s), comma-separated.",
    );
  }
}

/**
 * Strip keys like `$gt` from JSON bodies only. The default express-mongo-sanitize
 * middleware reassigns req.query/req.params, which throws on Express 5 (read-only).
 */
function sanitizeJsonBody(req, _res, next) {
  if (req.body != null && typeof req.body === "object") {
    req.body = mongoSanitize.sanitize(req.body);
  }
  next();
}

function installBodyParsers(app) {
  app.use(express.json({ limit: "256kb" }));
  app.use(sanitizeJsonBody);
}

module.exports = {
  applySecurity,
  installBodyParsers,
};
