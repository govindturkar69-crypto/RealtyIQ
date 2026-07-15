export function computeDealVerdict(listedPrice, predictedPrice, tolerance = 0.07) {
  if (!listedPrice || !predictedPrice) return { verdict: "unknown", deltaPct: null };
  const deltaPct = (listedPrice - predictedPrice) / predictedPrice;
  let verdict;
  if (deltaPct <= -tolerance) verdict = "underpriced";
  else if (deltaPct >= tolerance) verdict = "overpriced";
  else verdict = "fair";
  return { verdict, deltaPct: Number((deltaPct * 100).toFixed(2)) };
}
