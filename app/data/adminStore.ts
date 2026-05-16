import AsyncStorage from "@react-native-async-storage/async-storage";

export type VerificationStatus =
  | "STARTED"
  | "DOCUMENTS_REQUIRED"
  | "DOCUMENTS_SUBMITTED"
  | "PENDING_VERIFICATION"
  | "APPROVED"
  | "REJECTED"
  | "MORE_INFO_REQUIRED"
  | "SUSPENDED";

export type DocumentReviewStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

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

  businessName: string;
  ownerName: string;
  email: string;
  phone?: string;

  businessAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;

  status: VerificationStatus;

  documents: BusinessDocument[];

  adminNotes: AdminReviewNote[];

  submittedAt: string;
  updatedAt: string;

  approvedAt?: string;
  rejectedAt?: string;
  moreInfoRequestedAt?: string;
};

const VERIFICATION_QUEUE_KEY = "farm2homeVerificationQueue";
const ADMIN_SESSION_KEY = "farm2homeAdminSession";

export const ADMIN_EMAIL = "audreyitprofesional@gmail.com";
export const ADMIN_PASSCODE = "Farm2HomeAdmin2026";

export async function getVerificationQueue(): Promise<
  VerificationRecord[]
> {
  try {
    const raw = await AsyncStorage.getItem(
      VERIFICATION_QUEUE_KEY
    );

    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.log("Error loading verification queue", error);
    return [];
  }
}

export async function saveVerificationQueue(
  records: VerificationRecord[]
) {
  await AsyncStorage.setItem(
    VERIFICATION_QUEUE_KEY,
    JSON.stringify(records)
  );
}

export async function upsertVerificationRecord(
  record: VerificationRecord
) {
  const records = await getVerificationQueue();

  const existingIndex = records.findIndex(
    (item) => item.id === record.id
  );

  const updatedRecord: VerificationRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    records[existingIndex] = {
      ...records[existingIndex],
      ...updatedRecord,
    };
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

  return records.find((item) => item.id === id) || null;
}

export async function getPendingVerificationRecords() {
  const records = await getVerificationQueue();

  return records.filter((item) =>
    [
      "DOCUMENTS_SUBMITTED",
      "PENDING_VERIFICATION",
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
    if (record.id !== id) return record;

    return {
      ...record,
      status: "APPROVED" as VerificationStatus,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      adminNotes: [
        {
          id: `note_${Date.now()}`,
          note: "Approved by admin.",
          createdAt: new Date().toISOString(),
          createdBy: adminEmail,
        },
        ...(record.adminNotes || []),
      ],
    };
  });

  await saveVerificationQueue(updated);

  return updated;
}

export async function rejectVerificationRecord(
  id: string,
  reason: string,
  adminEmail = ADMIN_EMAIL
) {
  const records = await getVerificationQueue();

  const updated = records.map((record) => {
    if (record.id !== id) return record;

    return {
      ...record,

      status: "REJECTED" as VerificationStatus,

      rejectedAt: new Date().toISOString(),

      updatedAt: new Date().toISOString(),

      adminNotes: [
        {
          id: `note_${Date.now()}`,
          note: reason || "Rejected by admin.",
          createdAt: new Date().toISOString(),
          createdBy: adminEmail,
        },
        ...(record.adminNotes || []),
      ],
    };
  });

  await saveVerificationQueue(updated);

  return updated;
}

export async function requestMoreInfoForVerificationRecord(
  id: string,
  note: string,
  adminEmail = ADMIN_EMAIL
) {
  const records = await getVerificationQueue();

  const updated = records.map((record) => {
    if (record.id !== id) return record;

    return {
      ...record,

      status: "MORE_INFO_REQUIRED" as VerificationStatus,

      moreInfoRequestedAt: new Date().toISOString(),

      updatedAt: new Date().toISOString(),

      adminNotes: [
        {
          id: `note_${Date.now()}`,
          note: note || "More information requested.",
          createdAt: new Date().toISOString(),
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
    if (record.id !== verificationId) return record;

    return {
      ...record,

      documents: record.documents.map((doc) =>
        doc.id === documentId
          ? {
              ...doc,
              status,
              adminNote,
            }
          : doc
      ),

      updatedAt: new Date().toISOString(),
    };
  });

  await saveVerificationQueue(updated);

  return updated;
}

export async function loginAdmin(
  email: string,
  passcode: string
) {
  const emailMatches =
    email.trim().toLowerCase() ===
    ADMIN_EMAIL.toLowerCase();

  const passcodeMatches =
    passcode.trim() === ADMIN_PASSCODE;

  if (!emailMatches || !passcodeMatches) {
    return false;
  }

  await AsyncStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify({
      email: ADMIN_EMAIL,
      role: "ADMIN",
      loggedInAt: new Date().toISOString(),
    })
  );

  return true;
}

export async function getAdminSession() {
  const raw = await AsyncStorage.getItem(
    ADMIN_SESSION_KEY
  );

  return raw ? JSON.parse(raw) : null;
}

export async function logoutAdmin() {
  await AsyncStorage.removeItem(
    ADMIN_SESSION_KEY
  );
}

export function createVerificationRecordFromFarmer(
  params: {
    farmerId: string;
    farmName: string;
    ownerName: string;
    email: string;
    phone?: string;
    documents?: BusinessDocument[];
  }
): VerificationRecord {
  return {
    id: params.farmerId,

    accountType: "FARMER",

    businessName: params.farmName,

    ownerName: params.ownerName,

    email: params.email,

    phone: params.phone,

    status: "PENDING_VERIFICATION",

    documents: params.documents || [],

    adminNotes: [],

    submittedAt: new Date().toISOString(),

    updatedAt: new Date().toISOString(),
  };
}

export function createVerificationRecordFromFreightCarrier(
  params: {
    carrierId: string;
    companyName: string;
    ownerName: string;
    email: string;
    phone?: string;
    documents?: BusinessDocument[];
  }
): VerificationRecord {
  return {
    id: params.carrierId,

    accountType: "FREIGHT_CARRIER",

    businessName: params.companyName,

    ownerName: params.ownerName,

    email: params.email,

    phone: params.phone,

    status: "PENDING_VERIFICATION",

    documents: params.documents || [],

    adminNotes: [],

    submittedAt: new Date().toISOString(),

    updatedAt: new Date().toISOString(),
  };
}