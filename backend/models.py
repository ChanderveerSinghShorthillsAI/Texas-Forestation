from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class SpatialQueryRequest(BaseModel):
    """Request model for spatial queries"""
    longitude: float = Field(..., description="Longitude of the query point", ge=-180, le=180)
    latitude: float = Field(..., description="Latitude of the query point", ge=-90, le=90)
    max_distance_km: float = Field(100, description="Maximum distance in kilometers for nearest point search", gt=0, le=200)
    max_nearest_points: int = Field(10, description="Maximum number of nearest points to return", gt=0, le=100)

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