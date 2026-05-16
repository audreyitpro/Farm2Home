import AsyncStorage from "@react-native-async-storage/async-storage";

export type ComplianceStatus = "Pass" | "Needs Review" | "Fail";

export type ComplianceFinding = {
  id: string;
  farmerId: string;
  farmName: string;
  uploadedDocumentName: string;
  aiStatus: ComplianceStatus;
  findings: string[];
  missingItems: string[];
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
};

const COMPLIANCE_FINDINGS_KEY = "farm2homeComplianceFindings";

function normalizeComplianceFinding(
  finding: Partial<ComplianceFinding>
): ComplianceFinding {
  const now = new Date().toISOString();

  return {
    id: String(finding.id || `compliance_${Date.now()}`),
    farmerId: String(finding.farmerId || ""),
    farmName: String(finding.farmName || ""),
    uploadedDocumentName: String(finding.uploadedDocumentName || ""),
    aiStatus: finding.aiStatus || "Needs Review",
    findings: Array.isArray(finding.findings) ? finding.findings : [],
    missingItems: Array.isArray(finding.missingItems)
      ? finding.missingItems
      : [],
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

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeComplianceFinding);
  } catch (error) {
    console.log("Get compliance findings error:", error);
    return [];
  }
}

export async function saveComplianceFinding(
  finding: Partial<ComplianceFinding>
): Promise<ComplianceFinding[]> {
  const findings = await getComplianceFindings();

  const newFinding = normalizeComplianceFinding({
    ...finding,
    id: finding.id || `compliance_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const updatedFindings = [newFinding, ...findings];

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