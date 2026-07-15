from typing import Optional
from pydantic import BaseModel, Field, field_validator

AREA_TYPES = ["Super built-up Area", "Built-up Area", "Plot Area", "Carpet Area"]
AVAILABILITY = ["Ready To Move", "Under Construction"]


class PredictionRequest(BaseModel):
    """Bengaluru schema (active dataset). Location is a free string validated
    against the model's known localities at inference (unknowns handled by the
    encoder's ignore policy)."""
    location: str = Field(..., examples=["Whitefield"])
    area_type: str = Field("Super built-up Area")
    availability_status: str = Field("Ready To Move")
    total_sqft: float = Field(..., gt=100, lt=50000)
    bhk: int = Field(..., ge=1, le=20)
    bath: int = Field(..., ge=1, le=20)
    balcony: int = Field(0, ge=0, le=10)

    @field_validator("area_type")
    @classmethod
    def _a(cls, v):
        if v not in AREA_TYPES:
            raise ValueError(f"area_type must be one of {AREA_TYPES}")
        return v

    @field_validator("availability_status")
    @classmethod
    def _av(cls, v):
        if v not in AVAILABILITY:
            raise ValueError(f"availability_status must be one of {AVAILABILITY}")
        return v


class PredictionResponse(BaseModel):
    predicted_price: int
    confidence_low: int
    confidence_high: int
    confidence_interval_pct: int
    price_per_sqft: int
    currency: str = "INR"
    model_name: str


class FeatureImportanceItem(BaseModel):
    feature: str
    importance: float


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_name: Optional[str] = None
