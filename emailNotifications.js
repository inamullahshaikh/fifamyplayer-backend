/**
 * Transactional emails — utils/mailer + templates. Sends are deferred via enqueueEmail.
 */

const mongoose = require("mongoose");
const { sendMail, enqueueEmail } = require("./utils/mailer");
const { layout } = require("./templates/emailLayout");
const emails = require("./templates/emails");

function wrap(htmlFragment) {
  return layout(htmlFragment);
}

async function userMailCtx(userId) {
  try {
    const User = mongoose.model("User");
    const u = await User.findById(userId).select("name email username").lean();
    if (!u || !String(u.email || "").trim()) return null;
    return {
      email: String(u.email).trim(),
      name: (u.name && String(u.name).trim()) || u.username,
      username: u.username,
    };
  } catch {
    return null;
  }
}

function safeName(ctx) {
  const n = ctx && ctx.name != null ? String(ctx.name).trim() : "";
  return n || (ctx && ctx.username) || "there";
}

/** @param {{ email: string, name?: string, username?: string }} ctx */
function notifyWelcome(ctx) {
  if (!ctx?.email) return;
  const inner = emails.welcomeInner(safeName(ctx));
  enqueueEmail(() => {
    void sendMail(ctx.email, `Welcome to VirtualXI`, wrap(inner)).catch((e) =>
      console.error("[email] welcome:", e),
    );
  });
}

/** @param {{ email: string, name?: string, username?: string }} ctx */
function notifyLogin(ctx, whenIso) {
  if (!ctx?.email) return;
  const inner = emails.loginNoticeInner(safeName(ctx), whenIso);
  enqueueEmail(() => {
    void sendMail(
      ctx.email,
      "New sign-in to your VirtualXI account",
      wrap(inner),
    ).catch((e) => console.error("[email] login:", e));
  });
}

/** @param {{ email: string, name?: string, username?: string }} ctx */
function notifyPasswordResetCode(ctx, code) {
  if (!ctx?.email) return;
  const inner = emails.passwordResetCodeInner(safeName(ctx), code);
  enqueueEmail(() => {
    void sendMail(ctx.email, "Your password reset code", wrap(inner)).catch((e) =>
      console.error("[email] reset code:", e),
    );
  });
}

function notifySeasonDataAdded(userId, row) {
  enqueueEmail(async () => {
    try {
      const ctx = await userMailCtx(userId);
      if (!ctx) return;
      const season = String(row.season || "").trim() || "Season";
      const inner = emails.seasonAddedInner(safeName(ctx), row);
      await sendMail(ctx.email, `New season added: ${season}`, wrap(inner));
    } catch (e) {
      console.error("[email] season added:", e);
    }
  });
}

function notifySeasonDataUpdated(userId, oldRow, newRow) {
  enqueueEmail(async () => {
    try {
      const ctx = await userMailCtx(userId);
      if (!ctx) return;
      const season =
        String(newRow.season || oldRow.season || "").trim() || "Season";
      const fields = [
        "season",
        "competition",
        "team",
        "apps",
        "goals",
        "assists",
        "avgrating",
        "finish",
      ];
      const changes = [];
      for (const f of fields) {
        const a = oldRow[f] != null ? String(oldRow[f]) : "";
        const b = newRow[f] != null ? String(newRow[f]) : "";
        if (a !== b) changes.push({ field: f, old: a || "—", new: b || "—" });
      }
      const inner = emails.seasonUpdatedInner(safeName(ctx), season, changes);
      await sendMail(ctx.email, `Season updated: ${season}`, wrap(inner));
    } catch (e) {
      console.error("[email] season updated:", e);
    }
  });
}

function notifyYearlyDataAdded(userId, row) {
  enqueueEmail(async () => {
    try {
      const ctx = await userMailCtx(userId);
      if (!ctx) return;
      const year = String(row.year || "").trim() || "Year";
      const inner = emails.yearlyAddedInner(safeName(ctx), row);
      await sendMail(ctx.email, `Yearly data added: ${year}`, wrap(inner));
    } catch (e) {
      console.error("[email] yearly added:", e);
    }
  });
}

function notifyYearlyDataUpdated(userId, oldRow, newRow) {
  enqueueEmail(async () => {
    try {
      const ctx = await userMailCtx(userId);
      if (!ctx) return;
      const year =
        String(newRow.year || oldRow.year || "").trim() || "Year";
      const fields = ["year", "goals", "assists"];
      const changes = [];
      for (const f of fields) {
        const a = oldRow[f] != null ? String(oldRow[f]) : "";
        const b = newRow[f] != null ? String(newRow[f]) : "";
        if (a !== b) changes.push({ field: f, old: a || "—", new: b || "—" });
      }
      const inner = emails.yearlyUpdatedInner(safeName(ctx), year, changes);
      await sendMail(ctx.email, `Yearly data updated: ${year}`, wrap(inner));
    } catch (e) {
      console.error("[email] yearly updated:", e);
    }
  });
}

module.exports = {
  notifyWelcome,
  notifyLogin,
  notifyPasswordResetCode,
  notifySeasonDataAdded,
  notifySeasonDataUpdated,
  notifyYearlyDataAdded,
  notifyYearlyDataUpdated,
};
