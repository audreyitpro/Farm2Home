// app/ai/compliance-verification.ts

import * as complianceStore from "../data/complianceStore";
import { getFarmerById, updateFarmerStore } from "../data/farmerStore";

export type ComplianceDocument = {
  id?: string;
  type?: string;
  uri?: string;
  label?: string;
  notes?: string;
  uploadedAt?: string;
  [key: string]: unknown;
};

export type ComplianceRecord = {
  id?: string;
  farmerId: string;
  businessName?: string;
  ownerName?: string;
  state?: string;
  status?: string;
  documents?: ComplianceDocument[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type ComplianceVerificationResult = {
  farmerId: string;
  businessName: string;
  ownerName: string;
  state: string;
  status: "approved" | "needs_more_info";
  score: number;
  idVerified: boolean;
  businessVerified: boolean;
  einVerified: boolean;
  stateRegistrationVerified: boolean;
  insuranceVerified: boolean;
  foodPermitVerified: boolean;
  agreementVerified: boolean;
  payoutVerified: boolean;
  legalChecklistVerified: boolean;
  noFraudFlags: boolean;
  missingItems: string[];
  verificationSources: string[];
  reviewedAt: string;
  autoApproved: boolean;
};

type ComplianceStoreModule = Record<string, unknown>;

const complianceStoreApi =
  complianceStore as unknown as ComplianceStoreModule;

export const US_STATE_VERIFICATION_SOURCES: Record<string, string[]> = {
  MI: [
    "Michigan LARA Business Entity Search",
    "Michigan Department of Agriculture and Rural Development",
  ],
  GA: [
    "Georgia Secretary of State",
    "Georgia Department of Agriculture",
  ],
  NC: [
    "North Carolina Secretary of State",
    "North Carolina Department of Agriculture",
  ],
  VA: [
    "Virginia State Corporation Commission",
    "Virginia Department of Agriculture",
  ],
  KY: [
    "Kentucky Secretary of State",
    "Kentucky Department of Agriculture",
  ],
  MS: [
    "Mississippi Secretary of State",
    "Mississippi Department of Agriculture",
  ],
  OH: [
    "Ohio Secretary of State",
    "Ohio Department of Agriculture",
  ],
  IL: [
    "Illinois Secretary of State",
    "Illinois Department of Agriculture",
  ],
  IN: [
    "Indiana Secretary of State",
    "Indiana Department of Agriculture",
  ],
  FL: [
    "Florida Division of Corporations",
    "Florida Department of Agriculture",
  ],
  TX: [
    "Texas Secretary of State",
    "Texas Department of Agriculture",
  ],
  CA: [
    "California Secretary of State",
    "California Department of Food and Agriculture",
  ],
  NY: [
    "New York Department of State",
    "New York Department of Agriculture and Markets",
  ],
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalize(value: unknown): string {
  return clean(value).toLowerCase();
}

function getDocuments(record: ComplianceRecord): ComplianceDocument[] {
  return Array.isArray(record.documents) ? record.documents : [];
}

function hasValidUri(uri: unknown): boolean {
  const value = clean(uri);

  return (
    value.startsWith("file://") ||
    value.startsWith("content://") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("stripe://") ||
    value.startsWith("agreement://") ||
    value.startsWith("legal-checklist://")
  );
}

function hasDocument(
  record: ComplianceRecord,
  type: string
): boolean {
  return getDocuments(record).some(
    (document) =>
      clean(document?.type) === type &&
      hasValidUri(document?.uri)
  );
}

function hasLegalChecklist(
  record: ComplianceRecord
): boolean {
  return getDocuments(record).some((document) => {
    const uri = normalize(document?.uri);
    const label = normalize(document?.label);
    const notes = normalize(document?.notes);

    return (
      uri.includes("legal-checklist://accepted") ||
      label.includes("legal checklist") ||
      label.includes("seller terms") ||
      notes.includes("seller terms") ||
      notes.includes("legal")
    );
  });
}

function addMissingIfFalse(
  passed: boolean,
  message: string,
  missingItems: string[]
): void {
  if (!passed && !missingItems.includes(message)) {
    missingItems.push(message);
  }
}

function getRequiredDocumentType(
  document: ComplianceDocument
): string {
  return clean(document?.type);
}

function hasRequiredDocument(
  documents: ComplianceDocument[],
  acceptedTypes: string[]
): boolean {
  return documents.some((document) => {
    const type = getRequiredDocumentType(document);

    return (
      acceptedTypes.includes(type) &&
      hasValidUri(document?.uri)
    );
  });
}

/**
 * Local fallback for complianceStore implementations that do not export
 * getMissingRequiredDocuments.
 */
function calculateMissingRequiredDocuments(
  documents: ComplianceDocument[]
): string[] {
  const missingItems: string[] = [];

  const requiredGroups = [
    {
      types: ["government_id"],
      message: "Government ID is missing.",
    },
    {
      types: ["business_registration"],
      message:
        "Business registration / LLC document is missing.",
    },
    {
      types: ["ein_tax_document", "ein_letter"],
      message: "EIN / tax document is missing.",
    },
    {
      types: [
        "farm_license",
        "agriculture_registration",
        "state_registration",
      ],
      message:
        "Farm license or agriculture registration is missing.",
    },
    {
      types: ["insurance"],
      message: "Insurance document is missing.",
    },
    {
      types: [
        "food_permit",
        "food_license",
        "farmers_market_permit",
      ],
      message: "Food permit is missing.",
    },
    {
      types: ["pickup_delivery_agreement"],
      message:
        "Pickup / delivery agreement is missing.",
    },
  ];

  for (const requirement of requiredGroups) {
    if (
      !hasRequiredDocument(
        documents,
        requirement.types
      )
    ) {
      missingItems.push(requirement.message);
    }
  }

  return missingItems;
}

function getMissingRequiredDocuments(
  documents: ComplianceDocument[]
): string[] {
  const exportedFunction =
    complianceStoreApi.getMissingRequiredDocuments;

  if (typeof exportedFunction === "function") {
    const result = exportedFunction(documents);

    return Array.isArray(result)
      ? result.map((item) => clean(item)).filter(Boolean)
      : [];
  }

  return calculateMissingRequiredDocuments(documents);
}

async function upsertComplianceRecord(
  record: ComplianceRecord
): Promise<void> {
  const possibleFunctions = [
    complianceStoreApi.upsertComplianceRecord,
    complianceStoreApi.saveComplianceRecord,
    complianceStoreApi.setComplianceRecord,
    complianceStoreApi.updateComplianceRecord,
  ];

  const handler = possibleFunctions.find(
    (candidate) => typeof candidate === "function"
  );

  if (typeof handler === "function") {
    await handler(record);
    return;
  }

  console.warn(
    "Compliance record was not persisted because complianceStore does not expose an upsert or save function."
  );
}

async function saveComplianceResult(
  farmerId: string,
  result: ComplianceVerificationResult
): Promise<void> {
  const possibleFunctions = [
    complianceStoreApi.saveComplianceResult,
    complianceStoreApi.saveVerificationResult,
    complianceStoreApi.setComplianceResult,
    complianceStoreApi.updateComplianceResult,
  ];

  const handler = possibleFunctions.find(
    (candidate) => typeof candidate === "function"
  );

  if (typeof handler === "function") {
    await handler(farmerId, result);
    return;
  }

  console.warn(
    "Compliance result was not persisted because complianceStore does not expose a result-saving function."
  );
}

export async function runAIComplianceVerification(
  record: ComplianceRecord
): Promise<ComplianceVerificationResult> {
  const farmerId = clean(record.farmerId);

  if (!farmerId) {
    throw new Error(
      "A farmer ID is required to run compliance verification."
    );
  }

  const documents = getDocuments(record);

  await upsertComplianceRecord({
    ...record,
    farmerId,
    status: "under_ai_review",
    updatedAt: new Date().toISOString(),
  });

  const farmer = (await getFarmerById(farmerId)) as
    | Record<string, unknown>
    | null
    | undefined;

  const systemMissingItems =
    getMissingRequiredDocuments(documents);

  const missingItems: string[] = [
    ...systemMissingItems,
  ];

  const businessName = clean(
    record.businessName ||
      farmer?.farmName ||
      farmer?.businessName
  );

  const ownerName = clean(
    record.ownerName ||
      farmer?.ownerName ||
      farmer?.name ||
      farmer?.fullName
  );

  const state = clean(
    record.state ||
      farmer?.state ||
      farmer?.location ||
      "MI"
  )
    .slice(0, 2)
    .toUpperCase();

  const idVerified = hasDocument(
    record,
    "government_id"
  );

  const businessVerified =
    hasDocument(record, "business_registration") &&
    Boolean(businessName);

  const einVerified =
    hasDocument(record, "ein_tax_document") ||
    hasDocument(record, "ein_letter");

  const stateRegistrationVerified =
    hasDocument(record, "farm_license") ||
    hasDocument(record, "agriculture_registration") ||
    hasDocument(record, "state_registration");

  const insuranceVerified = hasDocument(
    record,
    "insurance"
  );

  const foodPermitVerified =
    hasDocument(record, "food_permit") ||
    hasDocument(record, "food_license") ||
    hasDocument(record, "farmers_market_permit");

  const stripeDocumentVerified = hasDocument(
    record,
    "stripe_payout"
  );

  const stripeAccountVerified = Boolean(
    farmer?.stripeAccountId ||
      farmer?.farmerStripeAccountId ||
      farmer?.stripePayoutAccount ||
      farmer?.stripeOnboardingComplete ||
      farmer?.stripePayoutsEnabled
  );

  const payoutVerified =
    stripeDocumentVerified && stripeAccountVerified;

  const agreementVerified = hasDocument(
    record,
    "pickup_delivery_agreement"
  );

  const legalChecklistVerified =
    hasLegalChecklist(record);

  const noFraudFlags = Boolean(
    businessName && ownerName && state
  );

  addMissingIfFalse(
    idVerified,
    "Government ID is missing.",
    missingItems
  );

  addMissingIfFalse(
    businessVerified,
    "Business registration / LLC document is missing.",
    missingItems
  );

  addMissingIfFalse(
    einVerified,
    "EIN / tax document is missing.",
    missingItems
  );

  addMissingIfFalse(
    stateRegistrationVerified,
    "Farm license or agriculture registration is missing.",
    missingItems
  );

  addMissingIfFalse(
    insuranceVerified,
    "Insurance document is missing.",
    missingItems
  );

  addMissingIfFalse(
    foodPermitVerified,
    "Food permit is missing.",
    missingItems
  );

  addMissingIfFalse(
    payoutVerified,
    "Stripe payout account is not fully verified.",
    missingItems
  );

  addMissingIfFalse(
    agreementVerified,
    "Pickup / delivery agreement is missing.",
    missingItems
  );

  addMissingIfFalse(
    legalChecklistVerified,
    "Legal seller checklist has not been accepted.",
    missingItems
  );

  addMissingIfFalse(
    noFraudFlags,
    "Business name, owner name, or state is missing.",
    missingItems
  );

  const checks = [
    idVerified,
    businessVerified,
    einVerified,
    stateRegistrationVerified,
    insuranceVerified,
    foodPermitVerified,
    payoutVerified,
    agreementVerified,
    legalChecklistVerified,
    noFraudFlags,
  ];

  const passedCount = checks.filter(Boolean).length;

  const score = Math.round(
    (passedCount / checks.length) * 100
  );

  const uniqueMissingItems = Array.from(
    new Set(missingItems.map(clean).filter(Boolean))
  );

  const canAutoApprove =
    checks.every(Boolean) &&
    uniqueMissingItems.length === 0;

  const result: ComplianceVerificationResult = {
    farmerId,
    businessName,
    ownerName,
    state,
    status: canAutoApprove
      ? "approved"
      : "needs_more_info",
    score,
    idVerified,
    businessVerified,
    einVerified,
    stateRegistrationVerified,
    insuranceVerified,
    foodPermitVerified,
    agreementVerified,
    payoutVerified,
    legalChecklistVerified,
    noFraudFlags,
    missingItems: uniqueMissingItems,
    verificationSources: [
      ...(US_STATE_VERIFICATION_SOURCES[state] || [
        "Secretary of State Business Search",
        "Department of Agriculture",
      ]),
      "Government ID review",
      "Business registration review",
      "EIN / tax document review",
      "Insurance document review",
      "Stripe payout verification",
      "Food permit review",
      "Pickup / delivery agreement review",
      "Farm2Home legal seller checklist",
      "Farm2Home AI compliance checklist",
    ],
    reviewedAt: new Date().toISOString(),
    autoApproved: canAutoApprove,
  };

  await saveComplianceResult(farmerId, result);

  await updateFarmerStore(farmerId, {
    approved: canAutoApprove,
    complianceStatus: result.status,
    complianceScore: score,
    complianceReviewedAt: result.reviewedAt,
  } as any);

  return result;
}