const APP_NAME = process.env.APP_DISPLAY_NAME || "VirtualXI";

/**
 * Wrap inner HTML in a consistent transactional layout (logo placeholder + footer).
 * @param {string} innerHtml — body content only (no outer html/body)
 * @returns {string}
 */
function layout(innerHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Segoe UI,system-ui,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:20px 24px 12px;border-bottom:1px solid #e5e7eb;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);">
              <table role="presentation" width="100%"><tr>
                <td style="vertical-align:middle;">
                  <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.12);display:inline-block;text-align:center;line-height:40px;font-size:18px;color:#e2e8f0;" aria-hidden="true">⚽</div>
                  <span style="margin-left:12px;font-size:18px;font-weight:800;color:#f8fafc;letter-spacing:-0.02em;">${APP_NAME}</span>
                </td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 24px 8px;font-size:15px;line-height:1.55;color:#374151;">
              ${innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 20px;font-size:12px;line-height:1.5;color:#9ca3af;border-top:1px solid #f3f4f6;">
              You received this email because of activity on your ${APP_NAME} account.<br />
              If you did not expect this message, you can ignore it or secure your account.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { layout, APP_NAME };
