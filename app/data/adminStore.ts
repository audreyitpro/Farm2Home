import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./supabaseClient";
import { getFarmerById, updateFarmerStore } from "./farmerStore";

export type VerificationStatus =
  | "STARTED"
  | "DOCUMENTS_REQUIRED"
  | "DOCUMENTS_IN_PROGRESS"
  | "DOCUMENTS_SUBMITTED"
  | "PENDING_VERIFICATION"
  | "PENDING_ADMIN_REVIEW"
  | "STRIPE_STARTED"
  | "STRIPE_PENDING"
  | "STRIPE_RETURNED"
  | "STRIPE_CONNECTED_PENDING_REVIEW"
  | "STRIPE_COMPLETE_PENDING_REVIEW"
  | "DELIVERY_OPTION_SAVED"
  | "LEGAL_ACCEPTED"
  | "APPROVED"
  | "REJECTED"
  | "MORE_INFO_REQUIRED"
  | "SUSPENDED";

export type DocumentReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type BusinessDocument = {
  id: string;
  name: string;
  type: string;
  uri: string;
  uploadedAt: string;
  status: DocumentReviewStatus;
  adminNote?: string;
};

export type AdminReviewNote = {
  id: string;
  note: string;
  createdAt: string;
  createdBy: string;
};

export type VerificationRecord = {
  id: string;
  accountType: "FARMER" | "FREIGHT_CARRIER";
  farmerId?: string;
  carrierId?: string;
  businessName: string;
  farmName?: string;
  companyName?: string;
  ownerName: string;
  email: string;
  phone?: string;
  businessAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  status: VerificationStatus;
  complianceStatus?: string;
  adminReviewStatus?: string;
  reviewDecision?: string;
  approved?: boolean;
  rejected?: boolean;
  needsMoreInfo?: boolean;
  reviewed?: boolean;
  accountActive?: boolean;
  complianceSubmitted?: boolean;
  documents: BusinessDocument[];
  adminNotes: AdminReviewNote[];
  stripeAccountId?: string;
  farmerStripeAccountId?: string;
  stripePayoutsEnabled?: boolean;
  stripeChargesEnabled?: boolean;
  stripeOnboardingComplete?: boolean;
  pickupDeliveryOption?: string;
  uploadedDocs?: Record<string, string>;
  legalChecks?: Record<string, any>;
  farmerMembershipPaid?: boolean;
  applicationFeePaid?: boolean;
  farmerActivationPaid?: boolean;
  farmerMonthlySubscriptionPaid?: boolean;
  submittedAt: string;
  updatedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  moreInfoRequestedAt?: string;
};

const VERIFICATION_QUEUE_KEY = "farm2homeVerificationQueue";
const ADMIN_SESSION_KEY = "farm2homeAdminSession";

export const ADMIN_EMAIL = "audreyitprofessional@gmail.com";
export const ADMIN_PASSCODE = "Farm2HomeAdmin2026";
export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = "admin123";

function now() {
  return new Date().toISOString();
}

function normalizeStatus(status: any): VerificationStatus {
  const value = String(status || "PENDING_VERIFICATION").toUpperCase();

  const allowed: VerificationStatus[] = [
    "STARTED",
    "DOCUMENTS_REQUIRED",
    "DOCUMENTS_IN_PROGRESS",
    "DOCUMENTS_SUBMITTED",
    "PENDING_VERIFICATION",
    "PENDING_ADMIN_REVIEW",
    "STRIPE_STARTED",
    "STRIPE_PENDING",
    "STRIPE_RETURNED",
    "STRIPE_CONNECTED_PENDING_REVIEW",
    "STRIPE_COMPLETE_PENDING_REVIEW",
    "DELIVERY_OPTION_SAVED",
    "LEGAL_ACCEPTED",
    "APPROVED",
    "REJECTED",
    "MORE_INFO_REQUIRED",
    "SUSPENDED",
  ];

  return allowed.includes(value as VerificationStatus)
    ? (value as VerificationStatus)
    : "PENDING_VERIFICATION";
}

function normalizeRecord(record: Partial<VerificationRecord>): VerificationRecord {
  const id = String(
    record.id || record.farmerId || record.carrierId || `vr_${Date.now()}`
  );

  const accountType =
    record.accountType === "FREIGHT_CARRIER" ? "FREIGHT_CARRIER" : "FARMER";

  const businessName =
    record.businessName ||
    record.farmName ||
    record.companyName ||
    "Farm2Home Business";

  return {
    id,
    accountType,
    farmerId: record.farmerId || (accountType === "FARMER" ? id : undefined),
    carrierId:
      record.carrierId || (accountType === "FREIGHT_CARRIER" ? id : undefined),
    businessName,
    farmName:
      record.farmName || (accountType === "FARMER" ? businessName : undefined),
    companyName:
      record.companyName ||
      (accountType === "FREIGHT_CARRIER" ? businessName : undefined),
    ownerName: record.ownerName || "",
    email: record.email || "",
    phone: record.phone || "",
    businessAddress: record.businessAddress || "",
    city: record.city || "",
    state: record.state || "",
    zipCode: record.zipCode || "",
    status: normalizeStatus(record.status),
    complianceStatus: record.complianceStatus || String(record.status || ""),
    adminReviewStatus: record.adminReviewStatus || "",
    reviewDecision: record.reviewDecision || "",
    approved: Boolean(record.approved),
    rejected: Boolean(record.rejected),
    needsMoreInfo: Boolean(record.needsMoreInfo),
    reviewed: Boolean(record.reviewed),
    accountActive: Boolean(record.accountActive),
    complianceSubmitted: Boolean(record.complianceSubmitted),
    documents: Array.isArray(record.documents) ? record.documents : [],
    adminNotes: Array.isArray(record.adminNotes) ? record.adminNotes : [],
    stripeAccountId: record.stripeAccountId || "",
    farmerStripeAccountId:
      record.farmerStripeAccountId || record.stripeAccountId || "",
    stripePayoutsEnabled: Boolean(record.stripePayoutsEnabled),
    stripeChargesEnabled: Boolean(record.stripeChargesEnabled),
    stripeOnboardingComplete: Boolean(record.stripeOnboardingComplete),
    pickupDeliveryOption: record.pickupDeliveryOption || "",
    uploadedDocs: record.uploadedDocs || {},
    legalChecks: record.legalChecks || {},
    farmerMembershipPaid: Boolean(record.farmerMembershipPaid),
    applicationFeePaid: Boolean(record.applicationFeePaid),
    farmerActivationPaid: Boolean(record.farmerActivationPaid),
    farmerMonthlySubscriptionPaid: Boolean(record.farmerMonthlySubscriptionPaid),
    submittedAt: record.submittedAt || now(),
    updatedAt: record.updatedAt || now(),
    approvedAt: record.approvedAt,
    rejectedAt: record.rejectedAt,
    moreInfoRequestedAt: record.moreInfoRequestedAt,
  };
}

function mapSupabaseRowToRecord(row: any): VerificationRecord {
  const docsFromJson =
    Array.isArray(row.documents) && row.documents.length > 0
      ? row.documents
      : [];

  const docsFromUploaded = Object.entries(row.uploaded_docs || {}).map(
    ([type, uri], index) => ({
      id: `${row.id}_${type}_${index}`,
      name: String(type).replace(/_/g, " "),
      type,
      uri: String(uri),
      uploadedAt: row.submitted_at || row.created_at || now(),
      status: "PENDING" as DocumentReviewStatus,
    })
  );

  return normalizeRecord({
    id: row.id,
    farmerId: row.farmer_id || row.id,
    accountType: row.account_type || "FARMER",
    businessName: row.business_name || row.farm_name || "",
    farmName: row.farm_name || row.business_name || "",
    companyName: row.company_name || "",
    ownerName: row.owner_name || "",
    email: row.email || "",
    phone: row.phone || "",
    state: row.state || "",
    status: row.status || "PENDING_ADMIN_REVIEW",
    complianceStatus: row.compliance_status || "pending_admin_review",
    adminReviewStatus: row.admin_review_status || "pending",
    reviewDecision: row.review_decision || "pending",
    approved: Boolean(row.approved),
    rejected: Boolean(row.rejected),
    needsMoreInfo: Boolean(row.needs_more_info),
    reviewed: Boolean(row.reviewed),
    accountActive: Boolean(row.account_active),
    complianceSubmitted: Boolean(row.compliance_submitted),
    farmerMembershipPaid: Boolean(row.farmer_membership_paid),
    applicationFeePaid: Boolean(row.application_fee_paid),
    farmerActivationPaid: Boolean(row.farmer_activation_paid),
    farmerMonthlySubscriptionPaid: Boolean(row.farmer_monthly_subscription_paid),
    stripeAccountId: row.stripe_account_id || "",
    farmerStripeAccountId:
      row.farmer_stripe_account_id || row.stripe_account_id || "",
    stripePayoutsEnabled: Boolean(row.stripe_payouts_enabled),
    stripeChargesEnabled: Boolean(row.stripe_charges_enabled),
    stripeOnboardingComplete: Boolean(row.stripe_onboarding_complete),
    pickupDeliveryOption: row.pickup_delivery_option || "",
    uploadedDocs: row.uploaded_docs || {},
    legalChecks: row.legal_checks || {},
    documents: docsFromJson.length > 0 ? docsFromJson : docsFromUploaded,
    adminNotes: row.admin_notes || [],
    submittedAt: row.submitted_at || row.created_at || now(),
    updatedAt: row.updated_at || now(),
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    moreInfoRequestedAt: row.more_info_requested_at,
  } as any);
}

function recordToSupabasePayload(record: Partial<VerificationRecord>) {
  const normalized = normalizeRecord(record);
  const docs = normalized.documents || [];

  return {
    id: normalized.id,
    farmer_id: normalized.farmerId || normalized.id,
    account_type: normalized.accountType,
    role: normalized.accountType === "FARMER" ? "farmer" : "freight",
    business_name: normalized.businessName,
    farm_name: normalized.farmName || normalized.businessName,
    owner_name: normalized.ownerName,
    email: normalized.email,
    phone: normalized.phone || "",
    state: normalized.state || "",
    status: normalized.status,
    compliance_status: normalized.complianceStatus || "",
    admin_review_status: normalized.adminReviewStatus || "",
    review_decision: normalized.reviewDecision || "",
    approved: Boolean(normalized.approved),
    rejected: Boolean(normalized.rejected),
    needs_more_info: Boolean(normalized.needsMoreInfo),
    reviewed: Boolean(normalized.reviewed),
    account_active: Boolean(normalized.accountActive),
    compliance_submitted: Boolean(normalized.complianceSubmitted),
    farmer_membership_paid: Boolean(normalized.farmerMembershipPaid),
    application_fee_paid: Boolean(normalized.applicationFeePaid),
    farmer_activation_paid: Boolean(normalized.farmerActivationPaid),
    farmer_monthly_subscription_paid: Boolean(
      normalized.farmerMonthlySubscriptionPaid
    ),
    stripe_account_id: normalized.stripeAccountId || "",
    farmer_stripe_account_id:
      normalized.farmerStripeAccountId || normalized.stripeAccountId || "",
    stripe_payouts_enabled: Boolean(normalized.stripePayoutsEnabled),
    stripe_charges_enabled: Boolean(normalized.stripeChargesEnabled),
    stripe_onboarding_complete: Boolean(normalized.stripeOnboardingComplete),
    pickup_delivery_option: normalized.pickupDeliveryOption || "",
    uploaded_docs: normalized.uploadedDocs || {},
    legal_checks: normalized.legalChecks || {},
    documents: docs,
    admin_notes: normalized.adminNotes || [],
    submitted_at: normalized.submittedAt,
    updated_at: normalized.updatedAt || now(),
  };
}

async function updateFarmerApprovalInSupabase(
  farmerId: string,
  payload: Record<string, any>
) {
  if (!farmerId) return;

  const { error } = await supabase
    .from("farmers")
    .update({
      ...payload,
      updated_at: now(),
    })
    .eq("id", farmerId);

  if (error) {
    console.log("Supabase farmers approval update error:", error.message);
  }
}

export async function getVerificationQueue(): Promise<VerificationRecord[]> {
  try {
    const { data, error } = await supabase
      .from("admin_verifications")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.map(mapSupabaseRowToRecord);
    }

    if (error) {
      console.log("Supabase verification queue fallback:", error.message);
    }

    const raw = await AsyncStorage.getItem(VERIFICATION_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed.map((record) => normalizeRecord(record));
  } catch (error) {
    console.log("Error loading verification queue", error);
    return [];
  }
}

export async function saveVerificationQueue(records: VerificationRecord[]) {
  const normalized = records.map((record) => normalizeRecord(record));
  await AsyncStorage.setItem(VERIFICATION_QUEUE_KEY, JSON.stringify(normalized));
}

export async function upsertVerificationRecord(
  record: Partial<VerificationRecord>
) {
  const normalizedIncoming = normalizeRecord(record);

  try {
    const { error } = await supabase
      .from("admin_verifications")
      .upsert(recordToSupabasePayload(normalizedIncoming));

    if (error) {
      console.log("Supabase upsertVerificationRecord error:", error.message);
    }
  } catch (error) {
    console.log("Supabase upsertVerificationRecord failed:", error);
  }

  const records = await getVerificationQueue();

  const existingIndex = records.findIndex(
    (item) =>
      item.id === normalizedIncoming.id ||
      (normalizedIncoming.farmerId &&
        item.farmerId === normalizedIncoming.farmerId) ||
      (normalizedIncoming.carrierId &&
        item.carrierId === normalizedIncoming.carrierId)
  );

  const updatedRecord: VerificationRecord = {
    ...(existingIndex >= 0 ? records[existingIndex] : {}),
    ...normalizedIncoming,
    documents:
      normalizedIncoming.documents.length > 0
        ? normalizedIncoming.documents
        : existingIndex >= 0
        ? records[existingIndex].documents || []
        : [],
    adminNotes:
      normalizedIncoming.adminNotes.length > 0
        ? normalizedIncoming.adminNotes
        : existingIndex >= 0
        ? records[existingIndex].adminNotes || []
        : [],
    submittedAt:
      existingIndex >= 0
        ? records[existingIndex].submittedAt
        : normalizedIncoming.submittedAt,
    updatedAt: now(),
  };

  if (existingIndex >= 0) {
    records[existingIndex] = updatedRecord;
  } else {
    records.unshift(updatedRecord);
  }

  await saveVerificationQueue(records);
  return updatedRecord;
}

export async function getVerificationRecordById(
  id: string
): Promise<VerificationRecord | null> {
  const records = await getVerificationQueue();

  return (
    records.find(
      (item) => item.id === id || item.farmerId === id || item.carrierId === id
    ) || null
  );
}

export async function getPendingVerificationRecords() {
  const records = await getVerificationQueue();

  return records.filter((item) =>
    [
      "STARTED",
      "DOCUMENTS_REQUIRED",
      "DOCUMENTS_IN_PROGRESS",
      "DOCUMENTS_SUBMITTED",
      "PENDING_VERIFICATION",
      "PENDING_ADMIN_REVIEW",
      "STRIPE_STARTED",
      "STRIPE_PENDING",
      "STRIPE_RETURNED",
      "STRIPE_CONNECTED_PENDING_REVIEW",
      "STRIPE_COMPLETE_PENDING_REVIEW",
      "DELIVERY_OPTION_SAVED",
      "LEGAL_ACCEPTED",
      "MORE_INFO_REQUIRED",
    ].includes(item.status)
  );
}

async function updateSupabaseReviewStatus(
  record: VerificationRecord,
  status: VerificationStatus,
  note?: string,
  adminEmail = ADMIN_EMAIL
) {
  const timestamp = now();

  const notes = [
    {
      id: `note_${Date.now()}`,
      note:
        note ||
        (status === "APPROVED"
          ? "Approved by admin."
          : status === "REJECTED"
          ? "Rejected by admin."
          : "More information requested."),
      createdAt: timestamp,
      createdBy: adminEmail,
    },
    ...(record.adminNotes || []),
  ];

  const payload: any = {
    status,
    reviewed: true,
    updated_at: timestamp,
    admin_notes: notes,
    admin_review_status:
      status === "APPROVED"
        ? "approved"
        : status === "REJECTED"
        ? "rejected"
        : "needs_more_info",
    review_decision:
      status === "APPROVED"
        ? "approved"
        : status === "REJECTED"
        ? "rejected"
        : "needs_more_info",
    compliance_status:
      status === "APPROVED"
        ? "approved"
        : status === "REJECTED"
        ? "rejected"
        : "needs_more_info",
    approved: status === "APPROVED",
    rejected: status === "REJECTED",
    needs_more_info: status === "MORE_INFO_REQUIRED",
    account_active: status === "APPROVED",
  };

  if (status === "APPROVED") payload.approved_at = timestamp;
  if (status === "REJECTED") payload.rejected_at = timestamp;
  if (status === "MORE_INFO_REQUIRED")
    payload.more_info_requested_at = timestamp;

  const { error } = await supabase
    .from("admin_verifications")
    .update(payload)
    .or(`id.eq.${record.id},farmer_id.eq.${record.farmerId || record.id}`);

  if (error) {
    console.log("Supabase admin review status update error:", error.message);
  }
}

export async function approveVerificationRecord(
  id: string,
  adminEmail = ADMIN_EMAIL
) {
  const records = await getVerificationQueue();

  let approvedRecord: VerificationRecord | undefined;

  const updated = records.map((record) => {
    if (record.id !== id && record.farmerId !== id && record.carrierId !== id) {
      return record;
    }

    approvedRecord = {
      ...record,
      status: "APPROVED" as VerificationStatus,
      complianceStatus: "approved",
      adminReviewStatus: "approved",
      reviewDecision: "approved",
      approved: true,
      rejected: false,
      needsMoreInfo: false,
      reviewed: true,
      accountActive: true,
      approvedAt: now(),
      updatedAt: now(),
      adminNotes: [
        {
          id: `note_${Date.now()}`,
          note: "Approved by admin.",
          createdAt: now(),
          createdBy: adminEmail,
        },
        ...(record.adminNotes || []),
      ],
    };

    return approvedRecord;
  });

  await saveVerificationQueue(updated);

  if (approvedRecord) {
    const activeFarmerId = approvedRecord.farmerId || approvedRecord.id;

    await updateSupabaseReviewStatus(
      approvedRecord,
      "APPROVED",
      undefined,
      adminEmail
    );

    if (approvedRecord.accountType === "FARMER") {
      await updateFarmerApprovalInSupabase(activeFarmerId, {
        approved: true,
        account_active: false,
        compliance_status: "approved",
        admin_review_status: "approved",
        review_decision: "approved",
        farmer_activation_paid: false,
        farmer_monthly_subscription_paid: false,
        approved_at: now(),
      });

      const existingFarmer = await getFarmerById(activeFarmerId);

      if (existingFarmer) {
        await updateFarmerStore(activeFarmerId, {
          approved: true,
          accountActive: false,
          complianceStatus: "approved",
          adminReviewStatus: "approved",
          reviewDecision: "approved",
          farmerActivationPaid: false,
          farmerMonthlySubscriptionPaid: false,
          approvedAt: now(),
        } as any);
      }
    }
  }

  return updated;
}

export async function rejectVerificationRecord(
  id: string,
  reason: string,
  adminEmail = ADMIN_EMAIL
) {
  const records = await getVerificationQueue();

  let rejectedRecord: VerificationRecord | undefined;

  const updated = records.map((record) => {
    if (record.id !== id && record.farmerId !== id && record.carrierId !== id) {
      return record;
    }

    rejectedRecord = {
      ...record,
      status: "REJECTED" as VerificationStatus,
      complianceStatus: "rejected",
      adminReviewStatus: "rejected",
      reviewDecision: "rejected",
      approved: false,
      rejected: true,
      needsMoreInfo: false,
      reviewed: true,
      accountActive: false,
      rejectedAt: now(),
      updatedAt: now(),
      adminNotes: [
        {
          id: `note_${Date.now()}`,
          note: reason || "Rejected by admin.",
          createdAt: now(),
          createdBy: adminEmail,
        },
        ...(record.adminNotes || []),
      ],
    };

    return rejectedRecord;
  });

  await saveVerificationQueue(updated);

  if (rejectedRecord) {
    const activeFarmerId = rejectedRecord.farmerId || rejectedRecord.id;

    await updateSupabaseReviewStatus(
      rejectedRecord,
      "REJECTED",
      reason || "Rejected by admin.",
      adminEmail
    );

    if (rejectedRecord.accountType === "FARMER") {
      await updateFarmerApprovalInSupabase(activeFarmerId, {
        approved: false,
        account_active: false,
        compliance_status: "rejected",
        admin_review_status: "rejected",
        review_decision: "rejected",
        rejected_at: now(),
      });

      const existingFarmer = await getFarmerById(activeFarmerId);

      if (existingFarmer) {
        await updateFarmerStore(activeFarmerId, {
          approved: false,
          accountActive: false,
          complianceStatus: "rejected",
          adminReviewStatus: "rejected",
          reviewDecision: "rejected",
        } as any);
      }
    }
  }

  return updated;
}

export async function requestMoreInfoForVerificationRecord(
  id: string,
  note: string,
  adminEmail = ADMIN_EMAIL
) {
  const records = await getVerificationQueue();

  let infoRecord: VerificationRecord | undefined;

  const updated = records.map((record) => {
    if (record.id !== id && record.farmerId !== id && record.carrierId !== id) {
      return record;
    }

    infoRecord = {
      ...record,
      status: "MORE_INFO_REQUIRED" as VerificationStatus,
      complianceStatus: "more_info_required",
      adminReviewStatus: "needs_more_info",
      reviewDecision: "needs_more_info",
      approved: false,
      rejected: false,
      needsMoreInfo: true,
      reviewed: true,
      accountActive: false,
      moreInfoRequestedAt: now(),
      updatedAt: now(),
      adminNotes: [
        {
          id: `note_${Date.now()}`,
          note: note || "More information requested.",
          createdAt: now(),
          createdBy: adminEmail,
        },
        ...(record.adminNotes || []),
      ],
    };

    return infoRecord;
  });

  await saveVerificationQueue(updated);

  if (infoRecord) {
    const activeFarmerId = infoRecord.farmerId || infoRecord.id;

    await updateSupabaseReviewStatus(
      infoRecord,
      "MORE_INFO_REQUIRED",
      note || "More information requested.",
      adminEmail
    );

    if (infoRecord.accountType === "FARMER") {
      await updateFarmerApprovalInSupabase(activeFarmerId, {
        approved: false,
        account_active: false,
        compliance_status: "more_info_required",
        admin_review_status: "needs_more_info",
        review_decision: "needs_more_info",
        more_info_requested_at: now(),
      });
    }
  }

  return updated;
}

export async function updateDocumentReviewStatus(
  verificationId: string,
  documentId: string,
  status: DocumentReviewStatus,
  adminNote?: string
) {
  const records = await getVerificationQueue();

  const updated = records.map((record) => {
    if (
      record.id !== verificationId &&
      record.farmerId !== verificationId &&
      record.carrierId !== verificationId
    ) {
      return record;
    }

    return {
      ...record,
      documents: (record.documents || []).map((doc) =>
        doc.id === documentId
          ? {
              ...doc,
              status,
              adminNote,
            }
          : doc
      ),
      updatedAt: now(),
    };
  });

  await saveVerificationQueue(updated);

  const target = updated.find(
    (record) =>
      record.id === verificationId ||
      record.farmerId === verificationId ||
      record.carrierId === verificationId
  );

  if (target) {
    await upsertVerificationRecord(target);
  }

  return updated;
}

export async function loginAdmin(emailOrUsername: string, passcode: string) {
  const login = emailOrUsername.trim().toLowerCase();
  const cleanPasscode = passcode.trim();

  const isProductionAdmin =
    login === ADMIN_EMAIL.toLowerCase() && cleanPasscode === ADMIN_PASSCODE;

  const isTestAdmin =
    login === ADMIN_USERNAME && cleanPasscode === ADMIN_PASSWORD;

  if (!isProductionAdmin && !isTestAdmin) {
    return false;
  }

  const adminUser = {
    id: "admin_001",
    username: ADMIN_USERNAME,
    email: ADMIN_EMAIL,
    role: "ADMIN",
    accountType: "ADMIN",
    loggedInAt: now(),
  };

  await AsyncStorage.multiSet([
    [ADMIN_SESSION_KEY, JSON.stringify(adminUser)],
    ["currentAdmin", JSON.stringify(adminUser)],
    ["currentUser", JSON.stringify(adminUser)],
    ["userRole", "admin"],
    ["currentUserRole", "admin"],
  ]);

  return true;
}

export async function getAdminSession() {
  const raw =
    (await AsyncStorage.getItem(ADMIN_SESSION_KEY)) ||
    (await AsyncStorage.getItem("currentAdmin"));

  return raw ? JSON.parse(raw) : null;
}

export async function logoutAdmin() {
  await AsyncStorage.multiRemove([
    ADMIN_SESSION_KEY,
    "currentAdmin",
    "currentUser",
    "userRole",
    "currentUserRole",
  ]);
}

export function createVerificationRecordFromFarmer(params: {
  farmerId: string;
  farmName: string;
  ownerName: string;
  email: string;
  phone?: string;
  documents?: BusinessDocument[];
}): VerificationRecord {
  return normalizeRecord({
    id: params.farmerId,
    farmerId: params.farmerId,
    accountType: "FARMER",
    businessName: params.farmName,
    farmName: params.farmName,
    ownerName: params.ownerName,
    email: params.email,
    phone: params.phone,
    status: "PENDING_VERIFICATION",
    complianceStatus: "pending_verification",
    documents: params.documents || [],
    adminNotes: [],
    submittedAt: now(),
    updatedAt: now(),
  });
}

export function createVerificationRecordFromFreightCarrier(params: {
  carrierId: string;
  companyName: string;
  ownerName: string;
  email: string;
  phone?: string;
  documents?: BusinessDocument[];
}): VerificationRecord {
  return normalizeRecord({
    id: params.carrierId,
    carrierId: params.carrierId,
    accountType: "FREIGHT_CARRIER",
    businessName: params.companyName,
    companyName: params.companyName,
    ownerName: params.ownerName,
    email: params.email,
    phone: params.phone,
    status: "PENDING_VERIFICATION",
    complianceStatus: "pending_verification",
    documents: params.documents || [],
    adminNotes: [],
    submittedAt: now(),
    updatedAt: now(),
  });
}