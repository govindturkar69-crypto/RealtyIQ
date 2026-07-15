export function buildTrendPipeline({ locality, propertyType, city, months = 24 } = {}) {
  const match = {};
  if (locality) match.locality = locality;
  if (propertyType) match.propertyType = propertyType;
  if (city) match.city = city;
  if (months) {
    const from = new Date();
    from.setMonth(from.getMonth() - Number(months));
    match.listedDate = { $gte: from };
  }
  return [
    { $match: match },
    { $group: {
        _id: { y: { $year: "$listedDate" }, m: { $month: "$listedDate" } },
        avgPrice: { $avg: "$price" },
        avgPricePerSqft: { $avg: "$pricePerSqft" },
        count: { $sum: 1 },
    } },
    { $sort: { "_id.y": 1, "_id.m": 1 } },
    { $project: {
        _id: 0,
        period: { $concat: [
          { $toString: "$_id.y" }, "-",
          { $cond: [{ $lt: ["$_id.m", 10] }, { $concat: ["0", { $toString: "$_id.m" }] }, { $toString: "$_id.m" }] },
        ] },
        avgPrice: { $round: ["$avgPrice", 0] },
        avgPricePerSqft: { $round: ["$avgPricePerSqft", 0] },
        count: 1,
    } },
  ];
}

export function buildLocalityRankingPipeline({ limit = 10 } = {}) {
  return [
    { $group: { _id: "$locality", avgPricePerSqft: { $avg: "$pricePerSqft" }, listings: { $sum: 1 } } },
    { $match: { listings: { $gte: 3 } } },
    { $sort: { avgPricePerSqft: -1 } },
    { $limit: Number(limit) },
    { $project: { _id: 0, locality: "$_id", avgPricePerSqft: { $round: ["$avgPricePerSqft", 0] }, listings: 1 } },
  ];
}
