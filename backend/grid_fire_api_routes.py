"""
Grid Fire API Routes
API endpoints for the Texas-wide grid-based fire prediction system
"""
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime

from texas_grid_service import texas_grid_service
from batch_weather_service import batch_weather_service

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/grid-fire", tags=["grid-fire"])

# Pydantic models for API requests/responses
class GridUpdateRequest(BaseModel):
    use_strategic_points: bool = Field(default=True, description="Use strategic subset of grid points")
    use_regional_representatives: bool = Field(default=False, description="Use regional representatives for full Texas coverage with minimal API calls")
    density_factor: float = Field(default=0.1, ge=0.01, le=1.0, description="Fraction of grid cells to process")
    forecast_days: int = Field(default=7, ge=1, le=16, description="Number of forecast days")

class GridStatisticsResponse(BaseModel):
    total_grid_cells: int
    cached_predictions: int
    coverage_percentage: float
    last_update: Optional[str]
    risk_statistics: Dict[str, float]
    risk_category_distribution: Dict[str, int]
    high_risk_areas: int

class GridUpdateResponse(BaseModel):
    success: bool
    processed_cells: int
    successful_computations: int
    processing_time_seconds: float
    statistics: Dict[str, Any]
    update_timestamp: str
    coverage_strategy: str
    density_factor: float

class FireRiskGeoJSONResponse(BaseModel):
    type: str
    features: List[Dict[str, Any]]
    metadata: Dict[str, Any]

@router.get("/health")
async def grid_fire_health():
    """Health check for grid fire prediction system"""
    try:
        # Check if grid service is working
        if not texas_grid_service.load_grid_cells():
            return {"status": "unhealthy", "error": "Cannot load grid cells"}
        
        stats = texas_grid_service.get_grid_statistics()
        
        return {
            "status": "healthy",
            "service_name": "Texas Grid Fire Prediction System",
            "total_grid_cells": stats.get("total_grid_cells", 0),
            "cached_predictions": stats.get("cached_predictions", 0),
            "last_update": stats.get("last_update"),
            "version": "1.0.0",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Grid fire health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@router.get("/statistics", response_model=GridStatisticsResponse)
async def get_grid_statistics():
    """
    Get statistics about the grid fire prediction system
    
    Returns information about:
    - Total grid cells
    - Cached predictions
    - Coverage percentage
    - Risk statistics
    - Category distribution
    """
    try:
        stats = texas_grid_service.get_grid_statistics()
        
        if "error" in stats:
            raise HTTPException(status_code=500, detail=stats["error"])
        
        return GridStatisticsResponse(**stats)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting grid statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")

@router.post("/update", response_model=GridUpdateResponse)
async def update_fire_grid(request: GridUpdateRequest, background_tasks: BackgroundTasks):
    """
    Update fire risk data for the Texas grid
    
    This endpoint triggers a comprehensive update of fire risk data across Texas.
    The update can be configured to use:
    - Strategic points: Process a subset of grid cells for faster updates
    - Full grid: Process all grid cells for complete coverage
    
    The update runs in the background and returns immediately with a summary.
    """
    try:
        logger.info(f"Starting grid fire update with strategy: {'strategic' if request.use_strategic_points else 'full'}")
        
        # Run the update
        result = await batch_weather_service.update_texas_fire_grid(
            use_strategic_points=request.use_strategic_points,
            use_regional_representatives=request.use_regional_representatives,
            density_factor=request.density_factor
        )
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return GridUpdateResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating fire grid: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Grid update failed: {str(e)}")

@router.get("/update/quick")
async def quick_update_fire_grid():
    """
    Quick update using strategic points only
    
    This endpoint provides a fast way to update fire risk data using
    a strategic subset of grid points (~10% of total cells).
    Ideal for frequent updates.
    """
    try:
        result = await batch_weather_service.update_texas_fire_grid(
            use_strategic_points=True,
            density_factor=0.1
        )
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return result
        
    except Exception as e:
        logger.error(f"Error in quick grid update: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Quick update failed: {str(e)}")

@router.get("/geojson")
async def get_fire_risk_geojson(
    risk_threshold: float = Query(default=40.0, ge=0.0, le=100.0, description="Minimum risk score to include"),
    format_type: str = Query(default="geojson", regex="^(geojson|simplified)$", description="Output format")
):
    """
    Get fire risk data in GeoJSON format for map visualization
    
    This endpoint returns fire risk data formatted as GeoJSON, suitable for
    displaying on interactive maps. The data includes:
    - Fire risk scores and categories
    - Weather conditions
    - Geographic coordinates
    
    Parameters:
    - risk_threshold: Only include points with risk score >= threshold
    - format_type: 'geojson' for full data, 'simplified' for minimal data
    """
    try:
        geojson_data = texas_grid_service.get_fire_risk_geojson(risk_threshold)
        
        if format_type == "simplified":
            # Reduce data size for faster loading
            for feature in geojson_data.get("features", []):
                props = feature.get("properties", {})
                # Keep only essential properties
                simplified_props = {
                    "fire_risk_score": props.get("fire_risk_score"),
                    "risk_category": props.get("risk_category"),
                    "risk_color": props.get("risk_color")
                }
                feature["properties"] = simplified_props
        
        return geojson_data
        
    except Exception as e:
        logger.error(f"Error generating fire risk GeoJSON: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate GeoJSON: {str(e)}")

@router.get("/high-risk-areas")
async def get_high_risk_areas(
    risk_threshold: float = Query(default=60.0, ge=0.0, le=100.0, description="Minimum risk score for high risk"),
    limit: int = Query(default=50, ge=1, le=500, description="Maximum number of areas to return")
):
    """
    Get high-risk fire areas across Texas
    
    Returns a list of grid cells with fire risk above the specified threshold,
    sorted by risk score in descending order.
    """
    try:
        cached_risks = texas_grid_service.get_cached_fire_risk()
        
        # Filter and sort high-risk areas
        high_risk_areas = [
            {
                "grid_index": risk.grid_index,
                "latitude": risk.lat,
                "longitude": risk.lng,
                "fire_risk_score": risk.fire_risk_score,
                "risk_category": risk.risk_category,
                "risk_color": risk.risk_color,
                "max_risk_24h": risk.max_risk_24h,
                "avg_risk_24h": risk.avg_risk_24h,
                "forecast_time": risk.forecast_timestamp.isoformat(),
                "weather": {
                    "temperature": risk.weather_data.get("temperature_2m"),
                    "humidity": risk.weather_data.get("relative_humidity_2m"),
                    "wind_speed": risk.weather_data.get("wind_speed_10m"),
                    "precipitation": risk.weather_data.get("precipitation")
                }
            }
            for risk in cached_risks
            if risk.fire_risk_score >= risk_threshold
        ]
        
        # Sort by risk score (highest first) and limit results
        high_risk_areas.sort(key=lambda x: x["fire_risk_score"], reverse=True)
        high_risk_areas = high_risk_areas[:limit]
        
        return {
            "high_risk_areas": high_risk_areas,
            "total_found": len(high_risk_areas),
            "risk_threshold": risk_threshold,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting high-risk areas: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get high-risk areas: {str(e)}")

@router.post("/update/full-texas")
async def update_full_texas_grid(background_tasks: BackgroundTasks):
    """
    Update fire risk data for COMPLETE Texas coverage using regional representatives
    
    This endpoint uses ~300 carefully selected regional representatives instead of
    all 26,824+ grid cells, providing 100% Texas coverage with 99% fewer API calls.
    
    Returns immediately with operation details, actual processing happens in background.
    """
    try:
        logger.info("Starting Texas regional representatives update (Complete coverage with minimal API calls)")
        
        # Start the regional update in background using the new approach
        background_tasks.add_task(
            batch_weather_service.update_texas_fire_grid,
            use_strategic_points=False,
            use_regional_representatives=True,
            density_factor=1.0
        )
        
        # Clear old cache and get fresh statistics for regional approach
        try:
            # Clear the old cache since we're switching to regional representatives
            texas_grid_service.clear_cache()
            current_stats = {"cached_predictions": 0, "total_grid_cells": 300}
        except:
            current_stats = {"cached_predictions": 0, "total_grid_cells": 300}
        
        return {
            "success": True,
            "message": "Texas regional representatives update started",
            "coverage_target": "100% of Texas (Regional Representatives)",
            "estimated_cells": 300,  # Regional representatives instead of all cells
            "current_cached_cells": current_stats.get("cached_predictions", 0),
            "processing_mode": "regional_representatives",
            "estimated_time_minutes": "1-3",  # Much faster with fewer API calls
            "api_efficiency": "99% reduction in API calls",
            "started_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error starting full Texas grid update: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start full update: {str(e)}")

@router.get("/update/progress")
async def get_update_progress():
    """
    Get progress information for ongoing grid updates
    
    Returns current progress and statistics for any running grid updates.
    """
    try:
        # Get current cache statistics
        stats = texas_grid_service.get_grid_statistics()
        
        # Handle error case
        if "error" in stats:
            raise HTTPException(status_code=500, detail=stats["error"])
        
        # Check if we're using regional representatives (much smaller total)
        cached_count = stats.get("cached_predictions", 0)
        
        # If we have very few cached predictions, we're likely using regional approach
        if cached_count <= 500:
            total_cells = 300  # Regional representatives
            coverage_percentage = (cached_count / total_cells) * 100 if total_cells > 0 else 0
        else:
            # Old full grid approach
            total_cells = stats.get("total_grid_cells", 26824)
            coverage_percentage = stats.get("coverage_percentage", 0)
        
        return {
            "current_coverage": {
                "cached_predictions": cached_count,
                "total_grid_cells": total_cells,
                "coverage_percentage": coverage_percentage,
                "last_update": stats.get("last_update")
            },
            "system_status": "operational",
            "timestamp": datetime.utcnow().isoformat(),
            "approach": "regional_representatives" if total_cells <= 500 else "full_grid"
        }
        
    except Exception as e:
        logger.error(f"Error getting update progress: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get progress: {str(e)}")

@router.get("/risk-by-region")
async def get_risk_by_region():
    """
    Get fire risk statistics by Texas regions
    
    Returns fire risk data grouped by major Texas regions:
    - East Texas (forests)
    - Central Texas (hill country)
    - West Texas (desert/plains)
    - South Texas (brush country)
    - Panhandle (grasslands)
    """
    try:
        cached_risks = texas_grid_service.get_cached_fire_risk()
        
        # Define Texas regions
        regions = {
            "East Texas": {"lat_range": (31.0, 33.5), "lng_range": (-95.5, -93.5)},
            "Central Texas": {"lat_range": (29.5, 31.0), "lng_range": (-99.0, -97.0)},
            "West Texas": {"lat_range": (31.0, 33.0), "lng_range": (-104.0, -100.0)},
            "South Texas": {"lat_range": (26.0, 29.0), "lng_range": (-99.5, -97.0)},
            "Panhandle": {"lat_range": (34.0, 36.5), "lng_range": (-103.0, -100.0)},
            "Gulf Coast": {"lat_range": (25.8, 30.0), "lng_range": (-97.5, -93.5)},
            "Hill Country": {"lat_range": (29.0, 31.5), "lng_range": (-100.0, -97.5)}
        }
        
        regional_stats = {}
        
        for region_name, bounds in regions.items():
            region_risks = []
            for risk in cached_risks:
                lat_range = bounds["lat_range"]
                lng_range = bounds["lng_range"]
                
                if (lat_range[0] <= risk.lat <= lat_range[1] and
                    lng_range[0] <= risk.lng <= lng_range[1]):
                    region_risks.append(risk)
            
            if region_risks:
                risk_scores = [r.fire_risk_score for r in region_risks]
                categories = {}
                for risk in region_risks:
                    cat = risk.risk_category
                    categories[cat] = categories.get(cat, 0) + 1
                
                regional_stats[region_name] = {
                    "total_points": len(region_risks),
                    "max_risk": round(max(risk_scores), 1),
                    "avg_risk": round(sum(risk_scores) / len(risk_scores), 1),
                    "min_risk": round(min(risk_scores), 1),
                    "high_risk_count": len([r for r in region_risks if r.fire_risk_score >= 60]),
                    "risk_categories": categories
                }
            else:
                regional_stats[region_name] = {
                    "total_points": 0,
                    "max_risk": 0,
                    "avg_risk": 0,
                    "min_risk": 0,
                    "high_risk_count": 0,
                    "risk_categories": {}
                }
        
        return {
            "regional_statistics": regional_stats,
            "generated_at": datetime.utcnow().isoformat(),
            "total_regions": len(regions)
        }
        
    except Exception as e:
        logger.error(f"Error getting regional risk statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get regional statistics: {str(e)}")

@router.get("/grid-info/{grid_index}")
async def get_grid_cell_info(grid_index: int):
    """
    Get detailed information for a specific grid cell
    
    Returns comprehensive fire risk and weather data for the specified grid cell.
    """
    try:
        cached_risks = texas_grid_service.get_cached_fire_risk()
        
        # Find the specific grid cell
        grid_risk = None
        for risk in cached_risks:
            if risk.grid_index == grid_index:
                grid_risk = risk
                break
        
        if not grid_risk:
            raise HTTPException(status_code=404, detail=f"Grid cell {grid_index} not found")
        
        # Get grid cell geometry
        if not texas_grid_service.load_grid_cells():
            raise HTTPException(status_code=500, detail="Cannot load grid cells")
        
        grid_cell = None
        for cell in texas_grid_service.grid_cells:
            if cell.index == grid_index:
                grid_cell = cell
                break
        
        if not grid_cell:
            raise HTTPException(status_code=404, detail=f"Grid cell geometry for {grid_index} not found")
        
        return {
            "grid_index": grid_index,
            "geometry": {
                "center": {"lat": grid_cell.center_lat, "lng": grid_cell.center_lng},
                "bounds": {
                    "min_lat": grid_cell.min_lat,
                    "max_lat": grid_cell.max_lat,
                    "min_lng": grid_cell.min_lng,
                    "max_lng": grid_cell.max_lng
                },
                "area_km2": round(grid_cell.area_km2, 2)
            },
            "fire_risk": {
                "current_score": grid_risk.fire_risk_score,
                "category": grid_risk.risk_category,
                "color": grid_risk.risk_color,
                "max_24h": grid_risk.max_risk_24h,
                "avg_24h": grid_risk.avg_risk_24h,
                "forecast_time": grid_risk.forecast_timestamp.isoformat()
            },
            "weather": grid_risk.weather_data,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting grid cell info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get grid cell info: {str(e)}")

@router.get("/cache-status")
async def get_cache_status():
    """
    Get information about the fire risk data cache
    
    Returns cache statistics including:
    - Cache age and freshness
    - Number of cached records
    - Coverage statistics
    """
    try:
        stats = texas_grid_service.get_grid_statistics()
        cached_risks = texas_grid_service.get_cached_fire_risk(max_age_hours=24)
        
        # Calculate cache freshness
        cache_age_hours = None
        if stats.get("last_update"):
            last_update = datetime.fromisoformat(stats["last_update"])
            cache_age_hours = (datetime.utcnow() - last_update).total_seconds() / 3600
        
        return {
            "cache_statistics": stats,
            "cache_freshness": {
                "last_update": stats.get("last_update"),
                "cache_age_hours": round(cache_age_hours, 2) if cache_age_hours else None,
                "is_fresh": cache_age_hours < 6 if cache_age_hours else False,
                "records_last_24h": len(cached_risks)
            },
            "recommendations": {
                "needs_update": cache_age_hours > 6 if cache_age_hours else True,
                "update_frequency": "Every 6 hours",
                "optimal_density": 0.1
            },
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting cache status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache status: {str(e)}")

@router.delete("/cache")
async def clear_cache():
    """
    Clear all cached fire risk data
    
    This endpoint clears all cached predictions and forces fresh data retrieval
    on the next update. Useful when switching approaches (e.g., from full grid to regional).
    """
    try:
        deleted_count = texas_grid_service.clear_cache()
        
        return {
            "success": True,
            "message": f"Cache cleared successfully",
            "deleted_records": deleted_count,
            "cleared_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")
