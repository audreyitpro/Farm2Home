export type PricingPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type DemandLevel = "LOW" | "NORMAL" | "HIGH";

export type FreightPricingInput = {
  baseRate: number;
  distanceMiles?: number;
  weightLbs?: number;
  temperatureControlled?: boolean;
  priority?: PricingPriority;
  demandLevel?: DemandLevel;
};

export type FreightPricingResult = {
  suggestedRate: number;
  multiplier: number;
  reasons: string[];
};

export type ProducePricingInput = {
  basePrice: number;
  inventory?: number;
  demandLevel?: DemandLevel;
  organic?: boolean;
};

export type ProducePricingResult = {
  suggestedPrice: number;
  multiplier: number;
  reasons: string[];
};

export function calculateDynamicFreightPrice(
  input: FreightPricingInput
): FreightPricingResult {
  let multiplier = 1;
  const reasons: string[] = [];

  const baseRate = Number(input.baseRate || 0);
  const distanceMiles = Number(input.distanceMiles || 0);
  const weightLbs = Number(input.weightLbs || 0);

  if (distanceMiles > 250) {
    multiplier += 0.12;
    reasons.push("Long-distance route");
  }

  if (distanceMiles > 500) {
    multiplier += 0.08;
    reasons.push("Extended route mileage");
  }

  if (weightLbs > 2000) {
    multiplier += 0.1;
    reasons.push("Heavy load");
  }

  if (weightLbs > 5000) {
    multiplier += 0.12;
    reasons.push("High-weight freight handling");
  }

  if (input.temperatureControlled) {
    multiplier += 0.18;
    reasons.push("Temperature-controlled handling");
  }

  if (input.priority === "HIGH") {
    multiplier += 0.15;
    reasons.push("High-priority load");
  }

  if (input.priority === "CRITICAL") {
    multiplier += 0.25;
    reasons.push("Critical load");
  }

  if (input.demandLevel === "HIGH") {
    multiplier += 0.12;
    reasons.push("High marketplace demand");
  }

  if (input.demandLevel === "LOW") {
    multiplier -= 0.05;
    reasons.push("Low marketplace demand adjustment");
  }

  const suggestedRate = Math.max(0, baseRate * multiplier);

  return {
    suggestedRate: Number(suggestedRate.toFixed(2)),
    multiplier: Number(multiplier.toFixed(2)),
    reasons: reasons.length ? reasons : ["Standard freight pricing"],
  };
}

export function calculateProducePriceSuggestion(
  input: ProducePricingInput
): ProducePricingResult {
  let multiplier = 1;
  const reasons: string[] = [];

  const basePrice = Number(input.basePrice || 0);
  const inventory = Number(input.inventory || 0);

  if (inventory <= 5) {
    multiplier += 0.1;
    reasons.push("Low inventory");
  }

  if (inventory <= 2) {
    multiplier += 0.08;
    reasons.push("Very limited supply");
  }

  if (input.demandLevel === "HIGH") {
    multiplier += 0.12;
    reasons.push("High customer demand");
  }

  if (input.demandLevel === "LOW") {
    multiplier -= 0.08;
    reasons.push("Low demand adjustment");
  }

  if (input.organic) {
    multiplier += 0.15;
    reasons.push("Organic premium");
  }

  const suggestedPrice = Math.max(0, basePrice * multiplier);

  return {
    suggestedPrice: Number(suggestedPrice.toFixed(2)),
    multiplier: Number(multiplier.toFixed(2)),
    reasons: reasons.length ? reasons : ["Standard produce pricing"],
  };
}