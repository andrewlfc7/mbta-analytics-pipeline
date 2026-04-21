from pydantic import BaseModel, Field
from typing import Optional


class HeatmapCell(BaseModel):
    day_of_week: str = Field(..., example="Monday")
    hour: int = Field(..., ge=0, le=23, example=8)
    avg_delay_minutes: float = Field(..., example=8.3)
    median_delay_minutes: float = Field(..., example=6.2)
    trip_count: int = Field(..., example=1247)
    pct_late: float = Field(
        ..., description="% of trips >5min late", example=48.2
    )
    predicted_delay_minutes: Optional[float] = Field(
        None, example=7.9
    )
    delay_probability: Optional[float] = Field(
        None, description="ML predicted probability of >5min delay",
        example=73.0,
    )
    risk_level: Optional[str] = Field(
        None, example="HIGH"
    )
    is_anomaly: bool = Field(
        default=False,
        description="True if >2x historical average for this slot",
    )


class HeatmapMetadata(BaseModel):
    route_id: str
    period: str
    direction: str
    total_trips_analyzed: int
    worst_cell: str = Field(..., example="Friday 5PM (14.2 min)")
    best_cell: str = Field(..., example="Sunday 5AM (0.2 min)")
    generated_at: str


class HeatmapResponse(BaseModel):
    data: list[HeatmapCell]
    metadata: HeatmapMetadata


class CellDetailStation(BaseModel):
    station_name: str
    avg_delay_minutes: float
    trip_count: int
    pct_late: float


class CellDetailHistory(BaseModel):
    date: str
    avg_delay_minutes: float


class CellDetailResponse(BaseModel):
    route_id: str
    day_of_week: str
    hour: int
    avg_delay_minutes: float
    median_delay_minutes: float
    trip_count: int
    pct_late: float
    predicted_delay_minutes: Optional[float]
    confidence: Optional[float]
    stations: list[CellDetailStation]
    history: list[CellDetailHistory]