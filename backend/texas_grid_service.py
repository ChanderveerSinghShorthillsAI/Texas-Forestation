"""
Texas Grid Service
Manages the grid-based fire prediction system for complete Texas coverage
"""
import csv
import asyncio
import logging
import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Tuple
from pathlib import Path
import json
from dataclasses import dataclass
import math

logger = logging.getLogger(__name__)

@dataclass
class GridCell:
    """Represents a single grid cell in the Texas grid system"""
    index: int
    min_lng: float
    min_lat: float
    max_lng: float
    max_lat: float
    
    @property
    def center_lat(self) -> float:
        """Calculate center latitude of the grid cell"""
        return (self.min_lat + self.max_lat) / 2
    
    @property
    def center_lng(self) -> float:
        """Calculate center longitude of the grid cell"""
        return (self.min_lng + self.max_lng) / 2
    
    @property
    def area_km2(self) -> float:
        """Approximate area of the grid cell in km²"""
        # Rough calculation for rectangular grid cells
        lat_km = abs(self.max_lat - self.min_lat) * 111  # 1 degree ≈ 111 km
        lng_km = abs(self.max_lng - self.min_lng) * 111 * math.cos(math.radians(self.center_lat))
        return lat_km * lng_km

@dataclass
class GridFireRisk:
    """Fire risk data for a grid cell"""
    grid_index: int
    lat: float
    lng: float
    fire_risk_score: float
    risk_category: str
    risk_color: str
    max_risk_24h: float
    avg_risk_24h: float
    forecast_timestamp: datetime
    weather_data: Dict[str, Any]

class TexasGridService:
    """Service for managing Texas-wide grid-based fire prediction"""
    
    def __init__(self, grid_csv_path: str = None, db_path: str = "texas_fire_grid.db"):
        self.grid_csv_path = grid_csv_path or "../frontend/public/texas_grid_cells.csv"
        self.db_path = db_path
        self.grid_cells: List[GridCell] = []
        self.total_cells = 0
        
        # Grid optimization settings
        self.max_concurrent_requests = 50  # Limit concurrent API calls
        self.batch_size = 100  # Process cells in batches
        self.cache_duration_hours = 6  # Cache results for 6 hours
        
        # Initialize database
        self._init_database()
        
    def _init_database(self):
        """Initialize SQLite database for caching grid fire risk data"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS grid_fire_risk (
                        grid_index INTEGER PRIMARY KEY,
                        lat REAL NOT NULL,
                        lng REAL NOT NULL,
                        fire_risk_score REAL NOT NULL,
                        risk_category TEXT NOT NULL,
                        risk_color TEXT NOT NULL,
                        max_risk_24h REAL NOT NULL,
                        avg_risk_24h REAL NOT NULL,
                        forecast_timestamp TEXT NOT NULL,
                        weather_data TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_grid_timestamp 
                    ON grid_fire_risk(forecast_timestamp)
                """)
                
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_grid_risk_score 
                    ON grid_fire_risk(fire_risk_score)
                """)
                
                logger.info("Grid fire risk database initialized")
                
        except Exception as e:
            logger.error(f"Error initializing database: {str(e)}")
            raise
    
    def load_grid_cells(self) -> bool:
        """Load grid cells from CSV file"""
        try:
            grid_path = Path(self.grid_csv_path)
            if not grid_path.exists():
                # Try alternative path
                alt_path = Path("Texas-Forestation") / self.grid_csv_path
                if alt_path.exists():
                    grid_path = alt_path
                else:
                    logger.error(f"Grid CSV file not found: {self.grid_csv_path}")
                    return False
            
            self.grid_cells = []
            with open(grid_path, 'r') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    cell = GridCell(
                        index=int(row['index']),
                        min_lng=float(row['min_lng']),
                        min_lat=float(row['min_lat']),
                        max_lng=float(row['max_lng']),
                        max_lat=float(row['max_lat'])
                    )
                    self.grid_cells.append(cell)
            
            self.total_cells = len(self.grid_cells)
            logger.info(f"Loaded {self.total_cells} grid cells from {grid_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error loading grid cells: {str(e)}")
            return False
    
    def get_strategic_grid_points(self, density_factor: float = 0.1) -> List[GridCell]:
        """
        Get strategic subset of grid points for efficient coverage
        
        Args:
            density_factor: Fraction of total cells to include (0.1 = 10%)
            
        Returns:
            List of strategically selected grid cells
        """
        if not self.grid_cells:
            if not self.load_grid_cells():
                return []
        
        total_to_select = max(100, int(self.total_cells * density_factor))
        
        # Strategy: Select evenly distributed points across Texas
        # This ensures good geographic coverage without overwhelming API calls
        step_size = max(1, self.total_cells // total_to_select)
        
        strategic_cells = []
        for i in range(0, self.total_cells, step_size):
            if len(strategic_cells) >= total_to_select:
                break
            strategic_cells.append(self.grid_cells[i])
        
        logger.info(f"Selected {len(strategic_cells)} strategic grid points from {self.total_cells} total cells")
        return strategic_cells

    def get_texas_regional_representatives(self) -> List[GridCell]:
        """
        Get carefully selected representative grid cells that cover all major Texas regions
        Uses only ~200-300 API calls instead of 26,000+ while maintaining full state coverage
        
        Returns:
            List of representative grid cells covering all Texas regions
        """
        if not self.grid_cells:
            if not self.load_grid_cells():
                return []
        
        logger.info("Selecting Texas regional representatives for comprehensive coverage")
        
        # Define Texas geographic regions with their approximate boundaries
        texas_regions = {
            "East_Texas_Piney_Woods": {"lat_range": (30.0, 34.0), "lng_range": (-95.5, -93.5)},
            "Gulf_Coast": {"lat_range": (25.8, 30.0), "lng_range": (-97.5, -93.5)},
            "South_Texas_Plains": {"lat_range": (25.8, 29.5), "lng_range": (-100.0, -97.0)},
            "Hill_Country": {"lat_range": (29.5, 31.5), "lng_range": (-100.5, -97.5)},
            "Central_Texas": {"lat_range": (30.0, 32.0), "lng_range": (-98.5, -96.5)},
            "North_Texas_Plains": {"lat_range": (32.0, 34.0), "lng_range": (-98.0, -95.5)},
            "West_Texas_Desert": {"lat_range": (29.5, 32.0), "lng_range": (-106.6, -102.0)},
            "Panhandle_Plains": {"lat_range": (34.0, 36.5), "lng_range": (-106.6, -99.0)},
            "Edwards_Plateau": {"lat_range": (29.5, 31.5), "lng_range": (-101.5, -99.0)},
            "Cross_Timbers": {"lat_range": (32.0, 34.0), "lng_range": (-99.0, -96.5)},
            "Rio_Grande_Valley": {"lat_range": (25.8, 27.0), "lng_range": (-99.0, -97.0)},
            "Trans_Pecos": {"lat_range": (29.5, 32.0), "lng_range": (-106.6, -103.5)}
        }
        
        regional_representatives = []
        cells_per_region = 25  # ~25 cells per region = ~300 total API calls
        
        for region_name, bounds in texas_regions.items():
            lat_min, lat_max = bounds["lat_range"]
            lng_min, lng_max = bounds["lng_range"]
            
            # Find all cells within this region
            region_cells = []
            for cell in self.grid_cells:
                if (lat_min <= cell.center_lat <= lat_max and 
                    lng_min <= cell.center_lng <= lng_max):
                    region_cells.append(cell)
            
            if not region_cells:
                continue
                
            # Select representative cells from this region using systematic sampling
            if len(region_cells) <= cells_per_region:
                # If region has few cells, take all
                selected_cells = region_cells
            else:
                # Systematic sampling for even distribution
                step = len(region_cells) // cells_per_region
                selected_cells = [region_cells[i] for i in range(0, len(region_cells), step)][:cells_per_region]
            
            regional_representatives.extend(selected_cells)
            logger.info(f"Selected {len(selected_cells)} cells from {region_name} region ({len(region_cells)} total cells)")
        
        # Add some border cells to ensure complete coverage
        border_cells = self._get_texas_border_cells(20)  # 20 border cells
        regional_representatives.extend(border_cells)
        
        # Remove duplicates
        seen_indices = set()
        unique_representatives = []
        for cell in regional_representatives:
            if cell.index not in seen_indices:
                seen_indices.add(cell.index)
                unique_representatives.append(cell)
        
        logger.info(f"Selected {len(unique_representatives)} total representative cells covering all Texas regions")
        logger.info(f"API calls reduced from {self.total_cells} to {len(unique_representatives)} ({(len(unique_representatives)/self.total_cells)*100:.1f}% of original)")
        
        return unique_representatives
    
    def _get_texas_border_cells(self, count: int) -> List[GridCell]:
        """Get cells along Texas borders for complete coverage"""
        if not self.grid_cells:
            return []
        
        # Find extreme boundary cells
        border_cells = []
        
        # Sort by different criteria to get border cells
        lat_sorted = sorted(self.grid_cells, key=lambda c: c.center_lat)
        lng_sorted = sorted(self.grid_cells, key=lambda c: c.center_lng)
        
        # Take cells from extremes
        border_cells.extend(lat_sorted[:count//4])  # Southernmost
        border_cells.extend(lat_sorted[-count//4:])  # Northernmost
        border_cells.extend(lng_sorted[:count//4])  # Westernmost  
        border_cells.extend(lng_sorted[-count//4:])  # Easternmost
        
        return border_cells
    
    def get_high_risk_areas_cells(self) -> List[GridCell]:
        """
        Get grid cells for known high-risk fire areas in Texas
        Focus on forested and drought-prone regions
        """
        high_risk_regions = [
            # East Texas forests
            {"lat_range": (31.0, 33.5), "lng_range": (-95.5, -93.5)},
            # Central Texas hill country  
            {"lat_range": (29.5, 31.0), "lng_range": (-99.0, -97.0)},
            # West Texas dry regions
            {"lat_range": (31.0, 33.0), "lng_range": (-104.0, -100.0)},
            # South Texas brush country
            {"lat_range": (26.0, 29.0), "lng_range": (-99.5, -97.0)},
            # Panhandle grasslands
            {"lat_range": (34.0, 36.5), "lng_range": (-103.0, -100.0)}
        ]
        
        high_risk_cells = []
        for cell in self.grid_cells:
            for region in high_risk_regions:
                lat_range = region["lat_range"]
                lng_range = region["lng_range"]
                
                if (lat_range[0] <= cell.center_lat <= lat_range[1] and
                    lng_range[0] <= cell.center_lng <= lng_range[1]):
                    high_risk_cells.append(cell)
                    break
        
        logger.info(f"Identified {len(high_risk_cells)} high-risk area cells")
        return high_risk_cells
    
    def get_cached_fire_risk(self, max_age_hours: int = 6) -> List[GridFireRisk]:
        """
        Get cached fire risk data that's still fresh
        
        Args:
            max_age_hours: Maximum age of cached data in hours
            
        Returns:
            List of cached grid fire risk data
        """
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
            
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("""
                    SELECT * FROM grid_fire_risk 
                    WHERE datetime(forecast_timestamp) > datetime(?)
                    ORDER BY fire_risk_score DESC
                """, (cutoff_time.isoformat(),))
                
                cached_risks = []
                for row in cursor.fetchall():
                    risk = GridFireRisk(
                        grid_index=row['grid_index'],
                        lat=row['lat'],
                        lng=row['lng'],
                        fire_risk_score=row['fire_risk_score'],
                        risk_category=row['risk_category'],
                        risk_color=row['risk_color'],
                        max_risk_24h=row['max_risk_24h'],
                        avg_risk_24h=row['avg_risk_24h'],
                        forecast_timestamp=datetime.fromisoformat(row['forecast_timestamp']),
                        weather_data=json.loads(row['weather_data'])
                    )
                    cached_risks.append(risk)
                
                logger.info(f"Retrieved {len(cached_risks)} cached fire risk records")
                return cached_risks
                
        except Exception as e:
            logger.error(f"Error retrieving cached fire risk data: {str(e)}")
            return []
    
    def save_fire_risk_data(self, fire_risks: List[GridFireRisk]):
        """
        Save fire risk data to cache database
        
        Args:
            fire_risks: List of grid fire risk data to save
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Clear old data first
                conn.execute("DELETE FROM grid_fire_risk")
                
                # Insert new data
                for risk in fire_risks:
                    conn.execute("""
                        INSERT OR REPLACE INTO grid_fire_risk (
                            grid_index, lat, lng, fire_risk_score, risk_category,
                            risk_color, max_risk_24h, avg_risk_24h, forecast_timestamp,
                            weather_data, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """, (
                        risk.grid_index,
                        risk.lat,
                        risk.lng,
                        risk.fire_risk_score,
                        risk.risk_category,
                        risk.risk_color,
                        risk.max_risk_24h,
                        risk.avg_risk_24h,
                        risk.forecast_timestamp.isoformat(),
                        json.dumps(risk.weather_data)
                    ))
                
                conn.commit()
                logger.info(f"Saved {len(fire_risks)} fire risk records to cache")
                
        except Exception as e:
            logger.error(f"Error saving fire risk data: {str(e)}")
            raise
    
    def clear_cache(self):
        """Clear all cached fire risk data from database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM grid_fire_risk")
                deleted_count = cursor.rowcount
                conn.commit()
                logger.info(f"🧹 Cleared {deleted_count} cached fire risk records from database")
                return deleted_count
                
        except Exception as e:
            logger.error(f"Error clearing cache: {str(e)}")
            raise
    
    def get_fire_risk_geojson(self, risk_threshold: float = 40.0) -> Dict[str, Any]:
        """
        Generate GeoJSON for fire risk visualization
        
        Args:
            risk_threshold: Minimum risk score to include in output
            
        Returns:
            GeoJSON FeatureCollection for map visualization
        """
        try:
            cached_risks = self.get_cached_fire_risk()
            
            features = []
            for risk in cached_risks:
                if risk.fire_risk_score >= risk_threshold:
                    feature = {
                        "type": "Feature",
                        "properties": {
                            "grid_index": risk.grid_index,
                            "fire_risk_score": risk.fire_risk_score,
                            "risk_category": risk.risk_category,
                            "risk_color": risk.risk_color,
                            "max_risk_24h": risk.max_risk_24h,
                            "avg_risk_24h": risk.avg_risk_24h,
                            "forecast_time": risk.forecast_timestamp.isoformat(),
                            "temperature": risk.weather_data.get("temperature_2m"),
                            "humidity": risk.weather_data.get("relative_humidity_2m"),
                            "wind_speed": risk.weather_data.get("wind_speed_10m")
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [risk.lng, risk.lat]
                        }
                    }
                    features.append(feature)
            
            geojson = {
                "type": "FeatureCollection",
                "features": features,
                "metadata": {
                    "total_points": len(features),
                    "risk_threshold": risk_threshold,
                    "generated_at": datetime.utcnow().isoformat(),
                    "data_source": "Texas Grid Fire Prediction System"
                }
            }
            
            logger.info(f"Generated GeoJSON with {len(features)} fire risk points")
            return geojson
            
        except Exception as e:
            logger.error(f"Error generating fire risk GeoJSON: {str(e)}")
            return {"type": "FeatureCollection", "features": []}
    
    def get_grid_statistics(self) -> Dict[str, Any]:
        """Get statistics about the grid system and cached data"""
        try:
            cached_risks = self.get_cached_fire_risk()
            
            if not cached_risks:
                return {
                    "total_grid_cells": self.total_cells,
                    "cached_predictions": 0,
                    "last_update": None,
                    "coverage_percentage": 0.0
                }
            
            risk_scores = [r.fire_risk_score for r in cached_risks]
            risk_categories = {}
            for risk in cached_risks:
                cat = risk.risk_category
                risk_categories[cat] = risk_categories.get(cat, 0) + 1
            
            latest_update = max(r.forecast_timestamp for r in cached_risks)
            
            return {
                "total_grid_cells": self.total_cells,
                "cached_predictions": len(cached_risks),
                "coverage_percentage": round((len(cached_risks) / max(1, self.total_cells)) * 100, 2),
                "last_update": latest_update.isoformat(),
                "risk_statistics": {
                    "max_risk": round(max(risk_scores), 1),
                    "avg_risk": round(sum(risk_scores) / len(risk_scores), 1),
                    "min_risk": round(min(risk_scores), 1)
                },
                "risk_category_distribution": risk_categories,
                "high_risk_areas": len([r for r in cached_risks if r.fire_risk_score >= 60])
            }
            
        except Exception as e:
            logger.error(f"Error getting grid statistics: {str(e)}")
            return {"error": str(e)}

# Global service instance
texas_grid_service = TexasGridService()
