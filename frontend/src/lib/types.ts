export interface User { _id: string; name: string; email: string; role: "user" | "admin"; }

export interface AuthResponse { user: User; accessToken: string; refreshToken: string; }

export interface Listing {
  _id: string; title: string; city: string; locality: string;
  propertyType: "Apartment" | "Villa" | "Plot"; areaType?: string;
  availabilityStatus: string; totalSqft: number; bhk: number; bath: number;
  balcony: number; price: number; pricePerSqft: number;
  location?: { lat: number; lng: number }; images: string[];
  description: string; listedDate: string;
}

export interface Paginated<T> { items: T[]; page: number; limit: number; total: number; totalPages: number; }

export interface PredictionResult {
  predicted_price: number; confidence_low: number; confidence_high: number;
  confidence_interval_pct: number; price_per_sqft: number; currency: string;
  model_name: string; predictionId?: string;
}

export interface FeatureImportance { feature: string; importance: number; }

export interface LocalityEnums {
  categorical: Record<string, string[]>;
  numeric_ranges: Record<string, { min: number; max: number; median: number }>;
}

export interface TrendPoint { period: string; avgPrice: number; avgPricePerSqft: number; count: number; }

export interface CompareItem {
  listing: Listing; listedPrice: number; predictedPrice: number | null;
  confidenceLow: number | null; confidenceHigh: number | null;
  deal: { verdict: "underpriced" | "overpriced" | "fair" | "unknown"; deltaPct: number | null };
}

export interface DealResult {
  listedPrice: number; predictedPrice: number; confidenceLow: number;
  confidenceHigh: number;
  deal: { verdict: "underpriced" | "overpriced" | "fair" | "unknown"; deltaPct: number | null };
}

export interface AdminStats {
  totals: { listings: number; predictions: number; users: number };
  topSearchedLocalities: { locality: string; searches: number; avgPredicted: number }[];
}

export interface SavedSearch {
  _id: string; name: string; filters: Record<string, unknown>;
  matchCount: number; newMatches: number; createdAt: string;
}

export interface RankingItem { locality: string; avgPricePerSqft: number; listings: number; }
