// Vercel serverless function: emails questionnaire answers via Resend.
// Env vars: RESEND_API_KEY (required), RESEND_FROM (sender on your verified Resend domain), MAIL_TO (default burhan@magolabs.in)
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
    if (!process.env.RESEND_API_KEY) return res.status(500).json({ ok: false, error: "RESEND_API_KEY is not set" });

    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    body = body || {};
    const sections = Array.isArray(body.sections) ? body.sections.slice(0, 20) : [];
    if (!sections.length) return res.status(400).json({ ok: false, error: "No answers received" });

    const clinic = String(body.clinic || "Dental clinic").slice(0, 120);
    const doctor = String(body.doctor || "").slice(0, 120);
    const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || "") ? body.email : undefined;

    const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#0D0D0D">
      <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7E7E7E;margin:0 0 6px">Mago Labs · Website questionnaire</p>
      <h1 style="font-size:22px;margin:0 0 4px">${esc(clinic)}</h1>
      <p style="margin:0 0 20px;color:#7E7E7E">${esc(doctor)}${body.phone ? " · " + esc(body.phone) : ""}</p>
      ${sections.map((s) => `
        <h2 style="font-size:12px;letter-spacing:2px;text-transform:uppercase;border-top:3px solid #FFC53D;padding-top:10px;margin:24px 0 8px">${esc(s.title)}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${(s.items || []).slice(0, 80).map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#7E7E7E;vertical-align:top;width:40%;border-bottom:1px solid #E4E1D9">${esc(k)}</td><td style="padding:6px 0;vertical-align:top;border-bottom:1px solid #E4E1D9;white-space:pre-wrap">${esc(v)}</td></tr>`).join("")}
        </table>`).join("")}
    </div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Mago Labs Forms <forms@magolabs.in>",
        to: [process.env.MAIL_TO || "burhan@magolabs.in"],
        reply_to: replyTo,
        subject: `Website questionnaire: ${clinic}${doctor ? " (" + doctor + ")" : ""}`,
        html,
        text: String(body.text || "").slice(0, 50000),
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      console.error("Resend error", r.status, detail);
      let msg = "Email service error " + r.status;
      try { msg += ": " + (JSON.parse(detail).message || ""); } catch (_) {}
      return res.status(502).json({ ok: false, error: msg });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Server error: " + (e && e.message) });
  }
};
