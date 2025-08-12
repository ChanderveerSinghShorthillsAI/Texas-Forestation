from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class SpatialQueryRequest(BaseModel):
    """Request model for spatial queries"""
    longitude: float = Field(..., description="Longitude of the query point", ge=-180, le=180)
    latitude: float = Field(..., description="Latitude of the query point", ge=-90, le=90)
    max_distance_km: float = Field(100, description="Maximum distance in kilometers for nearest point search", gt=0, le=200)
    max_nearest_points: int = Field(10, description="Maximum number of nearest points to return", gt=0, le=1000)

class FeatureProperties(BaseModel):
    """Properties of a GeoJSON feature"""
    properties: Dict[str, Any]
    layer_id: str
    layer_name: str

class PolygonMatch(FeatureProperties):
    """A polygon that contains the query point"""
    pass

class NearestPoint(FeatureProperties):
    """A point feature near the query point"""
    distance_km: float = Field(..., description="Distance from query point in kilometers")
    distance_formatted: str = Field(..., description="Human-readable distance")

class QueryCoordinates(BaseModel):
    """Query point coordinates"""
    longitude: float
    latitude: float
    formatted: str

class SpatialQueryResponse(BaseModel):
    """Response model for spatial queries"""
    click_coordinates: QueryCoordinates
    polygon_matches: List[PolygonMatch]
    nearest_points: List[NearestPoint]
    query_timestamp: datetime
    query_duration_ms: float
    total_layers_searched: int
    
class LayerInfo(BaseModel):
    """Information about a spatial layer"""
    layer_id: str
    layer_name: str
    layer_type: str  # 'polygon', 'point', 'line'
    feature_count: int
    file_size_mb: float
    is_indexed: bool
    
class LayerStats(BaseModel):
    """Detailed statistics for a layer"""
    layer_id: str
    layer_name: str
    feature_count: int
    geometry_types: List[str]
    bounds: Optional[Dict[str, float]]  # min_lon, min_lat, max_lon, max_lat
    properties_sample: Optional[Dict[str, Any]] 

# === NEW MODELS FOR PLANTATION PLAN GENERATION ===

class PlanGenerationRequest(BaseModel):
    """Request model for generating plantation plans"""
    longitude: float = Field(..., description="Longitude of the location", ge=-180, le=180)
    latitude: float = Field(..., description="Latitude of the location", ge=-90, le=90)
    include_pdf: bool = Field(True, description="Whether to generate PDF along with plan data")
    plan_focus: Optional[str] = Field(None, description="Optional focus: 'agriculture', 'forestry', or 'mixed'")

class PlanGenerationSummary(BaseModel):
    """Summary of plan generation process"""
    knowledge_sources_used: int
    spatial_regions_analyzed: int
    nearby_features_considered: int
    estimated_plan_length: int
    plan_focus: str

class ImplementationReadiness(BaseModel):
    """Implementation readiness assessment"""
    total_score: int
    max_score: int
    percentage: float
    readiness_level: str
    factor_scores: Dict[str, int]
    recommendations: List[str]

class PlanUISummary(BaseModel):
    """Summary for UI display"""
    title: str
    location_summary: str
    plan_type: str
    estimated_pages: int
    readiness_score: float
    key_highlights: List[str]
    generated_at: str
    plan_id: str

class PlanGenerationResponse(BaseModel):
    """Response model for plan generation"""
    success: bool
    plan_data: Optional[Dict[str, Any]] = None
    pdf_path: Optional[str] = None
    error: Optional[str] = None
    generation_summary: Optional[PlanGenerationSummary] = None
    ui_summary: Optional[PlanUISummary] = None
    implementation_readiness: Optional[ImplementationReadiness] = None

class PlanStatusResponse(BaseModel):
    """Response model for plan status check"""
    plan_id: str
    status: str  # 'pending', 'processing', 'completed', 'failed'
    estimated_completion: Optional[datetime] = None
    progress_percentage: Optional[int] = None 