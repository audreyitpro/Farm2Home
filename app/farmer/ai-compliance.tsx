import AsyncStorage from "@react-native-async-storage/async-storage";

export type ComplianceStatus = "Pass" | "Needs Review" | "Fail";

export type MarketApprovalStatus =
  | "Approved"
  | "Needs Review"
  | "Blocked";

export type FarmerMarketArea =
  | "Farm Profile"
  | "Product Listings"
  | "Bundles"
  | "Meat & Seafood"
  | "Local Delivery"
  | "Shipping"
  | "Subscriptions"
  | "Stripe Payouts";

export type ComplianceFinding = {
  id: string;
  farmerId: string;
  farmName: string;

  uploadedDocumentName: string;
  documentType: string;

  aiStatus: ComplianceStatus;
  marketApprovalStatus: MarketApprovalStatus;

  marketAreas: FarmerMarketArea[];

  findings: string[];
  missingItems: string[];
  recommendedActions: string[];

  canListProducts: boolean;
  canCreateBundles: boolean;
  canSellMeatSeafood: boolean;
  canOfferDelivery: boolean;
  canOfferShipping: boolean;
  canUseSubscriptions: boolean;

  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
};

const COMPLIANCE_FINDINGS_KEY = "farm2homeComplianceFindings";

function normalizeArray(value: any): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item)).filter(Boolean)
    : [];
}

function resolveMarketApprovalStatus(
  status: ComplianceStatus
): MarketApprovalStatus {
  if (status === "Pass") return "Approved";
  if (status === "Fail") return "Blocked";
  return "Needs Review";
}

function normalizeComplianceFinding(
  finding: Partial<ComplianceFinding>
): ComplianceFinding {
  const now = new Date().toISOString();
  const aiStatus = finding.aiStatus || "Needs Review";

  return {
    id: String(finding.id || `compliance_${Date.now()}`),
    farmerId: String(finding.farmerId || ""),
    farmName: String(finding.farmName || ""),

    uploadedDocumentName: String(finding.uploadedDocumentName || ""),
    documentType: String(finding.documentType || "Farmer Market Document"),

    aiStatus,
    marketApprovalStatus:
      finding.marketApprovalStatus || resolveMarketApprovalStatus(aiStatus),

    marketAreas: Array.isArray(finding.marketAreas)
      ? finding.marketAreas
      : ["Farm Profile"],

    findings: normalizeArray(finding.findings),
    missingItems: normalizeArray(finding.missingItems),
    recommendedActions: normalizeArray(finding.recommendedActions),

    canListProducts: Boolean(finding.canListProducts ?? aiStatus === "Pass"),
    canCreateBundles: Boolean(finding.canCreateBundles ?? aiStatus === "Pass"),
    canSellMeatSeafood: Boolean(
      finding.canSellMeatSeafood ?? aiStatus === "Pass"
    ),
    canOfferDelivery: Boolean(finding.canOfferDelivery ?? aiStatus === "Pass"),
    canOfferShipping: Boolean(finding.canOfferShipping ?? aiStatus === "Pass"),
    canUseSubscriptions: Boolean(
      finding.canUseSubscriptions ?? aiStatus === "Pass"
    ),

    reviewedAt: String(finding.reviewedAt || new Date().toLocaleString()),
    createdAt: String(finding.createdAt || now),
    updatedAt: String(finding.updatedAt || now),
  };
}

async function saveComplianceFindings(findings: ComplianceFinding[]) {
  await AsyncStorage.setItem(
    COMPLIANCE_FINDINGS_KEY,
    JSON.stringify(findings)
  );
}

export async function getComplianceFindings(): Promise<ComplianceFinding[]> {
  try {
    const raw = await AsyncStorage.getItem(COMPLIANCE_FINDINGS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(normalizeComplianceFinding);
  } catch (error) {
    console.log("Get compliance findings error:", error);
    return [];
  }
}

export async function getFarmerComplianceFindings(
  farmerId: string
): Promise<ComplianceFinding[]> {
  const findings = await getComplianceFindings();
  return findings.filter((finding) => finding.farmerId === farmerId);
}

export async function getFarmerMarketComplianceSummary(farmerId: string) {
  const findings = await getFarmerComplianceFindings(farmerId);

  const hasFail = findings.some((item) => item.aiStatus === "Fail");
  const hasReview = findings.some((item) => item.aiStatus === "Needs Review");
  const hasPass = findings.some((item) => item.aiStatus === "Pass");

  const latestFinding = findings[0];

  return {
    farmerId,
    totalFindings: findings.length,
    latestFinding,
    marketApprovalStatus: hasFail
      ? "Blocked"
      : hasReview
      ? "Needs Review"
      : hasPass
      ? "Approved"
      : "Needs Review",

    canListProducts:
      findings.length > 0 && findings.every((item) => item.canListProducts),
    canCreateBundles:
      findings.length > 0 && findings.every((item) => item.canCreateBundles),
    canSellMeatSeafood:
      findings.length > 0 && findings.every((item) => item.canSellMeatSeafood),
    canOfferDelivery:
      findings.length > 0 && findings.every((item) => item.canOfferDelivery),
    canOfferShipping:
      findings.length > 0 && findings.every((item) => item.canOfferShipping),
    canUseSubscriptions:
      findings.length > 0 && findings.every((item) => item.canUseSubscriptions),

    missingItems: findings.flatMap((item) => item.missingItems),
    recommendedActions: findings.flatMap((item) => item.recommendedActions),
  };
}

export async function saveComplianceFinding(
  finding: Partial<ComplianceFinding>
): Promise<ComplianceFinding[]> {
  const findings = await getComplianceFindings();

  const newFinding = normalizeComplianceFinding({
    ...finding,
    id: finding.id || `compliance_${Date.now()}`,
    createdAt: finding.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const updatedFindings = [
    newFinding,
    ...findings.filter((item) => item.id !== newFinding.id),
  ];

  await saveComplianceFindings(updatedFindings);
  return updatedFindings;
}

export async function updateComplianceFinding(
  id: string,
  updates: Partial<ComplianceFinding>
): Promise<ComplianceFinding[]> {
  const findings = await getComplianceFindings();

  const updatedFindings = findings.map((finding) =>
    finding.id === id
      ? normalizeComplianceFinding({
          ...finding,
          ...updates,
          id,
          updatedAt: new Date().toISOString(),
        })
      : finding
  );

  await saveComplianceFindings(updatedFindings);
  return updatedFindings;
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