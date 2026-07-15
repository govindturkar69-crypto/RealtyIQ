export interface EmiResult {
  emi: number;
  principal: number;
  totalInterest: number;
  totalPayment: number;
}

export function computeEmi(price: number, downPaymentPct: number, annualRatePct: number, years: number): EmiResult {
  const principal = Math.max(0, price * (1 - downPaymentPct / 100));
  const r = annualRatePct / 12 / 100;
  const n = Math.max(1, years * 12);
  const emi = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPayment = emi * n;
  return {
    emi: Math.round(emi),
    principal: Math.round(principal),
    totalPayment: Math.round(totalPayment),
    totalInterest: Math.round(totalPayment - principal),
  };
}
