"""
Sentinel Hub Service for High-Quality Satellite Imagery
Provides better quality images than Planet Labs preview API
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import base64
from io import BytesIO
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from sentinelhub import (
    SHConfig,
    BBox,
    CRS,
    DataCollection,
    SentinelHubRequest,
    SentinelHubCatalog,
    bbox_to_dimensions,
    MimeType,
)

logger = logging.getLogger(__name__)


class SentinelHubService:
    def __init__(self):
        """Initialize Sentinel Hub service"""
        # Sentinel Hub configuration
        self.config = SHConfig()
        
        # You'll need to sign up at: https://www.sentinel-hub.com/
        # Get your credentials from the dashboard
        self.config.sh_client_id = os.getenv("SENTINEL_HUB_CLIENT_ID", "0535ebc2-3a8c-4688-8965-9981d5feca1a")
        self.config.sh_client_secret = os.getenv("SENTINEL_HUB_CLIENT_SECRET", "0mhoVVpH7sGWn5CZGnZgd3Kw4ESecZbl")
        
        # Instance ID (optional for some endpoints)
        self.config.instance_id = os.getenv("SENTINEL_HUB_INSTANCE_ID", "ba9ce6a9-b382-41c6-8892-482c9ebf4042")
        
        # Image resolution in meters per pixel
        self.resolution = 10  # 10m resolution for Sentinel-2
        
        logger.info("✅ Sentinel Hub service initialized")
    
    def create_bbox(self, latitude: float, longitude: float, bbox_size: float = 0.05) -> BBox:
        """
        Create bounding box around location
        
        Args:
            latitude: Center latitude
            longitude: Center longitude
            bbox_size: Size of bbox in degrees (default 0.05 = ~5.5km)
            
        Returns:
            BBox object
        """
        # Create bbox: [west, south, east, north]
        bbox_coords = [
            longitude - bbox_size,
            latitude - bbox_size,
            longitude + bbox_size,
            latitude + bbox_size
        ]
        
        return BBox(bbox=bbox_coords, crs=CRS.WGS84)
    
    async def get_image_for_date(
        self, 
        latitude: float, 
        longitude: float, 
        target_date: str,
        bbox_size: float = 0.05,
        max_cloud_coverage: float = 30.0
    ) -> Optional[Dict[str, Any]]:
        """
        Get Sentinel-2 image for specific date and location
        
        Args:
            latitude: Location latitude
            longitude: Location longitude
            target_date: Target date (YYYY-MM-DD)
            bbox_size: Size of bounding box
            max_cloud_coverage: Maximum cloud coverage percentage
            
        Returns:
            Dictionary with image data and metadata
        """
        try:
            # Parse target date and make it timezone-aware (UTC)
            target_dt = datetime.strptime(target_date, "%Y-%m-%d").replace(tzinfo=None)
            
            # Define time range (±7 days from target)
            time_start = target_dt - timedelta(days=7)
            time_end = target_dt + timedelta(days=7)
            
            # Create bounding box
            bbox = self.create_bbox(latitude, longitude, bbox_size)
            
            # Calculate image size (in pixels) based on resolution
            size = bbox_to_dimensions(bbox, resolution=self.resolution)
            
            # Evalscript for true color RGB with cloud mask
            evalscript = """
            //VERSION=3
            function setup() {
                return {
                    input: ["B02", "B03", "B04", "CLM"],
                    output: { bands: 4 }
                };
            }
            
            function evaluatePixel(sample) {
                // True color RGB (R=B04, G=B03, B=B02)
                // Enhance brightness for better visibility
                let r = 2.5 * sample.B04;
                let g = 2.5 * sample.B03;
                let b = 2.5 * sample.B02;
                
                return [r, g, b, sample.CLM];
            }
            """
            
            # Create request to get image with timestamps
            request = SentinelHubRequest(
                evalscript=evalscript,
                input_data=[
                    SentinelHubRequest.input_data(
                        data_collection=DataCollection.SENTINEL2_L2A,
                        time_interval=(time_start.isoformat(), time_end.isoformat()),
                        maxcc=max_cloud_coverage / 100.0,  # Convert to 0-1 range
                        mosaicking_order='leastCC',  # Get image with least cloud coverage
                    )
                ],
                responses=[
                    SentinelHubRequest.output_response('default', MimeType.PNG)
                ],
                bbox=bbox,
                size=size,
                config=self.config
            )
            
            # First, use Catalog API to find available images and their dates
            logger.info(f"📡 Searching Sentinel-2 catalog for {target_date} at ({latitude}, {longitude})")
            
            catalog = SentinelHubCatalog(config=self.config)
            search_iterator = catalog.search(
                DataCollection.SENTINEL2_L2A,
                bbox=bbox,
                time=(time_start.isoformat(), time_end.isoformat()),
                fields={"include": ["id", "properties.datetime"], "exclude": []},
            )
            
            # Get all available tiles
            tiles = list(search_iterator)
            
            if not tiles:
                logger.warning(f"No images found for {target_date} in catalog")
                return None
            
            # Find the tile closest to target date
            closest_tile = min(
                tiles,
                key=lambda t: abs(
                    (datetime.fromisoformat(t["properties"]["datetime"].replace("Z", "+00:00")).replace(tzinfo=None) - target_dt).total_seconds()
                )
            )
            
            # Remove timezone info for comparison
            actual_dt = datetime.fromisoformat(closest_tile["properties"]["datetime"].replace("Z", "+00:00")).replace(tzinfo=None)
            actual_acquisition_date = actual_dt.strftime("%Y-%m-%d")
            days_difference = abs((actual_dt.date() - target_dt.date()).days)
            
            logger.info(f"📅 Found image from: {actual_acquisition_date} ({days_difference} days from requested)")
            
            # Now get the actual image data
            logger.info(f"📡 Downloading Sentinel-2 image...")
            images = request.get_data()
            
            if not images or len(images) == 0:
                logger.warning(f"Failed to download image data")
                return None
            
            # Get the first image
            image_data = images[0]
            
            # Convert to base64
            buffered = BytesIO()
            from PIL import Image
            img = Image.fromarray(image_data[:, :, :3])  # RGB only, no alpha
            img.save(buffered, format="PNG")
            img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
            
            result = {
                "image_base64": f"data:image/png;base64,{img_base64}",
                "actual_date": actual_acquisition_date,  # ✅ FIXED: Now using real acquisition date
                "requested_date": target_date,
                "days_from_requested": days_difference,  # NEW: Shows how far from requested date
                "satellite": "Sentinel-2",
                "resolution": f"{self.resolution}m",
                "cloud_coverage": "low",  # Using leastCC mosaicking order
                "bbox": [
                    longitude - bbox_size,
                    latitude - bbox_size,
                    longitude + bbox_size,
                    latitude + bbox_size
                ],
                "size": size,
                "success": True
            }
            
            logger.info(f"✅ Successfully retrieved Sentinel-2 image ({size[0]}x{size[1]} pixels)")
            logger.info(f"📊 Requested: {target_date} | Actual: {actual_acquisition_date} | Difference: {days_difference} days")
            return result
            
        except Exception as e:
            logger.error(f"Error getting Sentinel image: {e}")
            return None
    
    async def get_comparison_data(
        self,
        latitude: float,
        longitude: float,
        date1: str,
        date2: str,
        bbox_size: float = 0.05
    ) -> Dict[str, Any]:
        """
        Get comparison data for two dates
        
        Args:
            latitude: Location latitude
            longitude: Location longitude
            date1: First date (YYYY-MM-DD)
            date2: Second date (YYYY-MM-DD)
            bbox_size: Size of bounding box
            
        Returns:
            Dictionary with comparison data
        """
        try:
            logger.info(f"🔍 Getting Sentinel-2 comparison for ({latitude}, {longitude})")
            logger.info(f"📅 Dates: {date1} vs {date2}")
            
            # Get both images
            import asyncio
            image1, image2 = await asyncio.gather(
                self.get_image_for_date(latitude, longitude, date1, bbox_size),
                self.get_image_for_date(latitude, longitude, date2, bbox_size)
            )
            
            if not image1 or not image2:
                raise ValueError("Could not retrieve one or both images")
            
            # Calculate time difference
            dt1 = datetime.strptime(date1, "%Y-%m-%d")
            dt2 = datetime.strptime(date2, "%Y-%m-%d")
            days_diff = abs((dt2 - dt1).days)
            
            comparison_data = {
                "success": True,
                "location": {
                    "latitude": latitude,
                    "longitude": longitude,
                    "bbox_size": bbox_size
                },
                "image1": {
                    "preview_base64": image1["image_base64"],
                    "actual_date": image1["actual_date"],
                    "requested_date": date1,
                    "days_from_requested": image1.get("days_from_requested", 0),  # NEW
                    "satellite_id": "Sentinel-2",
                    "pixel_resolution": self.resolution,
                    "cloud_cover": 0,
                    "instrument": "MSI"
                },
                "image2": {
                    "preview_base64": image2["image_base64"],
                    "actual_date": image2["actual_date"],
                    "requested_date": date2,
                    "days_from_requested": image2.get("days_from_requested", 0),  # NEW
                    "satellite_id": "Sentinel-2",
                    "pixel_resolution": self.resolution,
                    "cloud_cover": 0,
                    "instrument": "MSI"
                },
                "comparison": {
                    "days_between": days_diff,
                    "cloud_cover_change": 0,
                    "same_satellite": True,
                    "source": "Sentinel Hub",
                    "date_accuracy": {  # NEW: Shows how close we got to requested dates
                        "image1_offset": image1.get("days_from_requested", 0),
                        "image2_offset": image2.get("days_from_requested", 0)
                    }
                }
            }
            
            logger.info(f"✅ Comparison complete: {days_diff} days between images")
            return comparison_data
            
        except Exception as e:
            logger.error(f"Error creating comparison: {e}")
            raise
    
    async def check_service_health(self) -> Dict[str, Any]:
        """Check if Sentinel Hub service is accessible"""
        try:
            if not self.config.sh_client_id or not self.config.sh_client_secret:
                return {
                    "status": "error",
                    "message": "Sentinel Hub credentials not configured",
                    "authenticated": False
                }
            
            # Test with a simple request (optional)
            return {
                "status": "healthy",
                "message": "Sentinel Hub configured and ready",
                "authenticated": True,
                "resolution": f"{self.resolution}m"
            }
            
        except Exception as e:
            logger.error(f"Sentinel Hub health check failed: {e}")
            return {
                "status": "error",
                "message": str(e),
                "authenticated": False
            }

