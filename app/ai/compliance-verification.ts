// app/ai/compliance-verification.ts

import {
  ComplianceRecord,
  ComplianceVerificationResult,
  getMissingRequiredDocuments,
  saveComplianceResult,
  upsertComplianceRecord,
} from "../data/complianceStore";

import { getFarmerById, updateFarmerStore } from "../data/farmerStore";

export const US_STATE_VERIFICATION_SOURCES: Record<string, string[]> = {
  MI: [
    "Michigan LARA Business Entity Search",
    "Michigan Department of Agriculture and Rural Development",
  ],
  GA: ["Georgia Secretary of State", "Georgia Department of Agriculture"],
  NC: ["North Carolina Secretary of State", "North Carolina Department of Agriculture"],
  VA: ["Virginia State Corporation Commission", "Virginia Department of Agriculture"],
  KY: ["Kentucky Secretary of State", "Kentucky Department of Agriculture"],
  MS: ["Mississippi Secretary of State", "Mississippi Department of Agriculture"],
  OH: ["Ohio Secretary of State", "Ohio Department of Agriculture"],
  IL: ["Illinois Secretary of State", "Illinois Department of Agriculture"],
  IN: ["Indiana Secretary of State", "Indiana Department of Agriculture"],
  FL: ["Florida Division of Corporations", "Florida Department of Agriculture"],
  TX: ["Texas Secretary of State", "Texas Department of Agriculture"],
  CA: ["California Secretary of State", "California Department of Food and Agriculture"],
  NY: ["New York Department of State", "New York Department of Agriculture and Markets"],
};

function clean(value: any): string {
  return String(value ?? "").trim();
}

function normalize(value: any): string {
  return clean(value).toLowerCase();
}

function getDocuments(record: ComplianceRecord): any[] {
  return Array.isArray((record as any).documents) ? (record as any).documents : [];
}

function hasValidUri(uri: any): boolean {
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

function hasDocument(record: ComplianceRecord, type: string): boolean {
  const docs = getDocuments(record);

  return docs.some(
    (doc) => clean(doc?.type) === type && hasValidUri(doc?.uri)
  );
}

function hasLegalChecklist(record: ComplianceRecord): boolean {
  const docs = getDocuments(record);

  return docs.some((doc) => {
    const uri = normalize(doc?.uri);
    const label = normalize(doc?.label);
    const notes = normalize(doc?.notes);

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
) {
  if (!passed && !missingItems.includes(message)) {
    missingItems.push(message);
  }
}

export async function runAIComplianceVerification(
  record: ComplianceRecord
): Promise<ComplianceVerificationResult> {
  const docs = getDocuments(record);

  await upsertComplianceRecord({
    ...(record as any),
    status: "under_ai_review",
  } as any);

  const farmer: any = await getFarmerById((record as any).farmerId);

  const systemMissingItems = getMissingRequiredDocuments(docs as any);
  const missingItems: string[] = Array.isArray(systemMissingItems)
    ? [...systemMissingItems]
    : [];

  const businessName = clean(
    (record as any).businessName || farmer?.farmName || farmer?.businessName
  );

  const ownerName = clean(
    (record as any).ownerName || farmer?.ownerName || farmer?.name
  );

  const state = clean(
    (record as any).state || farmer?.state || farmer?.location || "MI"
  )
    .slice(0, 2)
    .toUpperCase();

  const idVerified = hasDocument(record, "government_id");

  const businessVerified =
    hasDocument(record, "business_registration") && Boolean(businessName);

  const einVerified =
    hasDocument(record, "ein_tax_document") || hasDocument(record, "ein_letter");

  const stateRegistrationVerified =
    hasDocument(record, "farm_license") ||
    hasDocument(record, "agriculture_registration") ||
    hasDocument(record, "state_registration");

  const insuranceVerified = hasDocument(record, "insurance");

  const foodPermitVerified =
    hasDocument(record, "food_permit") ||
    hasDocument(record, "food_license") ||
    hasDocument(record, "farmers_market_permit");

  const stripeDocumentVerified = hasDocument(record, "stripe_payout");

  const stripeAccountVerified = Boolean(
    farmer?.stripeAccountId ||
      farmer?.farmerStripeAccountId ||
      farmer?.stripePayoutAccount ||
      farmer?.stripeOnboardingComplete ||
      farmer?.stripePayoutsEnabled
  );

  const payoutVerified = stripeDocumentVerified && stripeAccountVerified;

  const agreementVerified = hasDocument(record, "pickup_delivery_agreement");

  const legalChecklistVerified = hasLegalChecklist(record);

  const noFraudFlags =
    Boolean(businessName) && Boolean(ownerName) && Boolean(state);

  addMissingIfFalse(idVerified, "Government ID is missing.", missingItems);
  addMissingIfFalse(
    businessVerified,
    "Business registration / LLC document is missing.",
    missingItems
  );
  addMissingIfFalse(einVerified, "EIN / tax document is missing.", missingItems);
  addMissingIfFalse(
    stateRegistrationVerified,
    "Farm license or agriculture registration is missing.",
    missingItems
  );
  addMissingIfFalse(insuranceVerified, "Insurance document is missing.", missingItems);
  addMissingIfFalse(foodPermitVerified, "Food permit is missing.", missingItems);
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
  const score = Math.round((passedCount / checks.length) * 100);

  const canAutoApprove = checks.every(Boolean) && missingItems.length === 0;

  const result: any = {
    farmerId: (record as any).farmerId,
    businessName,
    ownerName,
    state,
    status: canAutoApprove ? "approved" : "needs_more_info",
    score,
    idVerified,
    businessVerified,
    einVerified,
    stateRegistrationVerified,
    insuranceVerified,
    foodPermitVerified,
    agreementVerified,
    payoutVerified,
    noFraudFlags,
    missingItems,
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

  await saveComplianceResult((record as any).farmerId, result);

  await updateFarmerStore((record as any).farmerId, {
    approved: canAutoApprove,
    complianceStatus: canAutoApprove ? "approved" : "needs_more_info",
    complianceScore: score,
    complianceReviewedAt: result.reviewedAt,
  } as any);

  return result as ComplianceVerificationResult;
}