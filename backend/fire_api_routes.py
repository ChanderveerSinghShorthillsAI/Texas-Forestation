"""
Fire Tracking API Routes
Provides endpoints for NASA FIRMS fire detection data
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any
import logging

from fire_tracking_service import fire_tracking_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/fire", tags=["fire-tracking"])

@router.get("/texas")
async def get_texas_fires(
    dataset: Optional[str] = Query(
        default="VIIRS_NOAA20_NRT",
        description="FIRMS dataset to use for fire detection"
    ),
    days: Optional[int] = Query(
        default=1, 
        ge=1, 
        le=10,
        description="Number of days to fetch (1-10, where 1 = last 24h)"
    )
) -> Dict[str, Any]:
    """
    Get real-time fire detections for Texas region
    
    Returns GeoJSON FeatureCollection of fire detections with enhanced properties
    """
    try:
        logger.info(f"🔥 Fire data request: dataset={dataset}, days={days}")
        
        fire_data = await fire_tracking_service.fetch_fire_data(dataset, days)
        
        logger.info(f"✅ Returning {len(fire_data.get('features', []))} fire detections")
        return fire_data
        
    except Exception as e:
        logger.error(f"❌ Fire data request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/statistics")
async def get_fire_statistics(
    dataset: Optional[str] = Query(
        default="VIIRS_NOAA20_NRT",
        description="FIRMS dataset to use for statistics"
    ),
    days: Optional[int] = Query(
        default=1,
        ge=1,
        le=10, 
        description="Number of days for statistics (1-10)"
    )
) -> Dict[str, Any]:
    """
    Get fire detection statistics for Texas region
    
    Returns breakdown by confidence levels and fire intensity
    """
    try:
        logger.info(f"📊 Fire statistics request: dataset={dataset}, days={days}")
        
        stats = await fire_tracking_service.get_fire_statistics(dataset, days)
        
        logger.info(f"✅ Returning statistics for {stats.get('total_detections', 0)} detections")
        return stats
        
    except Exception as e:
        logger.error(f"❌ Fire statistics request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/datasets")
async def get_available_datasets() -> Dict[str, Any]:
    """
    Get list of available FIRMS datasets
    
    Returns information about available fire detection datasets
    """
    try:
        logger.info("📋 Available datasets request")
        
        datasets = await fire_tracking_service.get_available_datasets()
        
        logger.info(f"✅ Returning {len(datasets.get('datasets', []))} available datasets")
        return datasets
        
    except Exception as e:
        logger.error(f"❌ Available datasets request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cache/clear")
async def clear_fire_cache() -> Dict[str, Any]:
    """
    Clear fire data cache
    
    Forces fresh data fetch on next request
    """
    try:
        logger.info("🧹 Fire cache clear request")
        
        fire_tracking_service.clear_cache()
        
        logger.info("✅ Fire cache cleared successfully")
        return {
            "success": True,
            "message": "Fire data cache cleared successfully"
        }
        
    except Exception as e:
        logger.error(f"❌ Cache clear request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def fire_service_health() -> Dict[str, Any]:
    """
    Health check for fire tracking service
    
    Returns service status and configuration
    """
    try:
        return {
            "status": "healthy",
            "service": "Fire Tracking Service",
            "api_provider": "NASA FIRMS",
            "texas_bbox": fire_tracking_service.TEXAS_BBOX,
            "cache_duration_seconds": fire_tracking_service.cache_duration,
            "available_datasets": len(fire_tracking_service.DATASETS),
            "default_dataset": "VIIRS_NOAA20_NRT"
        }
        
    except Exception as e:
        logger.error(f"❌ Fire service health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
