const { APP_NAME } = require("./emailLayout");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function welcomeInner(displayName) {
  return `
    <p style="margin:0 0 12px;">Hi ${esc(displayName)},</p>
    <p style="margin:0 0 12px;">Welcome to <strong>${esc(APP_NAME)}</strong> — your FIFA career tracker.</p>
    <p style="margin:0 0 12px;">Here’s what you can do:</p>
    <ul style="margin:0 0 12px;padding-left:20px;">
      <li>Log season-by-season club and international stats</li>
      <li>Track trophies, awards, and transfers</li>
      <li>Explore dashboards, charts, and your trophy cabinet</li>
    </ul>
    <p style="margin:0;">Good luck on the pitch — we’ll keep the numbers tidy.</p>
  `;
}

function loginNoticeInner(displayName, whenIso) {
  const when = esc(whenIso);
  return `
    <p style="margin:0 0 12px;">Hi ${esc(displayName)},</p>
    <p style="margin:0 0 12px;">Someone just signed in to your <strong>${esc(APP_NAME)}</strong> account.</p>
    <p style="margin:0 0 12px;"><strong>When:</strong> ${when}</p>
    <p style="margin:0;">If this wasn’t you, change your password from Account settings or use password reset on the login page.</p>
  `;
}

function passwordResetCodeInner(displayName, code) {
  return `
    <p style="margin:0 0 12px;">Hi ${esc(displayName)},</p>
    <p style="margin:0 0 12px;">Use this code to reset your ${esc(APP_NAME)} password. It expires in <strong>15 minutes</strong>.</p>
    <p style="margin:20px 0;text-align:center;">
      <span style="display:inline-block;padding:14px 28px;font-size:28px;font-weight:800;letter-spacing:0.25em;background:#0f172a;color:#f8fafc;border-radius:10px;">${esc(code)}</span>
    </p>
    <p style="margin:0;color:#6b7280;font-size:13px;">If you didn’t request a reset, you can ignore this email.</p>
  `;
}

function kvTable(rows) {
  const trs = rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;width:38%;">${esc(r.label)}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${esc(r.value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:12px 0;">${trs}</table>`;
}

function seasonAddedInner(displayName, row) {
  const rows = [
    { label: "Season", value: row.season ?? "—" },
    { label: "Competition", value: row.competition ?? "—" },
    { label: "Team", value: row.team ?? "—" },
    { label: "Apps", value: String(row.apps ?? "—") },
    { label: "Goals", value: String(row.goals ?? "—") },
    { label: "Assists", value: String(row.assists ?? "—") },
    { label: "Avg rating", value: String(row.avgrating ?? "—") },
    { label: "Finish", value: row.finish ?? "—" },
  ];
  return `
    <p style="margin:0 0 12px;">Hi ${esc(displayName)},</p>
    <p style="margin:0 0 12px;">New season data was added for <strong>${esc(row.season || "your career")}</strong>.</p>
    ${kvTable(rows)}
  `;
}

function diffRowsInner(changes) {
  if (!changes.length) {
    return "<p style=\"margin:0;\">No field changes detected.</p>";
  }
  const trs = changes
    .map(
      (c) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">${esc(c.field)}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#b91c1c;">${esc(c.old)}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#047857;">${esc(c.new)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:12px 0;">
    <tr><th align="left" style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;">Field</th><th align="left" style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;">Before</th><th align="left" style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;">After</th></tr>
    ${trs}
  </table>`;
}

function seasonUpdatedInner(displayName, seasonLabel, changes) {
  return `
    <p style="margin:0 0 12px;">Hi ${esc(displayName)},</p>
    <p style="margin:0 0 12px;">Season data was updated for <strong>${esc(seasonLabel)}</strong>.</p>
    ${diffRowsInner(changes)}
  `;
}

function yearlyAddedInner(displayName, row) {
  const rows = [
    { label: "Year", value: row.year ?? "—" },
    { label: "Goals", value: String(row.goals ?? "—") },
    { label: "Assists", value: String(row.assists ?? "—") },
  ];
  return `
    <p style="margin:0 0 12px;">Hi ${esc(displayName)},</p>
    <p style="margin:0 0 12px;">New yearly totals were added for <strong>${esc(row.year || "a calendar year")}</strong>.</p>
    ${kvTable(rows)}
  `;
}

function yearlyUpdatedInner(displayName, yearLabel, changes) {
  return `
    <p style="margin:0 0 12px;">Hi ${esc(displayName)},</p>
    <p style="margin:0 0 12px;">Yearly data was updated for <strong>${esc(yearLabel)}</strong>.</p>
    ${diffRowsInner(changes)}
  `;
}

module.exports = {
  welcomeInner,
  loginNoticeInner,
  passwordResetCodeInner,
  seasonAddedInner,
  seasonUpdatedInner,
  yearlyAddedInner,
  yearlyUpdatedInner,
};
