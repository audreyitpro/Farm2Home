import AsyncStorage from "@react-native-async-storage/async-storage";

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

  documents: BusinessDocument[];
  adminNotes: AdminReviewNote[];

  stripeAccountId?: string;
  farmerStripeAccountId?: string;
  stripePayoutsEnabled?: boolean;
  stripeChargesEnabled?: boolean;
  stripeOnboardingComplete?: boolean;

  pickupDeliveryOption?: string;
  uploadedDocs?: Record<string, string>;

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
  const id = String(record.id || record.farmerId || record.carrierId || `vr_${Date.now()}`);

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
    farmName: record.farmName || (accountType === "FARMER" ? businessName : undefined),
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

    documents: Array.isArray(record.documents) ? record.documents : [],
    adminNotes: Array.isArray(record.adminNotes) ? record.adminNotes : [],

    stripeAccountId: record.stripeAccountId || "",
    farmerStripeAccountId: record.farmerStripeAccountId || record.stripeAccountId || "",
    stripePayoutsEnabled: Boolean(record.stripePayoutsEnabled),
    stripeChargesEnabled: Boolean(record.stripeChargesEnabled),
    stripeOnboardingComplete: Boolean(record.stripeOnboardingComplete),

    pickupDeliveryOption: record.pickupDeliveryOption || "",
    uploadedDocs: record.uploadedDocs || {},

    submittedAt: record.submittedAt || now(),
    updatedAt: record.updatedAt || now(),

    approvedAt: record.approvedAt,
    rejectedAt: record.rejectedAt,
    moreInfoRequestedAt: record.moreInfoRequestedAt,
  };
}

export async function getVerificationQueue(): Promise<VerificationRecord[]> {
  try {
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
  const records = await getVerificationQueue();
  const normalizedIncoming = normalizeRecord(record);

  const existingIndex = records.findIndex(
    (item) =>
      item.id === normalizedIncoming.id ||
      (normalizedIncoming.farmerId && item.farmerId === normalizedIncoming.farmerId) ||
      (normalizedIncoming.carrierId && item.carrierId === normalizedIncoming.carrierId)
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

export async function approveVerificationRecord(
  id: string,
  adminEmail = ADMIN_EMAIL
) {
  const records = await getVerificationQueue();

  const updated = records.map((record) => {
    if (record.id !== id && record.farmerId !== id && record.carrierId !== id) {
      return record;
    }

    return {
      ...record,
      status: "APPROVED" as VerificationStatus,
      complianceStatus: "approved",
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
  });

  await saveVerificationQueue(updated);

  const approvedRecord = updated.find(
    (record) => record.id === id || record.farmerId === id || record.carrierId === id
  );

  if (approvedRecord?.accountType === "FARMER") {
    const activeFarmerId = approvedRecord.farmerId || approvedRecord.id;

    const existingFarmer = await getFarmerById(activeFarmerId);

    if (existingFarmer) {
      await updateFarmerStore(activeFarmerId, {
        approved: true,
        accountActive: true,
        complianceStatus: "approved",
        approvedAt: now(),
      } as any);
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

  const updated = records.map((record) => {
    if (record.id !== id && record.farmerId !== id && record.carrierId !== id) {
      return record;
    }

    return {
      ...record,
      status: "REJECTED" as VerificationStatus,
      complianceStatus: "rejected",
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
  });

  await saveVerificationQueue(updated);

  const rejectedRecord = updated.find(
    (record) => record.id === id || record.farmerId === id || record.carrierId === id
  );

  if (rejectedRecord?.accountType === "FARMER") {
    const activeFarmerId = rejectedRecord.farmerId || rejectedRecord.id;

    const existingFarmer = await getFarmerById(activeFarmerId);

    if (existingFarmer) {
      await updateFarmerStore(activeFarmerId, {
        approved: false,
        accountActive: false,
        complianceStatus: "rejected",
      } as any);
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

  const updated = records.map((record) => {
    if (record.id !== id && record.farmerId !== id && record.carrierId !== id) {
      return record;
    }

    return {
      ...record,
      status: "MORE_INFO_REQUIRED" as VerificationStatus,
      complianceStatus: "more_info_required",
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
  });

  await saveVerificationQueue(updated);

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

  return updated;
}

export async function loginAdmin(email: string, passcode: string) {
  const emailMatches = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const passcodeMatches = passcode.trim() === ADMIN_PASSCODE;

  if (!emailMatches || !passcodeMatches) {
    return false;
  }

  await AsyncStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify({
      email: ADMIN_EMAIL,
      role: "ADMIN",
      loggedInAt: now(),
    })
  );

  return true;
}

export async function getAdminSession() {
  const raw = await AsyncStorage.getItem(ADMIN_SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function logoutAdmin() {
  await AsyncStorage.removeItem(ADMIN_SESSION_KEY);
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
    documents: params.documents || [],
    adminNotes: [],
    submittedAt: now(),
    updatedAt: now(),
  });
}