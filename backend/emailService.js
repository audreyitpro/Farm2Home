const nodemailer = require("nodemailer");

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "audreyitprofesional@gmail.com";

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;

function getTransporter() {
  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
    console.warn(
      "Email not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD in .env"
    );

    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD,
    },
  });
}

async function sendAdminEmail({ subject, text, html }) {
  const transporter = getTransporter();

  if (!transporter) {
    console.log("Email skipped:", subject);
    return {
      sent: false,
      reason: "Email credentials missing",
    };
  }

  const info = await transporter.sendMail({
    from: `"Farm2Home Admin Alerts" <${EMAIL_USER}>`,
    to: ADMIN_EMAIL,
    subject,
    text,
    html,
  });

  return {
    sent: true,
    messageId: info.messageId,
  };
}

async function sendFarmerVerificationEmail(farmer) {
  return sendAdminEmail({
    subject: "New Farm2Home Farmer Verification Submitted",
    text: `
New Farmer Verification Submitted

Farm Name: ${farmer.farmName || farmer.businessName || "Not provided"}
Owner: ${farmer.ownerName || "Not provided"}
Email: ${farmer.email || "Not provided"}
Phone: ${farmer.phone || "Not provided"}

Status: Pending Admin Review

Open the Farm2Home admin dashboard to review documents and approve or reject this farmer.
`,
    html: `
      <h2>New Farmer Verification Submitted</h2>
      <p><strong>Farm Name:</strong> ${
        farmer.farmName || farmer.businessName || "Not provided"
      }</p>
      <p><strong>Owner:</strong> ${farmer.ownerName || "Not provided"}</p>
      <p><strong>Email:</strong> ${farmer.email || "Not provided"}</p>
      <p><strong>Phone:</strong> ${farmer.phone || "Not provided"}</p>
      <p><strong>Status:</strong> Pending Admin Review</p>
      <p>Open the Farm2Home admin dashboard to review documents and approve or reject this farmer.</p>
    `,
  });
}

async function sendFreightVerificationEmail(carrier) {
  return sendAdminEmail({
    subject: "New Farm2Home Freight Carrier Verification Submitted",
    text: `
New Freight Carrier Verification Submitted

Company: ${carrier.companyName || "Not provided"}
Contact: ${carrier.contactName || carrier.ownerName || "Not provided"}
Email: ${carrier.email || "Not provided"}
Phone: ${carrier.phone || "Not provided"}
MC Number: ${carrier.mcNumber || "Not provided"}
MDOT/DOT Number: ${carrier.mdotNumber || carrier.dotNumber || "Not provided"}
Insurance Provider: ${carrier.insuranceProvider || "Not provided"}
Policy Number: ${carrier.insurancePolicyNumber || "Not provided"}

Status: Pending Admin Review

Open the Farm2Home admin dashboard to review documents and approve or reject this carrier.
`,
    html: `
      <h2>New Freight Carrier Verification Submitted</h2>
      <p><strong>Company:</strong> ${carrier.companyName || "Not provided"}</p>
      <p><strong>Contact:</strong> ${
        carrier.contactName || carrier.ownerName || "Not provided"
      }</p>
      <p><strong>Email:</strong> ${carrier.email || "Not provided"}</p>
      <p><strong>Phone:</strong> ${carrier.phone || "Not provided"}</p>
      <p><strong>MC Number:</strong> ${carrier.mcNumber || "Not provided"}</p>
      <p><strong>MDOT/DOT Number:</strong> ${
        carrier.mdotNumber || carrier.dotNumber || "Not provided"
      }</p>
      <p><strong>Insurance Provider:</strong> ${
        carrier.insuranceProvider || "Not provided"
      }</p>
      <p><strong>Policy Number:</strong> ${
        carrier.insurancePolicyNumber || "Not provided"
      }</p>
      <p><strong>Status:</strong> Pending Admin Review</p>
      <p>Open the Farm2Home admin dashboard to review documents and approve or reject this carrier.</p>
    `,
  });
}

async function sendDocumentsSubmittedEmail(record) {
  return sendAdminEmail({
    subject: `Documents Submitted: ${record.businessName || "Farm2Home Applicant"}`,
    text: `
Documents Submitted for Review

Business: ${record.businessName || "Not provided"}
Account Type: ${record.accountType || "Not provided"}
Owner/Contact: ${record.ownerName || "Not provided"}
Email: ${record.email || "Not provided"}
Phone: ${record.phone || "Not provided"}
Documents Count: ${record.documents?.length || 0}

Status: Documents Submitted

Open the Farm2Home admin dashboard to review submitted documents.
`,
    html: `
      <h2>Documents Submitted for Review</h2>
      <p><strong>Business:</strong> ${
        record.businessName || "Not provided"
      }</p>
      <p><strong>Account Type:</strong> ${
        record.accountType || "Not provided"
      }</p>
      <p><strong>Owner/Contact:</strong> ${
        record.ownerName || "Not provided"
      }</p>
      <p><strong>Email:</strong> ${record.email || "Not provided"}</p>
      <p><strong>Phone:</strong> ${record.phone || "Not provided"}</p>
      <p><strong>Documents Count:</strong> ${record.documents?.length || 0}</p>
      <p><strong>Status:</strong> Documents Submitted</p>
      <p>Open the Farm2Home admin dashboard to review submitted documents.</p>
    `,
  });
}

module.exports = {
  sendAdminEmail,
  sendFarmerVerificationEmail,
  sendFreightVerificationEmail,
  sendDocumentsSubmittedEmail,
};