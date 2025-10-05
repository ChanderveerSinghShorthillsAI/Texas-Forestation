"""
API Routes for Temporal Satellite Image Comparison
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from satellite_comparison_service import satellite_comparison_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/satellite-comparison", tags=["satellite-comparison"])


class LocationModel(BaseModel):
    """Location model for satellite imagery requests"""
    latitude: float = Field(..., ge=-90, le=90, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude coordinate")
    bbox_size: float = Field(default=0.05, gt=0, le=1, description="Bounding box size in degrees")


class ComparisonRequestModel(BaseModel):
    """Request model for temporal comparison"""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    date1: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$', description="First date (YYYY-MM-DD)")
    date2: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$', description="Second date (YYYY-MM-DD)")
    bbox_size: float = Field(default=0.05, gt=0, le=1)


@router.get("/health")
async def check_health():
    """
    Check if Planet Labs API is accessible and authenticated
    
    Returns:
        Service health status
    """
    try:
        health_status = await satellite_comparison_service.check_service_health()
        return health_status
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_imagery(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude"),
    start_date: str = Query(..., pattern=r'^\d{4}-\d{2}-\d{2}$', description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., pattern=r'^\d{4}-\d{2}-\d{2}$', description="End date (YYYY-MM-DD)"),
    bbox_size: float = Query(default=0.05, gt=0, le=1, description="Bounding box size in degrees"),
    max_cloud_cover: float = Query(default=0.3, ge=0, le=1, description="Max cloud cover (0-1)")
):
    """
    Search for available satellite imagery for a location and date range
    
    Args:
        latitude: Center latitude
        longitude: Center longitude
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        bbox_size: Size of bounding box in degrees
        max_cloud_cover: Maximum cloud coverage
        
    Returns:
        List of available imagery with metadata
    """
    try:
        logger.info(f"🔍 Searching imagery: ({latitude}, {longitude}) from {start_date} to {end_date}")
        
        results = await satellite_comparison_service.search_imagery(
            latitude=latitude,
            longitude=longitude,
            start_date=start_date,
            end_date=end_date,
            bbox_size=bbox_size,
            max_cloud_cover=max_cloud_cover
        )
        
        return {
            "success": True,
            "count": len(results),
            "location": {
                "latitude": latitude,
                "longitude": longitude
            },
            "date_range": {
                "start": start_date,
                "end": end_date
            },
            "imagery": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in search endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/image")
async def get_image_for_date(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    date: str = Query(..., pattern=r'^\d{4}-\d{2}-\d{2}$', description="Target date (YYYY-MM-DD)"),
    bbox_size: float = Query(default=0.05, gt=0, le=1),
    date_tolerance_days: int = Query(default=7, ge=1, le=30, description="Days to search before/after")
):
    """
    Get the best available satellite image for a specific date
    
    Args:
        latitude: Center latitude
        longitude: Center longitude
        date: Target date
        bbox_size: Bounding box size
        date_tolerance_days: Search tolerance in days
        
    Returns:
        Best matching image metadata
    """
    try:
        logger.info(f"🛰️ Getting image for ({latitude}, {longitude}) on {date}")
        
        result = await satellite_comparison_service.get_image_for_date(
            latitude=latitude,
            longitude=longitude,
            target_date=date,
            bbox_size=bbox_size,
            date_tolerance_days=date_tolerance_days
        )
        
        return {
            "success": True,
            "requested_date": date,
            "location": {
                "latitude": latitude,
                "longitude": longitude
            },
            "image": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get image endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare")
async def compare_images(request: ComparisonRequestModel):
    """
    Get comparison data for two dates
    
    Args:
        request: Comparison request with location and two dates
        
    Returns:
        Complete comparison data with both images and analysis
    """
    try:
        logger.info(f"📊 Comparison request: ({request.latitude}, {request.longitude})")
        logger.info(f"📅 Dates: {request.date1} vs {request.date2}")
        
        comparison_data = await satellite_comparison_service.get_comparison_data(
            latitude=request.latitude,
            longitude=request.longitude,
            date1=request.date1,
            date2=request.date2,
            bbox_size=request.bbox_size
        )
        
        return {
            "success": True,
            "comparison": comparison_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in compare endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/thumbnail/{image_id}")
async def get_thumbnail(image_id: str):
    """
    Get thumbnail image as base64
    
    Args:
        image_id: Planet Labs image ID
        
    Returns:
        Base64 encoded thumbnail
    """
    try:
        # This is a placeholder - actual implementation would fetch from Planet API
        # using the image ID
        logger.info(f"🖼️ Fetching thumbnail for {image_id}")
        
        return {
            "success": True,
            "image_id": image_id,
            "message": "Thumbnail fetching not yet implemented"
        }
        
    except Exception as e:
        logger.error(f"Error fetching thumbnail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/texas-bounds")
async def get_texas_bounds():
    """
    Get Texas bounding box for map initialization
    
    Returns:
        Texas bounding box coordinates
    """
    return {
        "success": True,
        "bounds": {
            "southwest": {"lat": 25.84, "lng": -106.65},
            "northeast": {"lat": 36.50, "lng": -93.51},
            "center": {"lat": 31.17, "lng": -100.08}
        },
        "description": "Texas state boundaries"
    }

