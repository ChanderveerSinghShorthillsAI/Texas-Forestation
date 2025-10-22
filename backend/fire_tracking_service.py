"""
Fire Tracking Service using NASA FIRMS API
Provides real-time fire detection data for Texas region
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import httpx
from fastapi import HTTPException
import json
from pathlib import Path
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class FireTrackingService:
    """Service for fetching and managing fire data from NASA FIRMS API"""
    
    def __init__(self):
        # NASA FIRMS API configuration
        self.MAP_KEY = os.getenv("NASA_FIRMS_MAP_KEY", "")
        self.BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
        
        # Texas bounding box (West, South, East, North)
        self.TEXAS_BBOX = os.getenv("TEXAS_BBOX", "-106.65,25.84,-93.51,36.50")
        
        # Available datasets
        self.DATASETS = {
            "VIIRS_NOAA20_NRT": "VIIRS NOAA-20 Near Real-Time",
            "VIIRS_NOAA21_NRT": "VIIRS NOAA-21 Near Real-Time", 
            "VIIRS_SNPP_NRT": "VIIRS S-NPP Near Real-Time",
            "MODIS_NRT": "MODIS Near Real-Time",
            "LANDSAT_NRT": "Landsat Near Real-Time"
        }
        
        # Cache for fire data
        self.cache = {}
        self.cache_expiry = {}
        self.cache_duration = 300  # 5 minutes cache
        
    async def fetch_fire_data(self, dataset: str = "VIIRS_NOAA20_NRT", days: int = 1) -> Dict[str, Any]:
        """
        Fetch fire data from NASA FIRMS API for Texas
        
        Args:
            dataset: FIRMS dataset to use
            days: Number of days to fetch (1 = last 24h)
            
        Returns:
            GeoJSON FeatureCollection of fire detections
        """
        try:
            # Check cache first
            cache_key = f"{dataset}_{days}"
            if self._is_cache_valid(cache_key):
                logger.info(f"🔥 Returning cached fire data for {dataset}")
                return self.cache[cache_key]
            
            # Construct API URL
            url = f"{self.BASE_URL}/{self.MAP_KEY}/{dataset}/{self.TEXAS_BBOX}/{days}"
            logger.info(f"🔥 Fetching fire data from: {url}")
            
            # Make HTTP request
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                
                # Parse CSV response
                csv_text = response.text
                csv_lines = csv_text.split('\n')
                logger.info(f"🔥 Received {len(csv_lines)} lines of CSV data")
                
                # Convert CSV to GeoJSON
                geojson_data = await self._csv_to_geojson(csv_text, dataset)
                
                # Cache the result
                self.cache[cache_key] = geojson_data
                self.cache_expiry[cache_key] = datetime.now() + timedelta(seconds=self.cache_duration)
                
                logger.info(f"✅ Fire data processed: {len(geojson_data['features'])} fire detections")
                return geojson_data
                
        except httpx.HTTPStatusError as e:
            logger.error(f"❌ HTTP error fetching fire data: {e}")
            if e.response.status_code == 404:
                # Return empty GeoJSON if no data available
                return self._empty_geojson()
            raise HTTPException(status_code=e.response.status_code, detail=f"FIRMS API error: {e}")
        except Exception as e:
            logger.error(f"❌ Error fetching fire data: {e}")
            raise HTTPException(status_code=500, detail=f"Fire data fetch failed: {str(e)}")
    
    async def _csv_to_geojson(self, csv_text: str, dataset: str) -> Dict[str, Any]:
        """Convert CSV response to GeoJSON format"""
        try:
            lines = csv_text.strip().split('\n')
            if len(lines) < 2:
                return self._empty_geojson()
            
            # Parse header
            headers = [h.strip() for h in lines[0].split(',')]
            logger.info(f"🔥 CSV headers: {headers}")
            
            features = []
            for line in lines[1:]:
                if not line.strip():
                    continue
                    
                values = [v.strip() for v in line.split(',')]
                if len(values) != len(headers):
                    continue
                
                # Create feature properties
                properties = {}
                for i, header in enumerate(headers):
                    if i < len(values):
                        properties[header] = values[i]
                
                # Extract coordinates
                try:
                    longitude = float(properties.get('longitude', 0))
                    latitude = float(properties.get('latitude', 0))
                    
                    # Skip invalid coordinates
                    if longitude == 0 and latitude == 0:
                        continue
                        
                    # Add additional properties for display
                    properties['dataset'] = dataset
                    properties['dataset_name'] = self.DATASETS.get(dataset, dataset)
                    properties['detection_time'] = self._format_detection_time(
                        properties.get('acq_date', ''), 
                        properties.get('acq_time', '')
                    )
                    
                    # Handle confidence - can be numeric or letter format
                    confidence_raw = properties.get('confidence', '0')
                    confidence_numeric = self._parse_confidence(confidence_raw)
                    properties['confidence'] = confidence_numeric
                    properties['confidence_level'] = self._get_confidence_level(confidence_numeric)
                    
                    # Handle FRP
                    frp_value = self._safe_float(properties.get('frp', '0'))
                    properties['frp'] = frp_value
                    properties['fire_intensity'] = self._get_fire_intensity(frp_value)
                    
                    # Create GeoJSON feature
                    feature = {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [longitude, latitude]
                        },
                        "properties": properties
                    }
                    features.append(feature)
                    
                except (ValueError, TypeError) as e:
                    logger.warning(f"⚠️ Skipping invalid fire detection data: {e}")
                    continue
            
            return {
                "type": "FeatureCollection",
                "features": features,
                "metadata": {
                    "dataset": dataset,
                    "dataset_name": self.DATASETS.get(dataset, dataset),
                    "total_detections": len(features),
                    "generated_at": datetime.now().isoformat(),
                    "bbox": self.TEXAS_BBOX
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Error converting CSV to GeoJSON: {e}")
            return self._empty_geojson()
    
    def _format_detection_time(self, date_str: str, time_str: str) -> str:
        """Format detection date and time for display"""
        try:
            if not date_str or not time_str:
                return "Unknown"
                
            # Parse date (YYYY-MM-DD format)
            date_parts = date_str.split('-')
            if len(date_parts) != 3:
                return "Unknown"
            
            # Parse time (HHMM format)
            if len(time_str) == 4:
                hour = time_str[:2]
                minute = time_str[2:]
                return f"{date_str} {hour}:{minute} UTC"
            
            return f"{date_str} {time_str}"
        except:
            return "Unknown"
    
    def _get_confidence_level(self, confidence: float) -> str:
        """Get confidence level description"""
        if confidence >= 80:
            return "High"
        elif confidence >= 50:
            return "Medium"
        elif confidence >= 30:
            return "Low"
        else:
            return "Very Low"
    
    def _get_fire_intensity(self, frp: float) -> str:
        """Get fire intensity description based on FRP (Fire Radiative Power)"""
        if frp >= 100:
            return "Very High"
        elif frp >= 50:
            return "High"
        elif frp >= 20:
            return "Medium"
        elif frp >= 5:
            return "Low"
        else:
            return "Very Low"
    
    def _parse_confidence(self, confidence_raw: str) -> float:
        """Parse confidence value - handles both numeric and letter formats"""
        try:
            # If it's already a number, return it
            return float(confidence_raw)
        except ValueError:
            # Handle letter format (H, M, L, n)
            confidence_str = str(confidence_raw).upper().strip()
            if confidence_str == 'H':
                return 85.0  # High confidence
            elif confidence_str == 'M':
                return 65.0  # Medium confidence
            elif confidence_str == 'L':
                return 35.0  # Low confidence
            elif confidence_str == 'N':
                return 15.0  # Very low/nominal confidence
            else:
                return 50.0  # Default medium confidence
    
    def _safe_float(self, value: str) -> float:
        """Safely convert string to float"""
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0.0
    
    def _empty_geojson(self) -> Dict[str, Any]:
        """Return empty GeoJSON structure"""
        return {
            "type": "FeatureCollection",
            "features": [],
            "metadata": {
                "total_detections": 0,
                "generated_at": datetime.now().isoformat(),
                "message": "No fire detections found"
            }
        }
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self.cache:
            return False
        if cache_key not in self.cache_expiry:
            return False
        return datetime.now() < self.cache_expiry[cache_key]
    
    async def get_fire_statistics(self, dataset: str = "VIIRS_NOAA20_NRT", days: int = 1) -> Dict[str, Any]:
        """Get fire detection statistics for Texas"""
        try:
            fire_data = await self.fetch_fire_data(dataset, days)
            features = fire_data.get('features', [])
            
            if not features:
                return {
                    "total_detections": 0,
                    "confidence_breakdown": {},
                    "intensity_breakdown": {},
                    "dataset": dataset,
                    "time_period": f"Last {days} day(s)"
                }
            
            # Analyze confidence levels
            confidence_counts = {"High": 0, "Medium": 0, "Low": 0, "Very Low": 0}
            intensity_counts = {"Very High": 0, "High": 0, "Medium": 0, "Low": 0, "Very Low": 0}
            
            for feature in features:
                props = feature.get('properties', {})
                conf_level = props.get('confidence_level', 'Unknown')
                intensity_level = props.get('fire_intensity', 'Unknown')
                
                if conf_level in confidence_counts:
                    confidence_counts[conf_level] += 1
                if intensity_level in intensity_counts:
                    intensity_counts[intensity_level] += 1
            
            return {
                "total_detections": len(features),
                "confidence_breakdown": confidence_counts,
                "intensity_breakdown": intensity_counts,
                "dataset": dataset,
                "dataset_name": self.DATASETS.get(dataset, dataset),
                "time_period": f"Last {days} day(s)",
                "last_updated": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting fire statistics: {e}")
            raise HTTPException(status_code=500, detail=f"Statistics generation failed: {str(e)}")
    
    async def get_available_datasets(self) -> Dict[str, Any]:
        """Get list of available FIRMS datasets"""
        return {
            "datasets": [
                {
                    "id": dataset_id,
                    "name": dataset_name,
                    "description": f"Fire detections from {dataset_name}"
                }
                for dataset_id, dataset_name in self.DATASETS.items()
            ],
            "default_dataset": "VIIRS_NOAA20_NRT",
            "texas_bbox": self.TEXAS_BBOX
        }
    
    def clear_cache(self):
        """Clear fire data cache"""
        self.cache.clear()
        self.cache_expiry.clear()
        logger.info("🧹 Fire data cache cleared")

# Global fire tracking service instance
fire_tracking_service = FireTrackingService()
