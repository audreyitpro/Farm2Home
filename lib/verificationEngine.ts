export type VerificationStatus =
  | "verified"
  | "partially_verified"
  | "needs_manual_review"
  | "rejected"
  | "expired"
  | "fraud_risk";

export type VerificationResult = {
  documentName: string;
  status: VerificationStatus;
  score: number;
  findings: string[];
  nextAction: string;
};

function hasText(value: string) {
  return value.trim().length > 0;
}

function containsAny(value: string, keywords: string[]) {
  const clean = value.toLowerCase();
  return keywords.some((word) => clean.includes(word.toLowerCase()));
}

function hasExpiration(value: string) {
  return /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-](20\d{2})\b/.test(
    value
  );
}

function hasNumber(value: string) {
  return /\d/.test(value);
}

export function verifyBusinessRegistration(value: string): VerificationResult {
  const findings: string[] = [];
  let score = 0;

  if (hasText(value)) {
    score += 25;
    findings.push("Business registration information was provided.");
  }

  if (containsAny(value, ["llc", "dba", "inc", "company", "registration"])) {
    score += 25;
    findings.push("Business entity language detected.");
  }

  if (hasNumber(value)) {
    score += 25;
    findings.push("Registration or filing number detected.");
  }

  if (containsAny(value, ["michigan", "mi", "state", "secretary"])) {
    score += 25;
    findings.push("State registration reference detected.");
  }

  return buildResult("Business Registration", score, findings);
}

export function verifySalesTax(value: string): VerificationResult {
  const findings: string[] = [];
  let score = 0;

  if (hasText(value)) {
    score += 30;
    findings.push("Sales tax or exemption information was provided.");
  }

  if (containsAny(value, ["sales tax", "exemption", "permit", "tax id"])) {
    score += 35;
    findings.push("Sales tax / exemption language detected.");
  }

  if (hasNumber(value)) {
    score += 35;
    findings.push("Permit or tax reference number detected.");
  }

  return buildResult("Sales Tax / Exemption Form", score, findings);
}

export function verifyFoodSafety(value: string): VerificationResult {
  const findings: string[] = [];
  let score = 0;

  if (hasText(value)) {
    score += 25;
    findings.push("Food safety registration information was provided.");
  }

  if (containsAny(value, ["food safety", "license", "health", "inspection"])) {
    score += 30;
    findings.push("Food safety / license language detected.");
  }

  if (hasNumber(value)) {
    score += 20;
    findings.push("License or registration number detected.");
  }

  if (hasExpiration(value)) {
    score += 25;
    findings.push("Expiration date detected.");
  }

  return buildResult("Food Safety Registration", score, findings);
}

export function verifyW9(value: string): VerificationResult {
  const findings: string[] = [];
  let score = 0;

  if (hasText(value)) {
    score += 25;
    findings.push("W-9 information was provided.");
  }

  if (containsAny(value, ["w-9", "w9", "ein", "tin", "legal name"])) {
    score += 35;
    findings.push("W-9 / EIN / TIN language detected.");
  }

  if (hasNumber(value)) {
    score += 25;
    findings.push("Tax ID style number detected.");
  }

  if (containsAny(value, ["signature", "signed"])) {
    score += 15;
    findings.push("Signature reference detected.");
  }

  return buildResult("W-9 Form", score, findings);
}

export function verifyInsurance(value: string): VerificationResult {
  const findings: string[] = [];
  let score = 0;

  if (hasText(value)) {
    score += 25;
    findings.push("Insurance information was provided.");
  }

  if (containsAny(value, ["insurance", "liability", "policy", "coverage"])) {
    score += 35;
    findings.push("Liability insurance language detected.");
  }

  if (hasNumber(value)) {
    score += 20;
    findings.push("Policy or coverage number detected.");
  }

  if (hasExpiration(value)) {
    score += 20;
    findings.push("Expiration date detected.");
  }

  return buildResult("Liability Insurance", score, findings);
}

function buildResult(
  documentName: string,
  score: number,
  findings: string[]
): VerificationResult {
  if (score >= 85) {
    return {
      documentName,
      status: "verified",
      score,
      findings,
      nextAction: "Ready for Farm2Home admin approval.",
    };
  }

  if (score >= 60) {
    return {
      documentName,
      status: "partially_verified",
      score,
      findings,
      nextAction: "Admin should review supporting document upload.",
    };
  }

  if (score >= 30) {
    return {
      documentName,
      status: "needs_manual_review",
      score,
      findings,
      nextAction: "Farmer may need to provide more detail or clearer document.",
    };
  }

  return {
    documentName,
    status: "rejected",
    score,
    findings: findings.length ? findings : ["Not enough information provided."],
    nextAction: "Request corrected document from farmer.",
  };
}

export function runFullVerification(freightMarketplace: {
  businessRegistration: string;
  salesTaxForm: string;
  foodSafetyRegistration: string;
  w9Form: string;
  liabilityInsurance: string;
}) {
  const results = [
    verifyBusinessRegistration(freightMarketplace.businessRegistration),
    verifySalesTax(freightMarketplace.salesTaxForm),
    verifyFoodSafety(freightMarketplace.foodSafetyRegistration),
    verifyW9(freightMarketplace.w9Form),
    verifyInsurance(freightMarketplace.liabilityInsurance),
  ];

  const averageScore = Math.round(
    results.reduce((sum, item) => sum + item.score, 0) / results.length
  );

  const allVerified = results.every((item) => item.status === "verified");

  return {
    results,
    averageScore,
    overallStatus: allVerified ? "verified" : "needs_manual_review",
    adminDecisionRequired: true,
  };
}
