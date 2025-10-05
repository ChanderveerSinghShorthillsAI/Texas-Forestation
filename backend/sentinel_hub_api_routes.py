"""
Sentinel Hub API Routes
High-quality satellite imagery comparison using Sentinel-2
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

from sentinel_hub_service import SentinelHubService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/sentinel-hub", tags=["sentinel-hub"])

# Initialize service
sentinel_service = SentinelHubService()


class ComparisonRequest(BaseModel):
    """Request model for satellite comparison"""
    latitude: float
    longitude: float
    date1: str  # Format: YYYY-MM-DD
    date2: str  # Format: YYYY-MM-DD
    bbox_size: Optional[float] = 0.05


@router.get("/health")
async def health_check():
    """Check if Sentinel Hub service is healthy"""
    try:
        health_status = await sentinel_service.check_service_health()
        return health_status
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare")
async def compare_images(request: ComparisonRequest):
    """
    Compare satellite images from two different dates using Sentinel-2
    
    - **latitude**: Location latitude (-90 to 90)
    - **longitude**: Location longitude (-180 to 180)
    - **date1**: First date (YYYY-MM-DD)
    - **date2**: Second date (YYYY-MM-DD)
    - **bbox_size**: Bounding box size in degrees (default 0.05)
    """
    try:
        logger.info(f"📡 Sentinel-2 comparison request for ({request.latitude}, {request.longitude})")
        logger.info(f"📅 Comparing: {request.date1} vs {request.date2}")
        
        # Get comparison data
        result = await sentinel_service.get_comparison_data(
            latitude=request.latitude,
            longitude=request.longitude,
            date1=request.date1,
            date2=request.date2,
            bbox_size=request.bbox_size
        )
        
        return result
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Comparison failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to compare images: {str(e)}")


@router.get("/image")
async def get_single_image(
    latitude: float,
    longitude: float,
    date: str,
    bbox_size: float = 0.05
):
    """
    Get a single Sentinel-2 image for a specific date and location
    
    - **latitude**: Location latitude
    - **longitude**: Location longitude
    - **date**: Target date (YYYY-MM-DD)
    - **bbox_size**: Bounding box size in degrees
    """
    try:
        logger.info(f"📡 Single image request for {date} at ({latitude}, {longitude})")
        
        result = await sentinel_service.get_image_for_date(
            latitude=latitude,
            longitude=longitude,
            target_date=date,
            bbox_size=bbox_size
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="No image found for the specified date and location")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

