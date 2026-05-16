import AsyncStorage from "@react-native-async-storage/async-storage";

export type ComplianceStatus =
  | "Pass"
  | "Needs Review"
  | "Fail"
  | "Approved"
  | "Rejected"
  | "OPEN"
  | "IN_REVIEW"
  | "RESOLVED"
  | "not_started"
  | "documents_needed"
  | "under_ai_review"
  | "needs_more_info"
  | "verified"
  | "rejected"
  | "approved";

export type ComplianceDocumentType =
  | "government_id"
  | "business_registration"
  | "ein_tax_document"
  | "farm_license"
  | "insurance"
  | "food_permit"
  | "stripe_payout"
  | "pickup_delivery_agreement";

export type ComplianceDocument = {
  id: string;
  farmerId: string;
  type: ComplianceDocumentType;
  label: string;
  uri: string;
  uploadedAt: string;
  verified: boolean;
  notes?: string;
};

export type ComplianceVerificationResult = {
  farmerId: string;
  businessName: string;
  ownerName: string;
  state: string;
  status: ComplianceStatus;
  score: number;
  idVerified: boolean;
  businessVerified: boolean;
  einVerified: boolean;
  stateRegistrationVerified: boolean;
  insuranceVerified: boolean;
  payoutVerified: boolean;
  noFraudFlags: boolean;
  missingItems: string[];
  verificationSources: string[];
  reviewedAt: string;
  autoApproved: boolean;
};

export type ComplianceRecord = {
  farmerId: string;
  businessName: string;
  ownerName: string;
  state: string;
  status: ComplianceStatus;
  documents: ComplianceDocument[];
  result?: ComplianceVerificationResult;
  createdAt: string;
  updatedAt: string;
};

export type ComplianceFinding = {
  id: string;
  entityId: string;
  entityType: "FARMER" | "FREIGHT" | "DRIVER" | "ORDER" | "DOCUMENT";
  entityName: string;
  farmerId: string;
  farmName: string;
  uploadedDocumentName: string;
  title: string;
  description: string;
  findings: string[];
  missingItems: string[];
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_REVIEW" | "RESOLVED";
  aiStatus: ComplianceStatus;
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
};

const COMPLIANCE_FINDINGS_KEY = "farm2homeComplianceFindings";
const COMPLIANCE_RECORDS_KEY = "farm2homeComplianceRecords";

export const REQUIRED_DOCUMENTS: {
  type: ComplianceDocumentType;
  label: string;
  required: boolean;
}[] = [
  { type: "government_id", label: "Government ID", required: true },
  {
    type: "business_registration",
    label: "Business Registration / DBA / LLC",
    required: true,
  },
  { type: "ein_tax_document", label: "EIN Letter / Tax Document", required: true },
  {
    type: "farm_license",
    label: "Farm License / Agriculture Registration",
    required: true,
  },
  { type: "insurance", label: "Insurance Document", required: true },
  {
    type: "food_permit",
    label: "Food Permit / Cottage Food / Dairy / Meat Permit",
    required: true,
  },
  { type: "stripe_payout", label: "Stripe Payout Account", required: true },
  {
    type: "pickup_delivery_agreement",
    label: "Pickup / Delivery Agreement",
    required: true,
  },
];

function normalizeRecord(record: Partial<ComplianceRecord>): ComplianceRecord {
  const now = new Date().toISOString();

  return {
    farmerId: String(record.farmerId || ""),
    businessName: record.businessName || "",
    ownerName: record.ownerName || "",
    state: record.state || "MI",
    status: record.status || "not_started",
    documents: Array.isArray(record.documents) ? record.documents : [],
    result: record.result,
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
  };
}

function normalizeFinding(
  finding: Partial<ComplianceFinding> | any
): ComplianceFinding {
  const now = new Date().toISOString();

  const farmName =
    finding.farmName ||
    finding.entityName ||
    finding.entity_name ||
    "Farm2Home Record";

  const documentName =
    finding.uploadedDocumentName ||
    finding.documentName ||
    finding.title ||
    "Document not provided";

  return {
    id: String(finding.id || `compliance_${Date.now()}`),
    entityId: String(
      finding.entityId || finding.entity_id || finding.farmerId || ""
    ),
    entityType: finding.entityType || finding.entity_type || "DOCUMENT",
    entityName: String(farmName),
    farmerId: String(finding.farmerId || finding.entityId || ""),
    farmName: String(farmName),
    uploadedDocumentName: String(documentName),
    title: finding.title || "Compliance Finding",
    description: finding.description || "No description provided.",
    findings: Array.isArray(finding.findings) ? finding.findings : [],
    missingItems: Array.isArray(finding.missingItems)
      ? finding.missingItems
      : Array.isArray(finding.missing_items)
      ? finding.missing_items
      : [],
    severity: finding.severity || "MEDIUM",
    status: finding.status || "OPEN",
    aiStatus: finding.aiStatus || "Needs Review",
    reviewedAt: finding.reviewedAt || finding.reviewed_at || now,
    createdAt: finding.createdAt || finding.created_at || now,
    updatedAt: finding.updatedAt || finding.updated_at || now,
  };
}

/**
 * Farmer compliance records
 */

async function getAllRecords(): Promise<ComplianceRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(COMPLIANCE_RECORDS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeRecord) : [];
  } catch (error) {
    console.log("Get compliance records error:", error);
    return [];
  }
}

async function saveAllRecords(records: ComplianceRecord[]): Promise<void> {
  await AsyncStorage.setItem(
    COMPLIANCE_RECORDS_KEY,
    JSON.stringify(records.map(normalizeRecord))
  );
}

export async function getComplianceRecords(): Promise<ComplianceRecord[]> {
  return await getAllRecords();
}

export async function getComplianceRecord(
  farmerId: string
): Promise<ComplianceRecord | null> {
  const records = await getAllRecords();
  return records.find((item) => item.farmerId === farmerId) || null;
}

export async function upsertComplianceRecord(
  record: Partial<ComplianceRecord>
): Promise<ComplianceRecord> {
  const records = await getAllRecords();
  const existing = records.find((item) => item.farmerId === record.farmerId);

  const updated = normalizeRecord({
    ...existing,
    ...record,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const nextRecords = [
    ...records.filter((item) => item.farmerId !== updated.farmerId),
    updated,
  ];

  await saveAllRecords(nextRecords);

  return updated;
}

export async function addComplianceDocument(
  farmerId: string,
  businessName: string,
  ownerName: string,
  state: string,
  document: Omit<
    ComplianceDocument,
    "id" | "farmerId" | "uploadedAt" | "verified"
  >
): Promise<ComplianceRecord> {
  const existing = await getComplianceRecord(farmerId);

  const newDocument: ComplianceDocument = {
    id: `doc_${Date.now()}`,
    farmerId,
    type: document.type,
    label: document.label,
    uri: document.uri,
    uploadedAt: new Date().toISOString(),
    verified: false,
    notes: document.notes || "",
  };

  const documents = [
    ...(existing?.documents || []).filter((item) => item.type !== document.type),
    newDocument,
  ];

  return await upsertComplianceRecord({
    farmerId,
    businessName,
    ownerName,
    state,
    documents,
    status: "documents_needed",
  });
}

export async function saveComplianceResult(
  farmerId: string,
  result: ComplianceVerificationResult
): Promise<ComplianceRecord> {
  const existing = await getComplianceRecord(farmerId);

  return await upsertComplianceRecord({
    ...existing,
    farmerId,
    status: result.status,
    result,
    documents: (existing?.documents || []).map((doc) => ({
      ...doc,
      verified: !result.missingItems.includes(doc.label),
    })),
  });
}

export async function clearComplianceRecord(farmerId: string): Promise<void> {
  const records = await getAllRecords();
  await saveAllRecords(records.filter((item) => item.farmerId !== farmerId));
}

export function getMissingRequiredDocuments(
  documents: ComplianceDocument[]
): string[] {
  return REQUIRED_DOCUMENTS.filter(
    (requiredDoc) =>
      requiredDoc.required &&
      !documents.some((doc) => doc.type === requiredDoc.type && doc.uri)
  ).map((doc) => doc.label);
}

/**
 * Existing compliance findings functions
 */

function safeParseFindings(raw: string | null): ComplianceFinding[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeFinding) : [];
  } catch (error) {
    console.log("Parse compliance findings error:", error);
    return [];
  }
}

export async function getComplianceFindings(): Promise<ComplianceFinding[]> {
  try {
    const raw = await AsyncStorage.getItem(COMPLIANCE_FINDINGS_KEY);
    return safeParseFindings(raw);
  } catch (error) {
    console.log("Get compliance findings error:", error);
    return [];
  }
}

export async function saveComplianceFindings(
  findings: ComplianceFinding[]
): Promise<void> {
  try {
    const normalized = findings.map(normalizeFinding);
    await AsyncStorage.setItem(
      COMPLIANCE_FINDINGS_KEY,
      JSON.stringify(normalized)
    );
  } catch (error) {
    console.log("Save compliance findings error:", error);
  }
}

export async function addComplianceFinding(
  finding: Partial<ComplianceFinding>
): Promise<ComplianceFinding[]> {
  const findings = await getComplianceFindings();

  const newFinding = normalizeFinding({
    ...finding,
    id: finding.id || `compliance_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const updatedFindings = [newFinding, ...findings];

  await saveComplianceFindings(updatedFindings);

  return updatedFindings;
}

export async function saveComplianceFinding(
  finding: Partial<ComplianceFinding>
): Promise<ComplianceFinding[]> {
  return addComplianceFinding(finding);
}

export async function updateComplianceFinding(
  id: string,
  updates: Partial<ComplianceFinding>
): Promise<ComplianceFinding[]> {
  const findings = await getComplianceFindings();

  const updatedFindings = findings.map((finding) =>
    finding.id === id
      ? normalizeFinding({
          ...finding,
          ...updates,
          updatedAt: new Date().toISOString(),
        })
      : finding
  );

  await saveComplianceFindings(updatedFindings);

  return updatedFindings;
}

export async function updateComplianceStatus(
  id: string,
  aiStatus: ComplianceStatus
): Promise<ComplianceFinding[]> {
  return updateComplianceFinding(id, {
    aiStatus,
    reviewedAt: new Date().toLocaleString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function resolveComplianceFinding(
  id: string
): Promise<ComplianceFinding[]> {
  return updateComplianceFinding(id, {
    status: "RESOLVED",
    aiStatus: "Approved",
    reviewedAt: new Date().toISOString(),
  });
}

export async function deleteComplianceFinding(
  id: string
): Promise<ComplianceFinding[]> {
  const findings = await getComplianceFindings();
  const updatedFindings = findings.filter((finding) => finding.id !== id);

  await saveComplianceFindings(updatedFindings);

  return updatedFindings;
}

export async function clearComplianceFindings(): Promise<void> {
  await AsyncStorage.removeItem(COMPLIANCE_FINDINGS_KEY);
}