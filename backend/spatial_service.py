import sqlite3
import json
import time
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import logging
import hashlib
import os

from shapely.geometry import Point, Polygon, MultiPolygon, shape
from shapely.ops import nearest_points
import geojson

from models import (
    SpatialQueryResponse, 
    PolygonMatch, 
    NearestPoint, 
    QueryCoordinates,
    LayerInfo,
    LayerStats
)

logger = logging.getLogger(__name__)

class SpatialQueryService:
    """High-performance spatial query service using SQLite with spatial functions"""
    
    def __init__(self):
        self.db_path = "spatial_data.db"  # Persistent database file
        self.conn = None
        self.layer_metadata = {}
        self.force_rebuild = False  # Flag to force database rebuild
        
    async def initialize_spatial_data(self, geojson_dir: Path):
        """Initialize spatial database with GeoJSON data"""
        logger.info("🔧 Initializing spatial database...")
        
        # Connect to database
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.enable_load_extension(True)
        
        # Enable spatial functions (if available)
        try:
            self.conn.load_extension("mod_spatialite")
            logger.info("✅ SpatiaLite loaded successfully")
        except Exception:
            logger.warning("⚠️ SpatiaLite not available, using custom spatial functions")
        
        # Check if database already has data and is up to date (unless force rebuild)
        if not self.force_rebuild and await self._is_database_current(geojson_dir):
            logger.info("✅ Database is current, skipping data reload")
            await self._load_layer_metadata()
            return
        
        logger.info("🔄 Database needs updating, loading fresh data...")
        
        # Clear existing data if rebuilding
        if self.force_rebuild:
            await self._clear_database()
        
        # Create tables
        await self._create_tables()
        
        # Load GeoJSON files
        await self._load_geojson_files(geojson_dir)
        
        # Create spatial indexes
        await self._create_spatial_indexes()
        
        # Store database checksum for future comparisons
        await self._store_database_checksum(geojson_dir)
        
        logger.info("✅ Spatial database initialization complete")
    
    async def _create_tables(self):
        """Create database tables for spatial data"""
        cursor = self.conn.cursor() # it is a cursor object that allows us to execute SQL commands on the database 
        
        # Polygon features table
        cursor.execute("""
            CREATE TABLE polygon_features (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                layer_id TEXT NOT NULL,
                layer_name TEXT NOT NULL,
                properties TEXT,
                geometry_wkt TEXT,
                min_lon REAL,
                min_lat REAL,
                max_lon REAL,
                max_lat REAL
            )
        """)
        
        # Point features table
        cursor.execute("""
            CREATE TABLE point_features (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                layer_id TEXT NOT NULL,
                layer_name TEXT NOT NULL,
                properties TEXT,
                longitude REAL,
                latitude REAL
            )
        """)
        
        # Layer metadata table
        cursor.execute("""
            CREATE TABLE layer_metadata (
                layer_id TEXT PRIMARY KEY,
                layer_name TEXT,
                layer_type TEXT,
                feature_count INTEGER,
                file_size_mb REAL,
                bounds_json TEXT
            )
        """)
        
        self.conn.commit()
    
    async def _load_geojson_files(self, geojson_dir: Path):
        """Load all GeoJSON files into the database"""
        geojson_files = list(geojson_dir.glob("*.geojson"))
        logger.info(f"📂 Found {len(geojson_files)} GeoJSON files")
        logger.info(f"🔄 Loading ALL files including large demographic datasets...")
        
        for geojson_file in geojson_files:
            try:
                await self._load_single_geojson(geojson_file)
            except Exception as e:
                logger.error(f"❌ Failed to load {geojson_file.name}: {str(e)}")
    
    async def _load_single_geojson(self, geojson_file: Path):
        """Load a single GeoJSON file into the database"""
        start_time = time.time()
        logger.info(f"📥 Loading {geojson_file.name}...")
        
        # Read GeoJSON data
        with open(geojson_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'features' not in data:
            logger.warning(f"⚠️ No features in {geojson_file.name}")
            return
        
        features = data['features']
        layer_id = geojson_file.stem.lower().replace('texas_', '').replace('_', '-') # it is a unique identifier for the layer , it is the name of the file without the extension , eg texas_parks.geojson -> parks
        layer_name = geojson_file.stem.replace('_', ' ').replace('Texas ', '').title() # it is the name of the layer , eg texas_parks.geojson -> Parks
        print(f"layer_id: {layer_id}, layer_name: {layer_name}") # debug print
        cursor = self.conn.cursor()
        
        polygon_count = 0
        point_count = 0
        
        for feature in features:
            try:
                geometry = feature.get('geometry', {})
                properties = feature.get('properties', {})
                geom_type = geometry.get('type', '')
                
                # Clean properties - remove technical fields
                clean_properties = self._clean_properties(properties)
                properties_json = json.dumps(clean_properties)
                
                if geom_type in ['Polygon', 'MultiPolygon']:
                    # Convert to Shapely geometry
                    geom = shape(geometry) # it is a shapely geometry object that represents the geometry of the feature 
                    bounds = geom.bounds  # (min_lon, min_lat, max_lon, max_lat)
                    
                    cursor.execute("""
                        INSERT INTO polygon_features 
                        (layer_id, layer_name, properties, geometry_wkt, min_lon, min_lat, max_lon, max_lat)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        layer_id, layer_name, properties_json, geom.wkt,
                        bounds[0], bounds[1], bounds[2], bounds[3]
                    ))
                    polygon_count += 1
                    
                elif geom_type in ['Point', 'MultiPoint']:
                    # Handle both Point and MultiPoint geometries
                    geom = shape(geometry)
                    
                    if geom_type == 'Point':
                        # Single point
                        longitude, latitude = geom.x, geom.y
                        
                        # Debug logging for parks
                        if 'park' in geojson_file.name.lower():
                            logger.info(f"🏞️ Loading park point: {longitude}, {latitude} from {geojson_file.name}")
                        
                        cursor.execute("""
                            INSERT INTO point_features 
                            (layer_id, layer_name, properties, longitude, latitude)
                            VALUES (?, ?, ?, ?, ?)
                        """, (
                            layer_id, layer_name, properties_json, longitude, latitude
                        ))
                        point_count += 1
                    else:
                        # MultiPoint - insert each point separately
                        for point in geom.geoms:
                            longitude, latitude = point.x, point.y
                            cursor.execute("""
                                INSERT INTO point_features 
                                (layer_id, layer_name, properties, longitude, latitude)
                                VALUES (?, ?, ?, ?, ?)
                            """, (
                                layer_id, layer_name, properties_json, longitude, latitude
                            ))
                            point_count += 1
                            
                elif geom_type in ['LineString', 'MultiLineString']:
                    # Treat line features as point features using centroid
                    geom = shape(geometry)
                    centroid = geom.centroid
                    longitude, latitude = centroid.x, centroid.y
                    
                    cursor.execute("""
                        INSERT INTO point_features 
                        (layer_id, layer_name, properties, longitude, latitude)
                        VALUES (?, ?, ?, ?, ?)
                    """, (
                        layer_id, layer_name, properties_json, longitude, latitude
                    ))
                    point_count += 1
                    
                else:
                    # Log unhandled geometry types for debugging
                    logger.warning(f"⚠️ Unhandled geometry type '{geom_type}' in {geojson_file.name}")
                    
            except Exception as e:
                logger.warning(f"⚠️ Error processing feature in {geojson_file.name}: {str(e)}")
        
        # Store layer metadata
        file_size_mb = geojson_file.stat().st_size / (1024 * 1024)
        total_features = polygon_count + point_count
        layer_type = 'polygon' if polygon_count > point_count else 'point'
        
        # Calculate bounds
        if polygon_count > 0: # if there are any polygons in the layer , we need to calculate the bounds of the layer 
            cursor.execute("""
                SELECT MIN(min_lon), MIN(min_lat), MAX(max_lon), MAX(max_lat)
                FROM polygon_features WHERE layer_id = ?
            """, (layer_id,))
            bounds_result = cursor.fetchone() # it is a tuple that contains the bounds of the layer 
            bounds = {
                'min_lon': bounds_result[0],
                'min_lat': bounds_result[1], 
                'max_lon': bounds_result[2],
                'max_lat': bounds_result[3]
            }
        elif point_count > 0: # if there are any points in the layer , we need to calculate the bounds of the layer 
            cursor.execute("""
                SELECT MIN(longitude), MIN(latitude), MAX(longitude), MAX(latitude)
                FROM point_features WHERE layer_id = ?
            """, (layer_id,))
            bounds_result = cursor.fetchone() # it is a tuple that contains the bounds of the layer 
            bounds = {
                'min_lon': bounds_result[0],
                'min_lat': bounds_result[1],
                'max_lon': bounds_result[2], 
                'max_lat': bounds_result[3]
            }
        else:
            bounds = {}
        
        cursor.execute("""
            INSERT INTO layer_metadata 
            (layer_id, layer_name, layer_type, feature_count, file_size_mb, bounds_json)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            layer_id, layer_name, layer_type, total_features, file_size_mb, json.dumps(bounds)
        ))
        
        self.conn.commit()
        
        load_time = time.time() - start_time
        logger.info(f"✅ Loaded {geojson_file.name}: {total_features} features ({polygon_count} polygons, {point_count} points) in {load_time:.2f}s")
    
    async def _create_spatial_indexes(self):
        """Create spatial indexes for fast queries"""
        logger.info("🔧 Creating spatial indexes...")
        cursor = self.conn.cursor()
        
        # Indexes for polygon queries
        cursor.execute("CREATE INDEX idx_polygon_layer ON polygon_features(layer_id)")
        cursor.execute("CREATE INDEX idx_polygon_bounds ON polygon_features(min_lon, min_lat, max_lon, max_lat)")
        
        # Indexes for point queries  
        cursor.execute("CREATE INDEX idx_point_layer ON point_features(layer_id)")
        cursor.execute("CREATE INDEX idx_point_coords ON point_features(longitude, latitude)")
        
        # Metadata index
        cursor.execute("CREATE INDEX idx_layer_metadata ON layer_metadata(layer_id)")
        
        self.conn.commit()
        logger.info("✅ Spatial indexes created")
    
    async def _is_database_current(self, geojson_dir: Path) -> bool:
        """Check if database exists and is current with GeoJSON files"""
        if not os.path.exists(self.db_path):
            return False
        
        try:
            cursor = self.conn.cursor()
            
            # Check if tables exist
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='layer_metadata'")
            if not cursor.fetchone():
                return False
            
            # Check if we have any data
            cursor.execute("SELECT COUNT(*) FROM layer_metadata")
            if cursor.fetchone()[0] == 0:
                return False
            
            # Check if checksum table exists and matches current files
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='database_checksum'")
            if not cursor.fetchone():
                return False
            
            # Get stored checksum
            cursor.execute("SELECT checksum FROM database_checksum LIMIT 1")
            stored_checksum = cursor.fetchone()
            if not stored_checksum:
                return False
            
            # Calculate current checksum
            current_checksum = await self._calculate_directory_checksum(geojson_dir)
            
            return stored_checksum[0] == current_checksum
            
        except Exception as e:
            logger.warning(f"⚠️ Error checking database currency: {e}")
            return False
    
    async def _calculate_directory_checksum(self, geojson_dir: Path) -> str:
        """Calculate checksum of all GeoJSON files in directory"""
        hash_md5 = hashlib.md5()
        
        geojson_files = sorted(geojson_dir.glob("*.geojson"))
        for geojson_file in geojson_files:
            # Include filename and modification time in checksum
            file_info = f"{geojson_file.name}:{geojson_file.stat().st_mtime}:{geojson_file.stat().st_size}"
            hash_md5.update(file_info.encode())
        
        return hash_md5.hexdigest()
    
    async def _store_database_checksum(self, geojson_dir: Path):
        """Store current directory checksum in database"""
        cursor = self.conn.cursor()
        
        # Create checksum table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS database_checksum (
                id INTEGER PRIMARY KEY,
                checksum TEXT,
                created_at TEXT
            )
        """)
        
        # Clear old checksums and store new one
        checksum = await self._calculate_directory_checksum(geojson_dir)
        cursor.execute("DELETE FROM database_checksum")
        cursor.execute("""
            INSERT INTO database_checksum (checksum, created_at)
            VALUES (?, ?)
        """, (checksum, datetime.now().isoformat()))
        
        self.conn.commit()
    
    async def _load_layer_metadata(self):
        """Load layer metadata from existing database"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT layer_id, layer_name FROM layer_metadata")
        
        for layer_id, layer_name in cursor.fetchall():
            self.layer_metadata[layer_id] = layer_name
        
        logger.info(f"📋 Loaded metadata for {len(self.layer_metadata)} layers")
    
    async def _clear_database(self):
        """Clear all existing data from database"""
        cursor = self.conn.cursor()
        
        # Get all table names
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        # Drop all tables
        for table in tables:
            if table[0] != 'sqlite_sequence':  # Don't drop SQLite system table
                cursor.execute(f"DROP TABLE IF EXISTS {table[0]}")
        
        self.conn.commit()
        logger.info("🗑️ Cleared existing database tables")
    
    def _clean_properties(self, properties: Dict[str, Any]) -> Dict[str, Any]:
        """Clean feature properties by removing technical fields"""
        excluded_keys = {
            'OBJECTID', 'objectid', 'FID', 'fid', 'SHAPE_LENG', 'SHAPE_AREA',
            'Shape_Leng', 'Shape_Area', 'geometry', 'GEOMETRY', 'GlobalID',
            'globalid', 'created_user', 'created_date', 'last_edited_user', 
            'last_edited_date'
        }
        
        cleaned = {}
        for key, value in properties.items():
            if (key not in excluded_keys and 
                value is not None and 
                value != '' and 
                value != 'null'):
                
                # Format key for better display
                formatted_key = (key.replace('_', ' ')
                               .replace('-', ' ')
                               .title())
                cleaned[formatted_key] = value
        
        return cleaned
    
    async def query_point(self, longitude: float, latitude: float, 
                         max_distance_km: float = 100, 
                         max_nearest_points: int = 10) -> SpatialQueryResponse:
        """Perform spatial query for a given point"""
        start_time = time.time()
        
        query_point = Point(longitude, latitude)
        
        # Find polygon matches
        polygon_matches = await self._find_polygon_matches(query_point)
        
        # Find nearest points
        nearest_points = await self._find_nearest_points(query_point, max_distance_km, max_nearest_points)
        
        # Get total layers searched
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(DISTINCT layer_id) FROM layer_metadata")
        total_layers = cursor.fetchone()[0]
        
        query_duration = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        return SpatialQueryResponse(
            click_coordinates=QueryCoordinates(
                longitude=longitude,
                latitude=latitude,
                formatted=f"{latitude:.6f}, {longitude:.6f}"
            ),
            polygon_matches=polygon_matches,
            nearest_points=nearest_points,
            query_timestamp=datetime.now(),
            query_duration_ms=query_duration,
            total_layers_searched=total_layers
        )
    
    async def _find_polygon_matches(self, query_point: Point) -> List[PolygonMatch]:
        """Find all polygons that contain the query point"""
        cursor = self.conn.cursor()
        
        # First, filter by bounding box for efficiency
        cursor.execute("""
            SELECT layer_id, layer_name, properties, geometry_wkt
            FROM polygon_features
            WHERE min_lon <= ? AND max_lon >= ? AND min_lat <= ? AND max_lat >= ?
        """, (query_point.x, query_point.x, query_point.y, query_point.y))
        
        candidates = cursor.fetchall()
        matches = []
        
        for layer_id, layer_name, properties_json, geometry_wkt in candidates:
            try:
                # Parse the geometry and check if point is inside
                from shapely import wkt
                polygon = wkt.loads(geometry_wkt)
                
                if polygon.contains(query_point):
                    properties = json.loads(properties_json)
                    matches.append(PolygonMatch(
                        properties=properties,
                        layer_id=layer_id,
                        layer_name=layer_name
                    ))
            except Exception as e:
                logger.warning(f"⚠️ Error checking polygon containment: {str(e)}")
        
        return matches
    
    async def _find_nearest_points(self, query_point: Point, max_distance_km: float, 
                                 max_points: int) -> List[NearestPoint]:
        """Find nearest point features to the query point"""
        cursor = self.conn.cursor()
        
        # Rough bounding box filter (1 degree ≈ 111 km)
        degree_buffer = max_distance_km / 111.0
        
        cursor.execute("""
            SELECT layer_id, layer_name, properties, longitude, latitude
            FROM point_features
            WHERE longitude BETWEEN ? AND ? AND latitude BETWEEN ? AND ?
        """, (
            query_point.x - degree_buffer, query_point.x + degree_buffer,
            query_point.y - degree_buffer, query_point.y + degree_buffer
        ))
        
        candidates = cursor.fetchall()
        distances = []
        
        for layer_id, layer_name, properties_json, longitude, latitude in candidates:
            try:
                point = Point(longitude, latitude)
                # Calculate distance in kilometers
                distance_km = query_point.distance(point) * 111.0  # Rough conversion
                
                if distance_km <= max_distance_km:
                    properties = json.loads(properties_json)
                    
                    # Debug logging for parks
                    if 'park' in layer_name.lower():
                        park_name = properties.get('P_NAME', properties.get('NAME', 'Unknown'))
                        logger.info(f"🏞️ Found park in search: {park_name} ({layer_name}) at {distance_km:.2f}km")
                    
                    distances.append((
                        distance_km,
                        NearestPoint(
                            properties=properties,
                            layer_id=layer_id,
                            layer_name=layer_name,
                            distance_km=distance_km,
                            distance_formatted=f"{distance_km:.2f} km"
                        )
                    ))
            except Exception as e:
                logger.warning(f"⚠️ Error calculating distance: {str(e)}")
        
        # Sort by distance and return top results
        distances.sort(key=lambda x: x[0])
        return [point for _, point in distances[:max_points]]
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        cursor = self.conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM layer_metadata")
        total_layers = cursor.fetchone()[0]
        
        cursor.execute("SELECT SUM(feature_count) FROM layer_metadata") 
        total_features = cursor.fetchone()[0] or 0
        
        cursor.execute("SELECT COUNT(*) FROM polygon_features")
        polygon_features = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM point_features")
        point_features = cursor.fetchone()[0]
        
        return {
            "total_layers": total_layers,
            "total_features": total_features,
            "polygon_features": polygon_features,
            "point_features": point_features,
            "indexed_layers": total_layers  # All layers are indexed
        }
    
    async def get_layers_info(self) -> List[LayerInfo]:
        """Get information about all layers"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT layer_id, layer_name, layer_type, feature_count, file_size_mb
            FROM layer_metadata
            ORDER BY layer_name
        """)
        
        layers = []
        for row in cursor.fetchall():
            layers.append(LayerInfo(
                layer_id=row[0],
                layer_name=row[1],
                layer_type=row[2],
                feature_count=row[3],
                file_size_mb=row[4],
                is_indexed=True
            ))
        
        return layers
    
    async def get_layer_stats(self, layer_id: str) -> Optional[LayerStats]:
        """Get detailed statistics for a specific layer"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            SELECT layer_name, feature_count, bounds_json
            FROM layer_metadata WHERE layer_id = ?
        """, (layer_id,))
        
        result = cursor.fetchone()
        if not result:
            return None
        
        layer_name, feature_count, bounds_json = result
        bounds = json.loads(bounds_json) if bounds_json else {}
        
        # Get geometry types
        geometry_types = []
        cursor.execute("SELECT COUNT(*) FROM polygon_features WHERE layer_id = ?", (layer_id,))
        if cursor.fetchone()[0] > 0:
            geometry_types.append("Polygon")
            
        cursor.execute("SELECT COUNT(*) FROM point_features WHERE layer_id = ?", (layer_id,))
        if cursor.fetchone()[0] > 0:
            geometry_types.append("Point")
        
        # Get sample properties
        sample_properties = {}
        cursor.execute("""
            SELECT properties FROM polygon_features WHERE layer_id = ? LIMIT 1
            UNION
            SELECT properties FROM point_features WHERE layer_id = ? LIMIT 1
        """, (layer_id, layer_id))
        
        result = cursor.fetchone()
        if result:
            sample_properties = json.loads(result[0])
        
        return LayerStats(
            layer_id=layer_id,
            layer_name=layer_name,
            feature_count=feature_count,
            geometry_types=geometry_types,
            bounds=bounds if bounds else None,
            properties_sample=sample_properties if sample_properties else None
        )
    
    async def cleanup(self):
        """Cleanup database connections"""
        if self.conn:
            self.conn.close()
            logger.info("🧹 Database connection closed") 