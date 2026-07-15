export const LOCALITY_GEO = {
  "Whitefield": { lat: 12.9698, lng: 77.7500 },
  "Electronic City": { lat: 12.8452, lng: 77.6602 },
  "Marathahalli": { lat: 12.9569, lng: 77.7011 },
  "Sarjapur Road": { lat: 12.9010, lng: 77.6870 },
  "Indira Nagar": { lat: 12.9719, lng: 77.6412 },
  "Koramangala": { lat: 12.9352, lng: 77.6245 },
  "HSR Layout": { lat: 12.9116, lng: 77.6389 },
  "Jayanagar": { lat: 12.9250, lng: 77.5938 },
  "Hebbal": { lat: 13.0358, lng: 77.5970 },
  "Yelahanka": { lat: 13.1007, lng: 77.5963 },
  "JP Nagar": { lat: 12.9081, lng: 77.5831 },
  "Bannerghatta Road": { lat: 12.8882, lng: 77.5970 },
  "KR Puram": { lat: 13.0075, lng: 77.6957 },
  "Bellandur": { lat: 12.9260, lng: 77.6762 },
};
const CENTER = { lat: 12.9716, lng: 77.5946 };

export function geoFor(locality) {
  if (LOCALITY_GEO[locality]) return LOCALITY_GEO[locality];
  let h = 0;
  for (const c of locality || "x") h = (h * 31 + c.charCodeAt(0)) % 10000;
  return { lat: CENTER.lat + ((h % 100) - 50) / 500, lng: CENTER.lng + ((Math.floor(h / 100) % 100) - 50) / 500 };
}
