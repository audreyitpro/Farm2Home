export const FARMER_ACCOUNT_FEE = 29.99;
export const FARMER_MONTHLY_FEE = 14.99;
export const SERVICE_FEE_RATE = 0.04;

export function calculateServiceFee(subtotal: number): number {
  return Number((subtotal * SERVICE_FEE_RATE).toFixed(2));
}

export function calculateFarmerPayout(subtotal: number): number {
  return Number((subtotal - calculateServiceFee(subtotal)).toFixed(2));
}