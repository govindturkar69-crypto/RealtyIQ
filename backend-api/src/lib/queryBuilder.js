export function buildListingQuery(q = {}) {
  const filter = {};
  if (q.locality) filter.locality = new RegExp(`^${escapeRegex(q.locality)}$`, "i");
  if (q.city) filter.city = new RegExp(`^${escapeRegex(q.city)}$`, "i");
  if (q.propertyType) filter.propertyType = q.propertyType;
  if (q.areaType) filter.areaType = q.areaType;
  if (q.bhk !== undefined) filter.bhk = Number(q.bhk);
  const price = {};
  if (q.minPrice !== undefined) price.$gte = Number(q.minPrice);
  if (q.maxPrice !== undefined) price.$lte = Number(q.maxPrice);
  if (Object.keys(price).length) filter.price = price;
  const sqft = {};
  if (q.minSqft !== undefined) sqft.$gte = Number(q.minSqft);
  if (q.maxSqft !== undefined) sqft.$lte = Number(q.maxSqft);
  if (Object.keys(sqft).length) filter.totalSqft = sqft;
  if (q.search) filter.$or = [
    { title: new RegExp(escapeRegex(q.search), "i") },
    { locality: new RegExp(escapeRegex(q.search), "i") },
  ];
  return filter;
}

export function buildSort(sortKey = "newest") {
  switch (sortKey) {
    case "price_asc": return { price: 1 };
    case "price_desc": return { price: -1 };
    case "sqft_desc": return { totalSqft: -1 };
    case "ppsf_asc": return { pricePerSqft: 1 };
    case "newest":
    default: return { listedDate: -1 };
  }
}

export function paginate({ page = 1, limit = 12 } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 12));
  return { page: p, limit: l, skip: (p - 1) * l };
}

export function escapeRegex(s = "") {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
