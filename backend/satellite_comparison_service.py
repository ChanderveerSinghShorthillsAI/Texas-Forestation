"""
Temporal Satellite Image Comparison Service
Fetches satellite imagery from Planet Labs for temporal comparison
"""

import os
import httpx
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from pathlib import Path
import base64
from fastapi import HTTPException
import re
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class SatelliteComparisonService:
    """Service for fetching and comparing satellite imagery from Planet Labs"""
    
    def __init__(self):
        # Planet Labs API configuration
        self.api_key = os.getenv("PLANET_API_KEY", "PLAK3a0009aaa3ba45489482fd9c62a8df54")
        self.base_url = "https://api.planet.com/data/v1"
        self.search_url = f"{self.base_url}/quick-search"
        
        # Image storage
        self.cache_dir = Path("satellite_images")
        self.cache_dir.mkdir(exist_ok=True)
        
        # Texas bounding box
        self.texas_bbox = {
            "type": "Polygon",
            "coordinates": [[
                [-106.65, 25.84],
                [-93.51, 25.84],
                [-93.51, 36.50],
                [-106.65, 36.50],
                [-106.65, 25.84]
            ]]
        }
    
    def _parse_planet_datetime(self, date_string: str) -> datetime:
        """
        Parse Planet Labs datetime strings which may have non-standard microseconds
        
        Args:
            date_string: ISO format datetime string from Planet API
            
        Returns:
            datetime object
        """
        try:
            # Replace 'Z' with '+00:00' for timezone
            date_string = date_string.replace("Z", "+00:00")
            
            # Fix microseconds if they're not 6 digits
            # Pattern: find the microseconds part (after . and before +/-)
            pattern = r'\.(\d+)([+-]\d{2}:\d{2})$'
            match = re.search(pattern, date_string)
            
            if match:
                microseconds = match.group(1)
                timezone = match.group(2)
                
                # Pad or truncate to 6 digits
                if len(microseconds) < 6:
                    microseconds = microseconds.ljust(6, '0')
                elif len(microseconds) > 6:
                    microseconds = microseconds[:6]
                
                # Reconstruct the datetime string
                base_datetime = date_string.split('.')[0]
                date_string = f"{base_datetime}.{microseconds}{timezone}"
            
            return datetime.fromisoformat(date_string)
            
        except Exception as e:
            logger.error(f"Error parsing datetime '{date_string}': {e}")
            # Fallback: try to parse just the date part
            try:
                return datetime.strptime(date_string[:10], "%Y-%m-%d")
            except:
                raise ValueError(f"Could not parse datetime: {date_string}")
    
    async def search_imagery(
        self,
        latitude: float,
        longitude: float,
        start_date: str,
        end_date: str,
        bbox_size: float = 0.05,
        max_cloud_cover: float = 0.3
    ) -> List[Dict[str, Any]]:
        """
        Search for available satellite imagery for a location and date range
        
        Args:
            latitude: Center latitude
            longitude: Center longitude
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            bbox_size: Size of bounding box in degrees (default 0.05 = ~5km)
            max_cloud_cover: Maximum cloud coverage (0-1)
            
        Returns:
            List of available imagery metadata
        """
        try:
            # Create bounding box around point
            bbox = {
                "type": "Polygon",
                "coordinates": [[
                    [longitude - bbox_size, latitude - bbox_size],
                    [longitude + bbox_size, latitude - bbox_size],
                    [longitude + bbox_size, latitude + bbox_size],
                    [longitude - bbox_size, latitude + bbox_size],
                    [longitude - bbox_size, latitude - bbox_size]
                ]]
            }
            
            # Build search request
            search_request = {
                "item_types": ["PSScene"],  # PlanetScope scenes
                "filter": {
                    "type": "AndFilter",
                    "config": [
                        {
                            "type": "GeometryFilter",
                            "field_name": "geometry",
                            "config": bbox
                        },
                        {
                            "type": "DateRangeFilter",
                            "field_name": "acquired",
                            "config": {
                                "gte": f"{start_date}T00:00:00.000Z",
                                "lte": f"{end_date}T23:59:59.999Z"
                            }
                        },
                        {
                            "type": "RangeFilter",
                            "field_name": "cloud_cover",
                            "config": {
                                "lte": max_cloud_cover
                            }
                        }
                    ]
                }
            }
            
            logger.info(f"🛰️ Searching imagery for ({latitude}, {longitude}) from {start_date} to {end_date}")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.search_url,
                    json=search_request,
                    auth=(self.api_key, "")
                )
                
                if response.status_code == 401:
                    raise HTTPException(status_code=401, detail="Invalid Planet Labs API key")
                
                response.raise_for_status()
                data = response.json()
                
                features = data.get("features", [])
                logger.info(f"✅ Found {len(features)} imagery scenes")
                
                # Extract relevant metadata
                results = []
                for feature in features:
                    props = feature.get("properties", {})
                    results.append({
                        "id": feature.get("id"),
                        "acquired": props.get("acquired"),
                        "cloud_cover": props.get("cloud_cover", 0) * 100,  # Convert to percentage
                        "sun_azimuth": props.get("sun_azimuth"),
                        "sun_elevation": props.get("sun_elevation"),
                        "pixel_resolution": props.get("pixel_resolution"),
                        "instrument": props.get("instrument"),
                        "satellite_id": props.get("satellite_id"),
                        "quality_category": props.get("quality_category"),
                        "thumbnail": props.get("thumbnail", None)
                    })
                
                return sorted(results, key=lambda x: x["acquired"])
                
        except httpx.HTTPError as e:
            logger.error(f"HTTP error searching imagery: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to search imagery: {str(e)}")
        except Exception as e:
            logger.error(f"Error searching imagery: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to search imagery: {str(e)}")
    
    async def get_image_for_date(
        self,
        latitude: float,
        longitude: float,
        target_date: str,
        bbox_size: float = 0.05,
        date_tolerance_days: int = 7
    ) -> Dict[str, Any]:
        """
        Get the best available satellite image for a specific date
        
        Args:
            latitude: Center latitude
            longitude: Center longitude
            target_date: Target date (YYYY-MM-DD)
            bbox_size: Size of bounding box in degrees
            date_tolerance_days: How many days before/after to search
            
        Returns:
            Image metadata with download URL
        """
        try:
            # Calculate date range
            target_dt = datetime.strptime(target_date, "%Y-%m-%d")
            start_date = (target_dt - timedelta(days=date_tolerance_days)).strftime("%Y-%m-%d")
            end_date = (target_dt + timedelta(days=date_tolerance_days)).strftime("%Y-%m-%d")
            
            # Search for imagery
            images = await self.search_imagery(
                latitude=latitude,
                longitude=longitude,
                start_date=start_date,
                end_date=end_date,
                bbox_size=bbox_size
            )
            
            if not images:
                raise HTTPException(
                    status_code=404,
                    detail=f"No imagery found within {date_tolerance_days} days of {target_date}"
                )
            
            # Find closest image to target date
            target_timestamp = target_dt.timestamp()
            best_image = min(
                images,
                key=lambda img: abs(
                    self._parse_planet_datetime(img["acquired"]).timestamp() 
                    - target_timestamp
                )
            )
            
            logger.info(f"✅ Best image for {target_date}: {best_image['id']} "
                       f"(acquired: {best_image['acquired']}, cloud: {best_image['cloud_cover']:.1f}%)")
            
            return best_image
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting image for date: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get image: {str(e)}")
    
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
            latitude: Center latitude
            longitude: Center longitude
            date1: First date (YYYY-MM-DD)
            date2: Second date (YYYY-MM-DD)
            bbox_size: Size of bounding box in degrees
            
        Returns:
            Comparison data with both images and metadata
        """
        try:
            logger.info(f"🔄 Getting comparison data for ({latitude}, {longitude})")
            logger.info(f"📅 Date 1: {date1}, Date 2: {date2}")
            
            # Get images for both dates in parallel
            import asyncio
            image1, image2 = await asyncio.gather(
                self.get_image_for_date(latitude, longitude, date1, bbox_size),
                self.get_image_for_date(latitude, longitude, date2, bbox_size)
            )
            
            # Calculate changes
            cloud_diff = image2["cloud_cover"] - image1["cloud_cover"]
            days_diff = (
                self._parse_planet_datetime(image2["acquired"]) -
                self._parse_planet_datetime(image1["acquired"])
            ).days
            
            # Calculate bounding box for images
            bbox = [
                longitude - bbox_size,
                latitude - bbox_size,
                longitude + bbox_size,
                latitude + bbox_size
            ]
            
            # Generate static image info
            static_image_1 = await self.get_static_image_url(image1["id"], bbox)
            static_image_2 = await self.get_static_image_url(image2["id"], bbox)
            
            # Download preview images as base64
            preview_1 = await self.download_preview_image(image1["id"])
            preview_2 = await self.download_preview_image(image2["id"])
            
            comparison_data = {
                "location": {
                    "latitude": latitude,
                    "longitude": longitude,
                    "bbox_size": bbox_size,
                    "bbox": bbox
                },
                "image1": {
                    **image1,
                    "requested_date": date1,
                    "actual_date": image1["acquired"][:10],
                    "static_image": static_image_1,
                    "preview_base64": preview_1
                },
                "image2": {
                    **image2,
                    "requested_date": date2,
                    "actual_date": image2["acquired"][:10],
                    "static_image": static_image_2,
                    "preview_base64": preview_2
                },
                "comparison": {
                    "days_between": days_diff,
                    "cloud_cover_change": cloud_diff,
                    "same_satellite": image1.get("satellite_id") == image2.get("satellite_id")
                }
            }
            
            logger.info(f"✅ Comparison data ready: {days_diff} days between images")
            return comparison_data
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting comparison data: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get comparison: {str(e)}")
    
    async def get_image_tile_url(self, image_id: str, item_type: str = "PSScene") -> Optional[str]:
        """
        Get the tile URL for an image using Planet's Tile API
        
        Args:
            image_id: Planet Labs image ID
            item_type: Item type (default: PSScene)
            
        Returns:
            Tile URL string or None
        """
        try:
            # Planet Tile API endpoint
            # Format: https://tiles.planet.com/data/v1/{item_type}/{item_id}/{z}/{x}/{y}.png?api_key=KEY
            tile_url = f"https://tiles.planet.com/data/v1/{item_type}/{image_id}/{{z}}/{{x}}/{{y}}.png?api_key={self.api_key}"
            
            logger.info(f"✅ Generated tile URL for image {image_id}")
            return tile_url
            
        except Exception as e:
            logger.error(f"Error generating tile URL: {e}")
            return None
    
    async def get_thumbnail_as_base64(self, thumbnail_url: str) -> Optional[str]:
        """
        Fetch thumbnail and convert to base64 for embedding
        
        Args:
            thumbnail_url: URL of the thumbnail
            
        Returns:
            Base64 encoded image string or None
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(thumbnail_url, auth=(self.api_key, ""))
                response.raise_for_status()
                
                # Convert to base64
                image_base64 = base64.b64encode(response.content).decode('utf-8')
                return f"data:image/png;base64,{image_base64}"
                
        except Exception as e:
            logger.error(f"Error fetching thumbnail: {e}")
            return None
    
    async def get_static_image_url(self, image_id: str, bbox: List[float], width: int = 1024, height: int = 1024) -> Optional[Dict[str, Any]]:
        """
        Get a preview image URL from Planet's quick-search API
        
        Args:
            image_id: Planet Labs image ID
            bbox: Bounding box [west, south, east, north]
            width: Image width in pixels
            height: Image height in pixels
            
        Returns:
            Dictionary with image URL and metadata or None
        """
        try:
            west, south, east, north = bbox
            center_lng = (west + east) / 2
            center_lat = (south + north) / 2
            
            # Construct Planet's thumb URL (works with basic auth)
            # This is a preview endpoint that should work with your API key
            thumb_url = f"https://api.planet.com/data/v1/item-types/PSScene/items/{image_id}/thumb"
            
            # Approximate zoom level based on bbox size
            bbox_width = abs(east - west)
            if bbox_width > 0.5:
                zoom = 10
            elif bbox_width > 0.1:
                zoom = 12
            elif bbox_width > 0.05:
                zoom = 13
            else:
                zoom = 14
            
            return {
                "image_id": image_id,
                "center": {"lat": center_lat, "lng": center_lng},
                "zoom": zoom,
                "bbox": bbox,
                "preview_url": thumb_url,
                "type": "preview"  # Indicates this is a preview image, not tiles
            }
            
        except Exception as e:
            logger.error(f"Error generating static image URL: {e}")
            return None
    
    async def download_preview_image(self, image_id: str) -> Optional[str]:
        """
        Download preview image and return as base64
        
        Args:
            image_id: Planet Labs image ID
            
        Returns:
            Base64 encoded image string or None
        """
        try:
            # First, get the item details to find available assets
            item_url = f"https://api.planet.com/data/v1/item-types/PSScene/items/{image_id}"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Get item metadata
                item_response = await client.get(item_url, auth=(self.api_key, ""))
                item_response.raise_for_status()
                item_data = item_response.json()
                
                # Get all available assets
                asset_url = f"{item_url}/assets"
                asset_response = await client.get(asset_url, auth=(self.api_key, ""))
                asset_response.raise_for_status()
                assets = asset_response.json()
                
                # Try different preview asset types in order of preference (best quality first)
                preview_types = ["ortho_visual", "ortho_analytic_4b", "basic_analytic_4b", "analytic"]
                
                preview_url = None
                # First, try to get the full asset preview (better quality than thumbnail)
                for asset_type in preview_types:
                    if asset_type in assets and "status" in assets[asset_type]:
                        if assets[asset_type]["status"] == "active":
                            links = assets[asset_type].get("_links", {})
                            # Prefer _self link (full resolution preview) over thumbnail
                            if "_self" in links:
                                preview_url = links["_self"]
                                logger.info(f"Using full asset preview for {asset_type}")
                                break
                            elif "thumbnail" in links:
                                preview_url = links["thumbnail"]
                                break
                
                # If no asset found, try the item-level thumbnail
                if not preview_url:
                    if "_links" in item_data and "thumbnail" in item_data["_links"]:
                        preview_url = item_data["_links"]["thumbnail"]
                
                if not preview_url:
                    logger.warning(f"No preview/thumbnail found for image {image_id}")
                    return None
                
                # Download the preview image
                logger.info(f"📥 Downloading preview from: {preview_url}")
                preview_response = await client.get(preview_url, auth=(self.api_key, ""))
                preview_response.raise_for_status()
                
                # Convert to base64
                image_base64 = base64.b64encode(preview_response.content).decode('utf-8')
                logger.info(f"✅ Preview image downloaded for {image_id} ({len(preview_response.content)} bytes)")
                return f"data:image/png;base64,{image_base64}"
                
        except Exception as e:
            logger.error(f"Error downloading preview image for {image_id}: {e}")
            return None
    
    async def check_service_health(self) -> Dict[str, Any]:
        """Check if Planet Labs API is accessible"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/item-types",
                    auth=(self.api_key, "")
                )
                
                if response.status_code == 401:
                    return {
                        "status": "error",
                        "message": "Invalid API key",
                        "authenticated": False
                    }
                
                response.raise_for_status()
                
                return {
                    "status": "healthy",
                    "message": "Planet Labs API accessible",
                    "authenticated": True,
                    "api_key_valid": True
                }
                
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "error",
                "message": str(e),
                "authenticated": False
            }


# Global service instance
satellite_comparison_service = SatelliteComparisonService()

