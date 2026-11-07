
"use strict";

// Farm2Home Direct - Staged Freight API
// Do not mount in production until integration testing.

const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();
router.use(express.json({ limit: "100kb" }));

const db =
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      )
    : null;

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );

const fail = (res, status, message) =>
  res.status(status).json({
    success: false,
    error: message,
  });

const isApprovedStatus = (value) =>
  ["approved", "verified", "complete", "completed"].includes(
    String(value || "").toLowerCase()
  );

async function authenticate(req, res, next) {
  try {
    if (!db) {
      return fail(res, 503, "Supabase is not configured.");
    }

    const token = /^Bearer\s+(.+)$/i.exec(
      req.headers.authorization || ""
    )?.[1];

    if (!token) {
      return fail(res, 401, "Authentication required.");
    }

    const { data, error } = await db.auth.getUser(token);

    if (error || !data?.user) {
      return fail(res, 401, "Invalid authentication token.");
    }

    req.authUser = data.user;
    return next();
  } catch (error) {
    return fail(res, 401, "Authentication failed.");
  }
}

async function getCustomer(req) {
  const { data, error } = await db
    .from("customers")
    .select("id, auth_user_id")
    .eq("auth_user_id", req.authUser.id)
    .limit(2);

  if (error) throw error;

  if (data?.length !== 1) {
    throw new Error("Customer profile not uniquely linked.");
  }

  return String(data[0].id);
}

async function getApprovedCarrier(req) {
  const { data, error } = await db
    .from("freight_users")
    .select(
      [
        "id",
        "approved",
        "account_active",
        "authority_active",
        "insurance_active",
        "licensed_livestock",
        "verification_status",
        "compliance_status",
        "admin_review_status",
        "membership_status",
      ].join(",")
    )
    .eq("auth_user_id", req.authUser.id)
    .limit(2);

  if (error) throw error;

  if (data?.length !== 1) {
    throw new Error("Carrier profile not uniquely linked.");
  }

  const carrier = data[0];

  const eligible =
    carrier.approved === true &&
    carrier.account_active === true &&
    carrier.authority_active === true &&
    carrier.insurance_active === true &&
    isApprovedStatus(carrier.verification_status) &&
    isApprovedStatus(carrier.compliance_status) &&
    isApprovedStatus(carrier.admin_review_status) &&
    ["active", "trialing"].includes(
      String(carrier.membership_status || "").toLowerCase()
    );

  if (!eligible) {
    throw new Error(
      "Carrier is not fully approved for freight quotes."
    );
  }

  return carrier;
}

// Approved carriers can view open freight requests.
// Production must add service-area matching and
// privacy controls before exposing shipment addresses.

router.get("/requests/open", authenticate, async (req, res) => {
  try {
    await getApprovedCarrier(req);

    const { data, error } = await db
      .from("marketplace_freight_requests")
      .select("id, shipment_details, created_at, status")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.json({
      success: true,
      requests: data || [],
    });
  } catch (error) {
    console.error("Freight request lookup:", error.message);
    return fail(res, 403, "Unable to access freight requests.");
  }
});

// Approved carrier submits a transportation quote.
// Carrier identity comes from the authenticated account.

router.post("/quotes", authenticate, async (req, res) => {
  try {
    const carrier = await getApprovedCarrier(req);

    const requestId = req.body?.freight_request_id;
    const rawAmount = req.body?.transportation_fee;
    const amount = Number(rawAmount);
    const amountCents = Math.round(amount * 100);
    const expiresAt = new Date(req.body?.expires_at);

    if (
      !isUuid(requestId) ||
      rawAmount === null ||
      rawAmount === undefined ||
      rawAmount === "" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1000000 ||
      !Number.isSafeInteger(amountCents) ||
      Math.abs(amount * 100 - amountCents) > 0.000001
    ) {
      return fail(res, 400, "Invalid request or quote amount.");
    }

    const now = Date.now();

    if (
      !Number.isFinite(expiresAt.getTime()) ||
      expiresAt.getTime() <= now ||
      expiresAt.getTime() > now + 30 * 86400000
    ) {
      return fail(
        res,
        400,
        "Quote expiration must be within 30 days."
      );
    }

    const { data: request, error: requestError } = await db
      .from("marketplace_freight_requests")
      .select("id, order_id, farmer_id, status, shipment_details")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) throw requestError;

    if (!request || request.status !== "open") {
      return fail(res, 409, "Freight request is not open.");
    }

    if (
      request.shipment_details?.livestock === true &&
      carrier.licensed_livestock !== true
    ) {
      return fail(
        res,
        403,
        "Livestock transportation authorization required."
      );
    }

    const { data: quote, error: quoteError } = await db
      .from("marketplace_freight_quotes")
      .insert({
        freight_request_id: request.id,
        order_id: request.order_id,
        farmer_id: request.farmer_id,
        carrier_id: String(carrier.id),
        transportation_fee: (amountCents / 100).toFixed(2),
        expires_at: expiresAt.toISOString(),
        status: "submitted",
      })
      .select(
        "id, freight_request_id, transportation_fee, status, expires_at"
      )
      .single();

    if (quoteError) throw quoteError;

    return res.status(201).json({
      success: true,
      quote,
    });
  } catch (error) {
    console.error("Freight quote submission:", error.message);
    return fail(res, 403, "Unable to submit freight quote.");
  }
});

// Customers can view quotes for their own requests.

router.get(
  "/requests/:id/quotes",
  authenticate,
  async (req, res) => {
    try {
      const customerId = await getCustomer(req);

      if (!isUuid(req.params.id)) {
        return fail(res, 400, "Invalid freight request ID.");
      }

      const { data: request, error: requestError } = await db
        .from("marketplace_freight_requests")
        .select("id, customer_id")
        .eq("id", req.params.id)
        .maybeSingle();

      if (requestError) throw requestError;

      if (
        !request ||
        String(request.customer_id) !== customerId
      ) {
        return fail(res, 404, "Freight request not found.");
      }

      const { data: quotes, error: quoteError } = await db
        .from("marketplace_freight_quotes")
        .select(
          "id, carrier_id, transportation_fee, status, expires_at"
        )
        .eq("freight_request_id", request.id)
        .in("status", ["submitted", "accepted"]);

      if (quoteError) throw quoteError;

      return res.json({
        success: true,
        quotes: (quotes || []).filter(
          (quote) => new Date(quote.expires_at) > new Date()
        ),
      });
    } catch (error) {
      console.error("Customer freight quotes:", error.message);
      return fail(res, 403, "Unable to access freight quotes.");
    }
  }
);

// Quote acceptance and payment are intentionally disabled.
// Both require atomic database validation and settlement logic.

// ============================================================
// STAGE 10 - Customer accepts an approved freight quote
// ============================================================

router.post(
  "/requests/:id/accept-quote",
  authenticate,
  async (req, res) => {
    try {
      // Verify that the caller has a linked customer profile.
      await getCustomer(req);

      const requestId = req.params.id;
      const quoteId = req.body?.quote_id;

      if (!isUuid(requestId) || !isUuid(quoteId)) {
        return fail(
          res,
          400,
          "Valid freight request and quote IDs are required."
        );
      }

      // The customer authentication ID comes from the verified
      // Supabase access token, never from the request body.
      const { data, error } = await db.rpc(
        "accept_marketplace_freight_quote",
        {
          p_request_id: requestId,
          p_quote_id: quoteId,
          p_customer_auth_id: req.authUser.id,
        }
      );

      if (error) {
        console.error("Freight acceptance:", error.message);

        return fail(
          res,
          409,
          "Unable to accept this freight quote. Check its availability and carrier eligibility."
        );
      }

      return res.json({
        success: true,
        message: "Freight transportation quote accepted.",
        acceptance: data,
      });
    } catch (error) {
      console.error("Customer quote acceptance:", error.message);

      return fail(
        res,
        403,
        "Customer authorization failed."
      );
    }
  }
);

/**
 * STAGE 14 - Freight cart preflight
 * Validates product identity and freight eligibility.
 * Does NOT create orders, accept payments, or reserve stock.
 */

router.post("/preflight", authenticate, async (req, res) => {
  try {
    await getCustomer(req);

    const items = req.body?.items;

    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      return fail(res, 400, "A valid cart is required.");
    }

    const requested = new Map();

    for (const item of items) {
      const productId = item?.product_id;
      const quantity = item?.quantity;

      if (
        !isUuid(productId) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 10000 ||
        requested.has(productId)
      ) {
        return fail(res, 400, "Invalid or duplicate cart item.");
      }

      requested.set(productId, quantity);
    }

    const { data: products, error: productError } = await db
      .from("farm_products")
      .select(
        "id, farmer_id, name, product_name, active, status, requires_freight"
      )
      .in("id", [...requested.keys()]);

    if (productError) throw productError;

    if (!products || products.length !== requested.size) {
      return fail(res, 400, "One or more products were not found.");
    }

    const freightFarmerIds = new Set();
    const verifiedItems = [];

    for (const product of products) {
      if (!product.farmer_id || !isUuid(product.farmer_id)) {
        return fail(res, 400, "Product has no valid farmer.");
      }

      if (product.active === false) {
        return fail(res, 409, "A product is inactive.");
      }

      if (product.requires_freight === true) {
        freightFarmerIds.add(product.farmer_id);
      }

      verifiedItems.push({
        product_id: product.id,
        farmer_id: product.farmer_id,
        name: product.product_name || product.name,
        quantity: requested.get(product.id),
        requires_freight: product.requires_freight === true,
      });
    }

    const freightFarmers = [];

    if (freightFarmerIds.size > 0) {
      const { data: farmers, error: farmerError } = await db
        .from("farmers")
        .select("id, freight_enabled, freight_handling_fee")
        .in("id", [...freightFarmerIds]);

      if (farmerError) throw farmerError;

      if (!farmers || farmers.length !== freightFarmerIds.size) {
        return fail(res, 409, "A freight farmer could not be verified.");
      }

      for (const farmer of farmers) {
        if (farmer.freight_enabled !== true) {
          return fail(
            res,
            409,
            "Freight transportation is unavailable for a selected farmer."
          );
        }

        freightFarmers.push({
          farmer_id: farmer.id,
          freight_handling_fee: farmer.freight_handling_fee,
        });
      }
    }

    return res.json({
      success: true,
      requires_freight: freightFarmerIds.size > 0,
      items: verifiedItems,
      freight_farmers: freightFarmers,
      message: "Freight eligibility preflight completed.",
    });
  } catch (error) {
    console.error("Freight preflight:", error.message);
    return fail(res, 500, "Unable to validate freight cart.");
  }
});


module.exports = router;
