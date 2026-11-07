
'use strict';

// Farm2Home Direct â€” Vendor Manager Portal
// STAGING ONLY â€” No Stripe billing.
// Do not mount until authentication and database tests pass.

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const db = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validId = (v) =>
  typeof v === 'string' && UUID.test(v);

const error = (res, code, message) =>
  res.status(code).json({
    success: false,
    error: message
  });

const safe = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    console.error('[vendor-manager]', e.message);

    if (!res.headersSent) {
      error(res, 500, 'Request could not be completed.');
    }
  }
};

function money(v) {
  if (typeof v !== 'number' && typeof v !== 'string') {
    return null;
  }

  if (
    typeof v === 'string' &&
    !/^\d+(?:\.\d{1,2})?$/.test(v)
  ) {
    return null;
  }

  const n = Number(v);

  if (
    !Number.isFinite(n) ||
    n < 0 ||
    n > 100000 ||
    Math.abs(Math.round(n * 100) - n * 100) > 1e-7
  ) {
    return null;
  }

  return Number(n.toFixed(2));
}

function shortText(v, max = 200) {
  return typeof v === 'string'
    ? v.trim().slice(0, max)
    : '';
}

// Authenticate using the customer's or manager's
// actual Supabase access token.

async function auth(req, res, next) {
  try {
    const token =
      /^Bearer\s+(.+)$/i.exec(
        req.headers.authorization || ''
      )?.[1];

    if (!token) {
      return error(res, 401, 'Authentication required.');
    }

    const { data, error: authError } =
      await db.auth.getUser(token);

    if (authError || !data?.user?.id) {
      return error(res, 401, 'Invalid session.');
    }

    req.authUserId = data.user.id;
    return next();
  } catch (e) {
    console.error('[vendor-manager auth]', e.message);
    return error(res, 401, 'Authentication failed.');
  }
}

router.use(auth);

// Verify manager ownership of a market.

async function ownedMarket(
  req,
  res,
  id,
  requireApproved = true
) {
  if (!validId(id)) {
    error(res, 400, 'Invalid market ID.');
    return null;
  }

  const { data, error: e } = await db
    .from('farmers_markets')
    .select(
      'id,name,manager_user_id,status,' +
      'standard_monthly_fee,vendor_capacity'
    )
    .eq('id', id)
    .eq('manager_user_id', req.authUserId)
    .maybeSingle();

  if (e) throw e;

  if (!data) {
    error(res, 404, 'Market not found.');
    return null;
  }

  if (
    requireApproved &&
    data.status !== 'approved'
  ) {
    error(
      res,
      403,
      'Market must be approved and active.'
    );
    return null;
  }

  return data;
}

// Find farmer account from verified Supabase identity.

async function farmerForAuth(req, res) {
  const { data, error: e } = await db
    .from('farmers')
    .select('id,auth_user_id')
    .eq('auth_user_id', req.authUserId)
    .maybeSingle();

  if (e) throw e;

  if (!data) {
    error(res, 403, 'Farmer account not found.');
    return null;
  }

  return data;
}

// --------------------------------------------------
// 1. CREATE FARMERS MARKET
// POST /vendor-manager/markets
// --------------------------------------------------

router.post('/markets', safe(async (req, res) => {
  const name = shortText(req.body?.name, 120);
  const fee = money(req.body?.standard_monthly_fee);

  if (!name || fee === null) {
    return error(
      res,
      400,
      'Name and valid monthly fee required.'
    );
  }

  const payload = {
    name,
    description: shortText(req.body?.description, 2000),
    manager_user_id: req.authUserId,
    address: shortText(req.body?.address),
    city: shortText(req.body?.city, 100),
    state: shortText(req.body?.state, 50),
    zip_code: shortText(req.body?.zip_code, 20),
    standard_monthly_fee: fee,
    status: 'pending'
  };

  const { data, error: e } = await db
    .from('farmers_markets')
    .insert(payload)
    .select('id,name,status,standard_monthly_fee')
    .single();

  if (e) throw e;

  return res.status(201).json({
    success: true,
    market: data,
    message: 'Market submitted for approval.'
  });
}));

// --------------------------------------------------
// 2. GET MANAGER'S MARKETS
// GET /vendor-manager/markets
// --------------------------------------------------

router.get('/markets', safe(async (req, res) => {
  const { data, error: e } = await db
    .from('farmers_markets')
    .select(
      'id,name,description,address,city,state,' +
      'zip_code,status,standard_monthly_fee,' +
      'vendor_capacity,created_at'
    )
    .eq('manager_user_id', req.authUserId)
    .order('created_at', { ascending: false });

  if (e) throw e;

  return res.json({
    success: true,
    markets: data || []
  });
}));

// --------------------------------------------------
// 3. UPDATE MARKET
// PATCH /vendor-manager/markets/:marketId
// --------------------------------------------------

router.patch(
  '/markets/:marketId',
  safe(async (req, res) => {
    const market = await ownedMarket(
      req,
      res,
      req.params.marketId
    );

    if (!market) return;

    const updates = {};

    if (
      Object.hasOwn(
        req.body || {},
        'standard_monthly_fee'
      )
    ) {
      const fee = money(
        req.body.standard_monthly_fee
      );

      if (fee === null) {
        return error(res, 400, 'Invalid monthly fee.');
      }

      updates.standard_monthly_fee = fee;
    }

    for (const field of [
      'name',
      'description',
      'address',
      'city',
      'state',
      'zip_code'
    ]) {
      if (Object.hasOwn(req.body || {}, field)) {
        updates[field] = shortText(
          req.body[field],
          field === 'description' ? 2000 : 200
        );
      }
    }

    if (!Object.keys(updates).length) {
      return error(res, 400, 'No supported changes.');
    }

    if (updates.name === '') {
      return error(
        res,
        400,
        'Market name cannot be empty.'
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error: e } = await db
      .from('farmers_markets')
      .update(updates)
      .eq('id', market.id)
      .eq('manager_user_id', req.authUserId)
      .select('id,name,status,standard_monthly_fee')
      .single();

    if (e) throw e;

    return res.json({
      success: true,
      market: data
    });
  })
);

// --------------------------------------------------
// 4. INVITE FARMER
// POST /vendor-manager/markets/:marketId/invitations
// --------------------------------------------------

router.post(
  '/markets/:marketId/invitations',
  safe(async (req, res) => {
    const market = await ownedMarket(
      req,
      res,
      req.params.marketId
    );

    if (!market) return;

    const farmerId = req.body?.farmer_id;

    if (!validId(farmerId)) {
      return error(
        res,
        400,
        'Valid farmer_id required.'
      );
    }

    const { data: farmer, error: fe } = await db
      .from('farmers')
      .select('id,auth_user_id')
      .eq('id', farmerId)
      .maybeSingle();

    if (fe) throw fe;

    if (!farmer?.auth_user_id) {
      return error(
        res,
        404,
        'Linked farmer account not found.'
      );
    }

    const { count, error: ce } = await db
      .from('market_vendor_memberships')
      .select('id', {
        count: 'exact',
        head: true
      })
      .eq('market_id', market.id)
      .in('status', ['invited', 'active']);

    if (ce) throw ce;

    if (count >= market.vendor_capacity) {
      return error(
        res,
        409,
        'Market capacity reached.'
      );
    }

    const { data: existing, error: ee } = await db
      .from('market_vendor_memberships')
      .select('id,status')
      .eq('market_id', market.id)
      .eq('farmer_id', farmerId)
      .maybeSingle();

    if (ee) throw ee;

    if (existing) {
      return error(
        res,
        409,
        'Membership already exists; use an explicit re-invitation workflow.'
      );
    }

    const { data, error: e } = await db
      .from('market_vendor_memberships')
      .insert({
        market_id: market.id,
        farmer_id: farmerId,
        status: 'invited'
      })
      .select(
        'id,market_id,farmer_id,status,invited_at'
      )
      .single();

    if (e) {
      if (e.code === '23505') {
        return error(
          res,
          409,
          'Membership already exists.'
        );
      }

      throw e;
    }

    return res.status(201).json({
      success: true,
      membership: data
    });
  })
);

// --------------------------------------------------
// 5. VIEW MARKET MEMBERSHIPS
// GET /vendor-manager/markets/:marketId/memberships
// --------------------------------------------------

router.get(
  '/markets/:marketId/memberships',
  safe(async (req, res) => {
    const market = await ownedMarket(
      req,
      res,
      req.params.marketId
    );

    if (!market) return;

    const { data, error: e } = await db
      .from('market_vendor_memberships')
      .select(
        'id,farmer_id,status,custom_monthly_fee,' +
        'custom_fee_approved_at,invited_at,accepted_at'
      )
      .eq('market_id', market.id)
      .order('invited_at', { ascending: false });

    if (e) throw e;

    return res.json({
      success: true,
      standard_monthly_fee:
        market.standard_monthly_fee,
      memberships: (data || []).map((m) => ({
        ...m,
        effective_monthly_fee:
          m.custom_monthly_fee === null
            ? market.standard_monthly_fee
            : m.custom_monthly_fee
      }))
    });
  })
);

// --------------------------------------------------
// 6. APPROVE CUSTOM FARMER MONTHLY FEE
// PATCH /vendor-manager/markets/:marketId/
// memberships/:membershipId/fee
// --------------------------------------------------

router.patch(
  '/markets/:marketId/memberships/:membershipId/fee',
  safe(async (req, res) => {
    const market = await ownedMarket(
      req,
      res,
      req.params.marketId
    );

    if (!market) return;

    if (!validId(req.params.membershipId)) {
      return error(
        res,
        400,
        'Invalid membership ID.'
      );
    }

    if (
      !Object.hasOwn(
        req.body || {},
        'custom_monthly_fee'
      )
    ) {
      return error(
        res,
        400,
        'custom_monthly_fee is required (null removes override).'
      );
    }

    const fee =
      req.body.custom_monthly_fee === null
        ? null
        : money(req.body.custom_monthly_fee);

    if (
      fee === null &&
      req.body.custom_monthly_fee !== null
    ) {
      return error(
        res,
        400,
        'Invalid custom fee.'
      );
    }

    const { data: current, error: ce } = await db
      .from('market_vendor_memberships')
      .select('id,status')
      .eq('id', req.params.membershipId)
      .eq('market_id', market.id)
      .maybeSingle();

    if (ce) throw ce;

    if (
      !current ||
      !['invited', 'active'].includes(current.status)
    ) {
      return error(
        res,
        404,
        'Eligible membership not found.'
      );
    }

    const changes = {
      custom_monthly_fee: fee,
      custom_fee_approved_by:
        fee === null ? null : req.authUserId,
      custom_fee_approved_at:
        fee === null
          ? null
          : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error: e } = await db
      .from('market_vendor_memberships')
      .update(changes)
      .eq('id', current.id)
      .eq('market_id', market.id)
      .select(
        'id,status,custom_monthly_fee,' +
        'custom_fee_approved_at'
      )
      .single();

    if (e) throw e;

    return res.json({
      success: true,
      membership: data,
      billing_active: false,
      notice:
        'Fee recorded only. Farmer consent is required before any recurring billing or fee increase.'
    });
  })
);

// --------------------------------------------------
// 7. FARMER VIEWS MARKET INVITATIONS
// GET /vendor-manager/farmer/invitations
// --------------------------------------------------

router.get(
  '/farmer/invitations',
  safe(async (req, res) => {
    const farmer = await farmerForAuth(req, res);

    if (!farmer) return;

    const { data, error: e } = await db
      .from('market_vendor_memberships')
      .select(
        'id,market_id,status,custom_monthly_fee,' +
        'invited_at,accepted_at'
      )
      .eq('farmer_id', farmer.id)
      .order('invited_at', { ascending: false });

    if (e) throw e;

    const ids = [
      ...new Set(
        (data || []).map((m) => m.market_id)
      )
    ];

    const { data: markets, error: me } =
      ids.length
        ? await db
            .from('farmers_markets')
            .select(
              'id,name,status,standard_monthly_fee'
            )
            .in('id', ids)
        : { data: [], error: null };

    if (me) throw me;

    const byId = new Map(
      (markets || []).map((m) => [m.id, m])
    );

    return res.json({
      success: true,
      memberships: (data || []).map((m) => ({
        ...m,
        market: byId.get(m.market_id) || null,
        effective_monthly_fee:
          m.custom_monthly_fee === null
            ? (
                byId.get(m.market_id)
                  ?.standard_monthly_fee ?? null
              )
            : m.custom_monthly_fee
      }))
    });
  })
);

// --------------------------------------------------
// 8. FARMER ACCEPTS OR DECLINES INVITATION
// POST /vendor-manager/farmer/invitations/
// :membershipId/respond
// --------------------------------------------------

router.post(
  '/farmer/invitations/:membershipId/respond',
  safe(async (req, res) => {
    const farmer = await farmerForAuth(req, res);

    if (!farmer) return;

    if (!validId(req.params.membershipId)) {
      return error(
        res,
        400,
        'Invalid membership ID.'
      );
    }

    if (
      !['accept', 'decline'].includes(
        req.body?.decision
      )
    ) {
      return error(
        res,
        400,
        'decision must be accept or decline.'
      );
    }

    const { data: membership, error: e } =
      await db
        .from('market_vendor_memberships')
        .select('id,market_id,status')
        .eq('id', req.params.membershipId)
        .eq('farmer_id', farmer.id)
        .maybeSingle();

    if (e) throw e;

    if (
      !membership ||
      membership.status !== 'invited'
    ) {
      return error(
        res,
        409,
        'Pending invitation not found.'
      );
    }

    const { data: market, error: me } = await db
      .from('farmers_markets')
      .select('id,status')
      .eq('id', membership.market_id)
      .maybeSingle();

    if (me) throw me;

    if (!market || market.status !== 'approved') {
      return error(
        res,
        403,
        'Market is not active.'
      );
    }

    const now = new Date().toISOString();

    const { data, error: ue } = await db
      .from('market_vendor_memberships')
      .update({
        status:
          req.body.decision === 'accept'
            ? 'active'
            : 'declined',
        accepted_at:
          req.body.decision === 'accept'
            ? now
            : null,
        updated_at: now
      })
      .eq('id', membership.id)
      .eq('farmer_id', farmer.id)
      .eq('status', 'invited')
      .select(
        'id,market_id,farmer_id,status,accepted_at'
      )
      .maybeSingle();

    if (ue) throw ue;

    if (!data) {
      return error(
        res,
        409,
        'Invitation was already processed.'
      );
    }

    return res.json({
      success: true,
      membership: data,
      billing_active: false
    });
  })
);

module.exports = router;


