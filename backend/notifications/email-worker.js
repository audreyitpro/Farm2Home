
/**
 * Farm2Home Direct
 * Farmer Email Notification Worker
 *
 * File: backend/notifications/email-worker.js
 *
 * Test command:
 * node notifications/email-worker.js --test-farmer=FARMER_UUID
 */

const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

// =====================================================
// ENVIRONMENT CONFIGURATION
// =====================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const RESEND_API_KEY = process.env.RESEND_API_KEY;

const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  process.env.EMAIL_FROM ||
  "support@asodevelopments.com";

const FARM2HOME_WEB_URL = (
  process.env.FARM2HOME_WEB_URL ||
  "https://farm2homedirect.com"
).replace(/\/$/, "");

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !RESEND_API_KEY
) {
  console.error(
    "Missing required environment variables."
  );

  console.error(
    "Required: SUPABASE_URL, " +
    "SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY"
  );

  process.exit(1);
}

// =====================================================
// CLIENTS
// =====================================================

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const resend = new Resend(RESEND_API_KEY);

// =====================================================
// HELPERS
// =====================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value) {
  return "$" + Number(value || 0).toFixed(2);
}

function validEmail(value) {
  const address = String(value || "").trim();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
  ) {
    return false;
  }

  if (
    address.toLowerCase().includes("enter_email") ||
    address.toLowerCase().includes("example.com")
  ) {
    return false;
  }

  return true;
}

// =====================================================
// FARMER PROFILE LOOKUP
// =====================================================


async function getFarmerProfile(farmerId) {
  const { data, error } = await supabase
    .from("farmers")
    .select(`
      id,
      farmer_id,
      auth_user_id,
      farm_name,
      owner_name,
      business_name,
      farmer_email,
      email,
      phone,
      pickup_delivery_option
    `)
    .eq("id", farmerId)
    .maybeSingle();

  if (error) {
    throw new Error(
      "Failed to retrieve farmer: " + error.message
    );
  }

  if (!data) {
    throw new Error(
      "Farmer not found: " + farmerId
    );
  }

  // Use farmer_email first, then email as backup.
  const notificationEmail =
    validEmail(data.farmer_email)
      ? data.farmer_email.trim()
      : validEmail(data.email)
      ? data.email.trim()
      : null;

  if (!notificationEmail) {
    throw new Error(
      "No valid farmer email address found."
    );
  }

  return {
    ...data,

    notificationEmail,

    notificationPhone:
      data.phone?.trim() || null,

    displayName:
      data.farm_name ||
      data.business_name ||
      data.owner_name ||
      "Farmer",
  };
}


// =====================================================
// ORDER EMAIL TEMPLATE
// =====================================================

function buildOrderEmail({
  farmName,
  customerName,
  orderNumber,
  items,
  fulfillmentMethod,
  orderUrl,
  isTest = false,
}) {
  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      Number(item.quantity) *
        Number(item.unitPrice),
    0
  );

  const commission = Math.round(
    subtotal * 0.04 * 100
  ) / 100;

  const estimatedPayout =
    Math.round((subtotal - commission) * 100) /
    100;

  const rows = items
    .map((item) => {
      const total =
        Number(item.quantity) *
        Number(item.unitPrice);

      return `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #ddd">
            ${escapeHtml(item.name)}
          </td>
          <td style="padding:10px;border-bottom:1px solid #ddd">
            ${Number(item.quantity)}
          </td>
          <td style="padding:10px;border-bottom:1px solid #ddd">
            ${money(total)}
          </td>
        </tr>
      `;
    })
    .join("");

  const testLabel = isTest
    ? `<p style="color:#b45309;font-weight:bold">
         TEST NOTIFICATION — NO REAL ORDER
       </p>`
    : "";

  const button = orderUrl
    ? `
      <p style="margin-top:25px">
        <a href="${escapeHtml(orderUrl)}"
           style="
             display:inline-block;
             background:#4f46e5;
             color:white;
             padding:14px 22px;
             border-radius:8px;
             text-decoration:none;
             font-weight:bold;
           ">
          View Order Breakdown
        </a>
      </p>
    `
    : `
      <p>
        Sign in to Farm2Home Direct to view
        your order breakdown.
      </p>
    `;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Farm2Home Order Notification</title>
  </head>

  <body style="
    font-family:Arial,sans-serif;
    background:#f5f6fa;
    padding:24px;
    color:#222;
  ">

    <div style="
      max-width:650px;
      margin:auto;
      background:white;
      padding:28px;
      border-radius:12px;
    ">

      <h1 style="color:#4f46e5">
        Farm2Home Direct
      </h1>

      ${testLabel}

      <h2>You Have a New Order!</h2>

      <p>Hello ${escapeHtml(farmName)},</p>

      <p>
        A customer has placed an order
        containing products from your farm.
      </p>

      <p>
        <strong>Order:</strong>
        ${escapeHtml(orderNumber)}
      </p>

      <p>
        <strong>Customer:</strong>
        ${escapeHtml(customerName)}
      </p>

      <p>
        <strong>Fulfillment:</strong>
        ${escapeHtml(fulfillmentMethod)}
      </p>

      <h3>Purchased Products</h3>

      <table style="
        width:100%;
        border-collapse:collapse;
        text-align:left;
      ">
        <thead>
          <tr>
            <th style="padding:10px">Product</th>
            <th style="padding:10px">Qty</th>
            <th style="padding:10px">Total</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>
      </table>

      <h3>Order Breakdown</h3>

      <p>
        Product Subtotal:
        <strong>${money(subtotal)}</strong>
      </p>

      <p>
        Platform Commission (4%):
        <strong>-${money(commission)}</strong>
      </p>

      <p>
        Estimated Farmer Earnings:
        <strong>${money(estimatedPayout)}</strong>
      </p>

      ${button}

      <p style="
        font-size:13px;
        color:#666;
        margin-top:30px;
      ">
        Farm2Home Direct — Supporting Local Farmers
      </p>

    </div>
  </body>
  </html>
  `;
}

// =====================================================
// SEND EMAIL THROUGH RESEND
// =====================================================

async function sendFarmerOrderEmail({
  farmerId,
  customerName,
  orderNumber,
  items,
  fulfillmentMethod,
  orderUrl,
  isTest = false,
}) {
  const farmer = await getFarmerProfile(farmerId);

  const html = buildOrderEmail({
    farmName: farmer.displayName,
    customerName,
    orderNumber,
    items,
    fulfillmentMethod,
    orderUrl,
    isTest,
  });

  const subject = isTest
    ? "TEST — Farm2Home Direct New Order"
    : "New Farm2Home Direct Order — " +
      orderNumber;

  console.log(
    "Sending order notification to:",
    farmer.notificationEmail
  );

  const { data, error } = await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: [farmer.notificationEmail],
    subject,
    html,
  });

  if (error) {
    throw new Error(
      "Resend email failed: " +
      JSON.stringify(error)
    );
  }

  if (!data?.id) {
    throw new Error(
      "Resend did not return an email ID."
    );
  }

  console.log(
    "Resend accepted email. Email ID:",
    data.id
  );

  return {
    success: true,
    emailId: data.id,
    recipient: farmer.notificationEmail,
  };
}

// =====================================================
// TEST FARMER NOTIFICATION
// =====================================================

async function testFarmerNotification(farmerId) {
  console.log(
    "Starting Farm2Home test notification..."
  );

  return await sendFarmerOrderEmail({
    farmerId,

    customerName: "Test Customer",

    orderNumber: "F2H-TEST-1001",

    fulfillmentMethod: "Pickup",

    items: [
      {
        name: "Organic Eggs",
        quantity: 2,
        unitPrice: 12.50,
      },
      {
        name: "Fresh Tomatoes",
        quantity: 2,
        unitPrice: 6.00,
      },
    ],

    // No live order exists during this test.
    // A real order URL will be provided later
    // by the authenticated order system.
    orderUrl: null,

    isTest: true,
  });
}

// =====================================================
// COMMAND LINE
// =====================================================

async function main() {
  const argument = process.argv.find((arg) =>
    arg.startsWith("--test-farmer=")
  );

  if (!argument) {
    console.log("");
    console.log("Farm2Home Direct Email Worker");
    console.log("");
    console.log("Usage:");
    console.log(
      "node notifications/email-worker.js " +
      "--test-farmer=FARMER_UUID"
    );
    console.log("");
    console.log(
      "This version sends test notifications only."
    );
    return;
  }

  const farmerId = argument
    .split("=")
    .slice(1)
    .join("=")
    .trim();

  if (!farmerId) {
    throw new Error("Farmer UUID is required.");
  }

  await testFarmerNotification(farmerId);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      "Farm2Home email worker error:",
      error.message
    );

    process.exitCode = 1;
  });
}

module.exports = {
  getFarmerProfile,
  buildOrderEmail,
  sendFarmerOrderEmail,
  testFarmerNotification,
};
