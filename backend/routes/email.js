// backend/routes/email.js

const express = require("express");

const router = express.Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM =
  process.env.EMAIL_FROM || "Farm2Home <hello@farm2home.com>";

function requireEmailConfig(res) {
  if (!RESEND_API_KEY) {
    res.status(500).json({
      success: false,
      error: "Missing RESEND_API_KEY in backend .env file.",
    });
    return false;
  }

  return true;
}

async function sendEmail({ to, subject, text, html }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject,
      text,
      html,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Email send failed.");
  }

  return data;
}

router.post("/send-farmer-approval", async (req, res) => {
  try {
    if (!requireEmailConfig(res)) return;

    const farmerEmail = String(req.body.email || "").trim().toLowerCase();
    const businessName = String(req.body.businessName || "Farm2Home Farmer").trim();

    if (!farmerEmail || !farmerEmail.includes("@")) {
      return res.status(400).json({
        success: false,
        error: "Valid farmer email is required.",
      });
    }

    const subject = "Welcome to the Farm2Home Family";

    const text = `Congratulations!

Your Farm2Home farmer application has been approved. Welcome to the Farm2Home family.

You can now log in and set up your farmer market store, add products, manage orders, and start selling to customers in your community.

Next step:
Log in to your Farm2Home farmer account and complete your store setup.

Thank you for joining Farm2Home.`;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2 style="color: #14532D;">Congratulations!</h2>

        <p>Your Farm2Home farmer application has been approved. Welcome to the Farm2Home family.</p>

        <p>
          You can now log in and set up your farmer market store, add products,
          manage orders, and start selling to customers in your community.
        </p>

        <p><strong>Next step:</strong><br />
        Log in to your Farm2Home farmer account and complete your store setup.</p>

        <p>Thank you for joining Farm2Home.</p>

        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />

        <p style="font-size: 13px; color: #6B7280;">
          Business: ${businessName}
        </p>
      </div>
    `;

    const emailResult = await sendEmail({
      to: farmerEmail,
      subject,
      text,
      html,
    });

    return res.json({
      success: true,
      message: "Farmer approval email sent.",
      emailResult,
    });
  } catch (error) {
    console.error("send-farmer-approval error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to send farmer approval email.",
    });
  }
});

router.post("/send-farmer-rejection", async (req, res) => {
  try {
    if (!requireEmailConfig(res)) return;

    const farmerEmail = String(req.body.email || "").trim().toLowerCase();
    const businessName = String(req.body.businessName || "Farm2Home Farmer").trim();
    const reason = String(req.body.reason || "").trim();

    if (!farmerEmail || !farmerEmail.includes("@")) {
      return res.status(400).json({
        success: false,
        error: "Valid farmer email is required.",
      });
    }

    const subject = "Farm2Home Farmer Application Update";

    const text = `Hello,

Thank you for applying to join Farm2Home.

After review, your farmer application was not approved at this time.

${reason ? `Reason: ${reason}\n\n` : ""}You may contact Farm2Home support if you believe this was a mistake or if you would like to submit updated information.

Thank you,
Farm2Home`;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2 style="color: #14532D;">Farm2Home Farmer Application Update</h2>

        <p>Thank you for applying to join Farm2Home.</p>

        <p>After review, your farmer application was not approved at this time.</p>

        ${
          reason
            ? `<p><strong>Reason:</strong><br />${reason}</p>`
            : ""
        }

        <p>
          You may contact Farm2Home support if you believe this was a mistake
          or if you would like to submit updated information.
        </p>

        <p>Thank you,<br />Farm2Home</p>

        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />

        <p style="font-size: 13px; color: #6B7280;">
          Business: ${businessName}
        </p>
      </div>
    `;

    const emailResult = await sendEmail({
      to: farmerEmail,
      subject,
      text,
      html,
    });

    return res.json({
      success: true,
      message: "Farmer rejection email sent.",
      emailResult,
    });
  } catch (error) {
    console.error("send-farmer-rejection error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to send farmer rejection email.",
    });
  }
});

module.exports = router;