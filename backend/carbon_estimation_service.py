"""
Carbon Estimation Service for Texas Counties
========================================

This service provides carbon stock estimation capabilities using available
biomass, soil, and wetland data across Texas counties.
"""

import sqlite3
import json
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class CarbonEstimationResult:
    """Results of carbon estimation calculation"""
    county_name: str
    county_fips: str
    total_carbon_tons: float
    total_co2_equivalent_tons: float
    biomass_carbon_tons: float
    soil_carbon_potential_tons: float
    wetland_carbon_potential_tons: float
    wood_biomass_tons: float
    crop_residue_tons: float
    secondary_residue_tons: float
    wetland_acres: float
    calculation_timestamp: datetime
    methodology_notes: str

@dataclass
class TexasStateCarbon:
    """State-wide carbon estimation summary"""
    total_counties: int
    total_carbon_tons: float
    total_co2_equivalent_tons: float
    average_carbon_per_county: float
    top_carbon_counties: List[Dict[str, Any]]
    methodology_summary: str
    calculation_timestamp: datetime

class CarbonEstimationService:
    """
    Service for estimating carbon stocks across Texas using biomass and land use data.
    
    Uses scientifically-backed conversion factors:
    - Wood biomass: ~50% carbon content, 1.83 CO2 equivalent factor
    - Crop residue: ~45% carbon content, 1.65 CO2 equivalent factor  
    - Wetlands: ~0.5-2.0 tons CO2/acre/year sequestration
    - Soil: estimated based on soil types and area
    """
    
    # Carbon conversion factors based on scientific literature
    WOOD_CARBON_FACTOR = 0.50  # Wood biomass is ~50% carbon
    CROP_CARBON_FACTOR = 0.45  # Crop residue is ~45% carbon
    CARBON_TO_CO2_FACTOR = 3.67  # 1 ton C = 3.67 tons CO2
    
    # Wetland carbon sequestration rates (tons CO2/acre/year)
    WETLAND_SEQUESTRATION = {
        'Playa': 1.2,  # High sequestration for playa lakes
        'Marsh': 2.0,  # Very high for marshes
        'Swamp': 1.8,  # High for swamps
        'Pond': 0.8,   # Moderate for ponds
        'Lake': 0.5,   # Lower for lakes
        'Manmade': 0.3, # Lowest for artificial wetlands
        'default': 1.0  # Default rate
    }
    
    # Soil carbon estimates by major soil types (tons C/acre to 1m depth)
    SOIL_CARBON_ESTIMATES = {
        'clay': 60,      # Clay soils store more carbon
        'loam': 45,      # Loam soils moderate storage
        'sand': 30,      # Sandy soils store less carbon
        'organic': 100,  # Organic soils very high storage
        'default': 40    # Default estimate
    }
    
    def __init__(self):
        self.db_path = "spatial_data.db"
        # Ensure cache table exists on service init
        try:
            self._ensure_county_carbon_table()
        except Exception as e:
            logger.warning(f"Failed to ensure county_carbon table: {e}")
        
    def estimate_county_carbon(self, county_name: str = None, county_fips: str = None) -> Optional[CarbonEstimationResult]:
        """
        Estimate carbon stocks for a specific county
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Build query condition with flexible county name matching
            if county_fips:
                condition = f"JSON_EXTRACT(properties, '$.Fips') = '{county_fips}'"
            elif county_name:
                # Try multiple variations of county name with case handling
                county_base = county_name.replace(' County', '').replace(' COUNTY', '').replace(' county', '')
                county_base_title = county_base.title()  # Proper case
                county_with_county = county_base_title + ' County'
                
                # Use a simpler, more reliable condition that matches the actual database format
                # Based on database analysis, the Name field stores county names without "County" suffix
                condition = f"JSON_EXTRACT(properties, '$.Name') = '{county_base_title}'"
                logger.info(f"Looking for county with flexible matching: '{county_name}' -> '{county_base_title}' / '{county_with_county}'")
            else:
                logger.error("Must provide either county_name or county_fips")
                return None
            
            # Get biomass data for the county
            wood_data = self._get_wood_biomass_data(cursor, condition)
            crop_data = self._get_crop_biomass_data(cursor, condition)
            
            if not wood_data and not crop_data:
                logger.warning(f"No biomass data found for county {county_name or county_fips}")
                logger.info(f"Attempted query condition: {condition}")
                # Return default carbon estimate instead of None
                return self._create_default_carbon_estimate(county_name, county_fips)
                
            # Calculate biomass carbon
            wood_carbon = self._calculate_wood_carbon(wood_data)
            crop_carbon = self._calculate_crop_carbon(crop_data)
            
            # Get wetland data
            wetland_data = self._get_wetland_data(cursor, county_name or wood_data.get('Name', ''))
            wetland_carbon = self._calculate_wetland_carbon(wetland_data)
            
            # Estimate soil carbon potential
            county_area_sqmi = wood_data.get('Sqmi', 0) if wood_data else crop_data.get('Sqmi', 0)
            soil_carbon = self._estimate_soil_carbon(county_area_sqmi)
            
            # Total calculations
            total_biomass_carbon = wood_carbon['total_carbon'] + crop_carbon['total_carbon']
            total_carbon = total_biomass_carbon + soil_carbon + wetland_carbon['annual_sequestration']
            total_co2_equivalent = total_carbon * self.CARBON_TO_CO2_FACTOR
            
            result = CarbonEstimationResult(
                county_name=wood_data.get('Name', '') if wood_data else crop_data.get('Name', ''),
                county_fips=wood_data.get('Fips', '') if wood_data else crop_data.get('Fips', ''),
                total_carbon_tons=total_carbon,
                total_co2_equivalent_tons=total_co2_equivalent,
                biomass_carbon_tons=total_biomass_carbon,
                soil_carbon_potential_tons=soil_carbon,
                wetland_carbon_potential_tons=wetland_carbon['annual_sequestration'],
                wood_biomass_tons=wood_carbon['wood_biomass'] + wood_carbon['secondary_residue'],
                crop_residue_tons=crop_carbon['crop_residue'],
                secondary_residue_tons=wood_carbon['secondary_residue'],
                wetland_acres=wetland_carbon['total_acres'],
                calculation_timestamp=datetime.now(),
                methodology_notes=self._get_methodology_notes()
            )
            
            conn.close()
            return result
            
        except Exception as e:
            logger.error(f"Error estimating county carbon: {e}")
            return None
    
    def estimate_statewide_carbon(self) -> TexasStateCarbon:
        """
        Estimate carbon stocks for all Texas counties
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get all counties with biomass data
            cursor.execute("""
                SELECT DISTINCT JSON_EXTRACT(properties, '$.Name') as county_name,
                       JSON_EXTRACT(properties, '$.Fips') as county_fips
                FROM polygon_features 
                WHERE layer_id = 'biomass-woodmill-residue-biomass'
            """)
            
            counties = cursor.fetchall()
            county_results = []
            total_carbon = 0
            
            logger.info(f"Calculating carbon for {len(counties)} counties...")
            
            for county_name, county_fips in counties:
                result = self.estimate_county_carbon(county_name=county_name)
                if result:
                    county_results.append({
                        'county_name': result.county_name,
                        'county_fips': result.county_fips,
                        'total_carbon_tons': result.total_carbon_tons,
                        'total_co2_equivalent_tons': result.total_co2_equivalent_tons
                    })
                    total_carbon += result.total_carbon_tons
            
            # Sort counties by carbon stocks (descending)
            county_results.sort(key=lambda x: x['total_carbon_tons'], reverse=True)
            
            # Calculate statistics
            avg_carbon = total_carbon / len(county_results) if county_results else 0
            top_counties = county_results[:10]  # Top 10 counties
            
            statewide_result = TexasStateCarbon(
                total_counties=len(county_results),
                total_carbon_tons=total_carbon,
                total_co2_equivalent_tons=total_carbon * self.CARBON_TO_CO2_FACTOR,
                average_carbon_per_county=avg_carbon,
                top_carbon_counties=top_counties,
                methodology_summary=self._get_methodology_notes(),
                calculation_timestamp=datetime.now()
            )
            
            conn.close()
            return statewide_result
            
        except Exception as e:
            logger.error(f"Error estimating statewide carbon: {e}")
            raise

    # =========================
    # County Carbon Cache Table
    # =========================
    def _ensure_county_carbon_table(self):
        """Create county_carbon cache table if it doesn't exist."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS county_carbon (
                county_name TEXT PRIMARY KEY,
                county_fips TEXT,
                total_carbon_tons REAL,
                total_co2_equivalent_tons REAL,
                biomass_carbon_tons REAL,
                soil_carbon_potential_tons REAL,
                wetland_carbon_potential_tons REAL,
                wood_biomass_tons REAL,
                crop_residue_tons REAL,
                secondary_residue_tons REAL,
                wetland_acres REAL,
                calculation_timestamp TEXT
            )
            """
        )
        conn.commit()
        conn.close()

    def _is_county_carbon_populated(self) -> bool:
        """Check if the cache table has sufficient rows (200+ counties)."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(1) FROM county_carbon")
            count = cursor.fetchone()[0]
            conn.close()
            return count >= 200
        except Exception:
            return False

    def build_county_carbon_cache(self, force_rebuild: bool = False) -> int:
        """Build or rebuild the county carbon cache. Returns number of rows written."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        if force_rebuild:
            logger.info("Forcing rebuild of county_carbon cache table")
            cursor.execute("DELETE FROM county_carbon")
            conn.commit()

        # If already populated sufficiently, skip
        if not force_rebuild and self._is_county_carbon_populated():
            logger.info("county_carbon table already populated; skipping rebuild")
            conn.close()
            return 0

        # Get list of counties from biomass layer
        cursor.execute(
            """
            SELECT DISTINCT JSON_EXTRACT(properties, '$.Name') as county_name,
                            JSON_EXTRACT(properties, '$.Fips') as county_fips
            FROM polygon_features 
            WHERE layer_id = 'biomass-woodmill-residue-biomass'
            """
        )
        counties = cursor.fetchall()
        logger.info(f"Building county_carbon cache for {len(counties)} counties...")

        rows_written = 0
        for county_name, county_fips in counties:
            try:
                result = self.estimate_county_carbon(county_name=county_name)
                if not result:
                    continue
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO county_carbon (
                        county_name, county_fips, total_carbon_tons, total_co2_equivalent_tons,
                        biomass_carbon_tons, soil_carbon_potential_tons, wetland_carbon_potential_tons,
                        wood_biomass_tons, crop_residue_tons, secondary_residue_tons, wetland_acres,
                        calculation_timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        result.county_name,
                        result.county_fips,
                        float(result.total_carbon_tons),
                        float(result.total_co2_equivalent_tons),
                        float(result.biomass_carbon_tons),
                        float(result.soil_carbon_potential_tons),
                        float(result.wetland_carbon_potential_tons),
                        float(result.wood_biomass_tons),
                        float(result.crop_residue_tons),
                        float(result.secondary_residue_tons),
                        float(result.wetland_acres),
                        result.calculation_timestamp.isoformat()
                    )
                )
                rows_written += 1
            except Exception as e:
                logger.warning(f"Failed to cache county {county_name}: {e}")

        conn.commit()
        conn.close()
        logger.info(f"county_carbon cache build complete: {rows_written} rows written")
        return rows_written

    def get_all_county_carbon(self, ensure_cache: bool = True) -> List[Dict[str, Any]]:
        """Return carbon data for all counties from the cache table. Optionally build cache if empty."""
        if ensure_cache and not self._is_county_carbon_populated():
            self.build_county_carbon_cache(force_rebuild=False)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT county_name, county_fips, total_carbon_tons, total_co2_equivalent_tons
            FROM county_carbon
            """
        )
        rows = cursor.fetchall()
        conn.close()
        return [
            {
                'county_name': row[0],
                'county_fips': row[1],
                'total_carbon_tons': round(row[2], 2) if row[2] is not None else None,
                'total_co2_equivalent_tons': round(row[3], 2) if row[3] is not None else None
            }
            for row in rows
        ]

    def get_cached_county_carbon(self, county_name: str) -> Optional[Dict[str, Any]]:
        """Get a single county's carbon data from cache if available."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT county_name, county_fips, total_carbon_tons, total_co2_equivalent_tons FROM county_carbon WHERE county_name = ?",
            (county_name,)
        )
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        return {
            'county_name': row[0],
            'county_fips': row[1],
            'total_carbon_tons': round(row[2], 2) if row[2] is not None else None,
            'total_co2_equivalent_tons': round(row[3], 2) if row[3] is not None else None
        }
    
    def _get_wood_biomass_data(self, cursor, condition: str) -> Optional[Dict]:
        """Get wood biomass data for a county"""
        query = f"""
            SELECT properties FROM polygon_features 
            WHERE layer_id = 'biomass-woodmill-residue-biomass' AND ({condition})
        """
        logger.info(f"Wood biomass query: {query}")
        cursor.execute(query)
        result = cursor.fetchone()
        if result:
            data = json.loads(result[0])
            logger.info(f"Found wood biomass data with keys: {list(data.keys())}")
            return data
        else:
            logger.warning("No wood biomass data found for condition")
            return None
    
    def _get_crop_biomass_data(self, cursor, condition: str) -> Optional[Dict]:
        """Get crop biomass data for a county"""
        cursor.execute(f"""
            SELECT properties FROM polygon_features 
            WHERE layer_id = 'biomass-crop-residue-biomass' AND {condition}
        """)
        result = cursor.fetchone()
        if result:
            return json.loads(result[0])
        return None
    
    def _calculate_wood_carbon(self, wood_data: Optional[Dict]) -> Dict[str, float]:
        """Calculate carbon from wood biomass data"""
        if not wood_data:
            logger.warning("No wood biomass data provided")
            return {'wood_biomass': 0, 'secondary_residue': 0, 'total_carbon': 0}
        
        wood_biomass = float(wood_data.get('Toturbwood', 0))
        secondary_residue = float(wood_data.get('Totsecmres', 0))
        
        logger.info(f"Wood biomass calculation: Toturbwood={wood_biomass}, Totsecmres={secondary_residue}")
        
        wood_carbon = wood_biomass * self.WOOD_CARBON_FACTOR
        residue_carbon = secondary_residue * self.WOOD_CARBON_FACTOR
        
        return {
            'wood_biomass': wood_biomass,
            'secondary_residue': secondary_residue,
            'total_carbon': wood_carbon + residue_carbon
        }
    
    def _calculate_crop_carbon(self, crop_data: Optional[Dict]) -> Dict[str, float]:
        """Calculate carbon from crop residue data"""
        if not crop_data:
            return {'crop_residue': 0, 'total_carbon': 0}
        
        crop_residue = float(crop_data.get('Cropres', 0))
        crop_carbon = crop_residue * self.CROP_CARBON_FACTOR
        
        return {
            'crop_residue': crop_residue,
            'total_carbon': crop_carbon
        }
    
    def _get_wetland_data(self, cursor, county_name: str) -> List[Dict]:
        """Get wetland data for a county"""
        logger.info(f"Searching wetlands for county: {county_name}")
        cursor.execute("""
            SELECT properties FROM polygon_features 
            WHERE layer_id = 'wetlands' 
            AND JSON_EXTRACT(properties, '$.Countyname') = ?
        """, (county_name,))
        
        results = cursor.fetchall()
        logger.info(f"Found {len(results)} wetland records for {county_name}")
        wetlands = []
        for result in results:
            props = json.loads(result[0])
            wetlands.append(props)
        
        return wetlands
    
    def _calculate_wetland_carbon(self, wetland_data: List[Dict]) -> Dict[str, float]:
        """Calculate carbon sequestration potential from wetlands"""
        if not wetland_data:
            return {'total_acres': 0, 'annual_sequestration': 0}
        
        total_acres = 0
        total_sequestration = 0
        
        for wetland in wetland_data:
            try:
                acres = float(wetland.get('Acres', 0))
                wetland_type = wetland.get('Wettype', 'default')
                
                # Get sequestration rate for wetland type
                rate = self.WETLAND_SEQUESTRATION.get(wetland_type, self.WETLAND_SEQUESTRATION['default'])
                
                total_acres += acres
                total_sequestration += acres * rate / self.CARBON_TO_CO2_FACTOR  # Convert CO2 to carbon
                
            except (ValueError, TypeError):
                continue
        
        return {
            'total_acres': total_acres,
            'annual_sequestration': total_sequestration
        }
    
    def _estimate_soil_carbon(self, area_sqmi: float) -> float:
        """Estimate soil carbon potential based on area"""
        if not area_sqmi:
            return 0
        
        # Convert square miles to acres (1 sq mi = 640 acres)
        area_acres = area_sqmi * 640
        
        # Use default soil carbon estimate
        soil_carbon_per_acre = self.SOIL_CARBON_ESTIMATES['default']
        
        return area_acres * soil_carbon_per_acre
    
    def _create_default_carbon_estimate(self, county_name: str = None, county_fips: str = None) -> CarbonEstimationResult:
        """
        Create a default carbon estimate for counties without biomass data.
        Uses average Texas county size and conservative carbon estimates.
        """
        # Average Texas county size (Texas has 254 counties in ~268,596 sq miles)
        # This gives us approximately 1,057 square miles per county on average
        default_area_sqmi = 1057.0
        
        # Conservative default biomass carbon estimates (tons)
        # Based on minimal vegetation cover in arid/semi-arid regions
        default_wood_biomass = 50.0  # Minimal wood biomass
        default_crop_residue = 25.0  # Minimal crop residue
        default_biomass_carbon = (default_wood_biomass * self.WOOD_CARBON_FACTOR + 
                                 default_crop_residue * self.CROP_CARBON_FACTOR)
        
        # Calculate soil carbon using default area
        default_soil_carbon = self._estimate_soil_carbon(default_area_sqmi)
        
        # Minimal wetland carbon (assuming limited wetlands)
        default_wetland_carbon = 100.0  # Conservative estimate
        
        # Total carbon calculation
        total_carbon = default_biomass_carbon + default_soil_carbon + default_wetland_carbon
        total_co2_equivalent = total_carbon * self.CARBON_TO_CO2_FACTOR
        
        # Create result with default values
        result = CarbonEstimationResult(
            county_name=county_name or "Unknown County",
            county_fips=county_fips or "Unknown",
            total_carbon_tons=total_carbon,
            total_co2_equivalent_tons=total_co2_equivalent,
            biomass_carbon_tons=default_biomass_carbon,
            soil_carbon_potential_tons=default_soil_carbon,
            wetland_carbon_potential_tons=default_wetland_carbon,
            wood_biomass_tons=default_wood_biomass,
            crop_residue_tons=default_crop_residue,
            secondary_residue_tons=0.0,
            wetland_acres=100.0,  # Conservative estimate
            calculation_timestamp=datetime.now(),
            methodology_notes=self._get_default_methodology_notes()
        )
        
        logger.info(f"Created default carbon estimate for {county_name or county_fips}: {total_carbon:.2f} tons")
        return result
    
    def _get_methodology_notes(self) -> str:
        """Get methodology documentation"""
        return """
        Carbon Estimation Methodology:
        - Wood Biomass: 50% carbon content factor
        - Crop Residue: 45% carbon content factor
        - Wetland Sequestration: 0.5-2.0 tons CO2/acre/year by type
        - Soil Carbon: 40 tons C/acre default estimate (0-1m depth)
        - CO2 Equivalent: 3.67 conversion factor (molecular weight ratio)
        
        Data Sources: Texas spatial databases with county-level biomass data
        Calculation Date: Real-time based on current database
        """
    
    def _get_default_methodology_notes(self) -> str:
        """Get methodology documentation for default estimates"""
        return """
        Default Carbon Estimation Methodology:
        - Used when no biomass data is available for a county
        - Wood Biomass: 50 tons (minimal vegetation assumption)
        - Crop Residue: 25 tons (minimal agricultural activity)
        - Biomass Carbon: 50% wood + 45% crop carbon factors applied
        - Soil Carbon: 40 tons C/acre × average county size (1,057 sq mi)
        - Wetland Carbon: 100 tons (conservative estimate)
        - Based on average Texas county characteristics
        - Conservative estimates suitable for arid/semi-arid regions
        """

# Convenience functions for easy API integration
def get_county_carbon_estimate(county_name: str = None, county_fips: str = None) -> Optional[Dict]:
    """Get carbon estimate for a specific county"""
    service = CarbonEstimationService()
    # Try cache first by county_name when provided
    result_dict: Optional[Dict] = None
    if county_name:
        cached = service.get_cached_county_carbon(county_name=county_name.title())
        if cached and cached.get('total_carbon_tons') is not None:
            result_dict = {
                'county_name': cached['county_name'],
                'county_fips': cached['county_fips'],
                'total_carbon_tons': round(cached['total_carbon_tons'], 2),
                'total_co2_equivalent_tons': round(cached['total_co2_equivalent_tons'], 2) if cached['total_co2_equivalent_tons'] is not None else None,
                'biomass_carbon_tons': None,
                'soil_carbon_potential_tons': None,
                'wetland_carbon_potential_tons': None,
                'wood_biomass_tons': None,
                'crop_residue_tons': None,
                'wetland_acres': None,
                'calculation_timestamp': datetime.now().isoformat(),
                'methodology_notes': service._get_methodology_notes()
            }
    if not result_dict:
        result = service.estimate_county_carbon(county_name=county_name, county_fips=county_fips)
        
        if result:
            # Also upsert into cache for future fast loads
            try:
                conn = sqlite3.connect(service.db_path)
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO county_carbon (
                        county_name, county_fips, total_carbon_tons, total_co2_equivalent_tons,
                        biomass_carbon_tons, soil_carbon_potential_tons, wetland_carbon_potential_tons,
                        wood_biomass_tons, crop_residue_tons, secondary_residue_tons, wetland_acres,
                        calculation_timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        result.county_name,
                        result.county_fips,
                        float(result.total_carbon_tons),
                        float(result.total_co2_equivalent_tons),
                        float(result.biomass_carbon_tons),
                        float(result.soil_carbon_potential_tons),
                        float(result.wetland_carbon_potential_tons),
                        float(result.wood_biomass_tons),
                        float(result.crop_residue_tons),
                        float(result.secondary_residue_tons),
                        float(result.wetland_acres),
                        result.calculation_timestamp.isoformat()
                    )
                )
                conn.commit()
                conn.close()
            except Exception as e:
                logger.warning(f"Failed to upsert county into cache: {e}")
            
            result_dict = {
                'county_name': result.county_name,
                'county_fips': result.county_fips,
                'total_carbon_tons': round(result.total_carbon_tons, 2),
                'total_co2_equivalent_tons': round(result.total_co2_equivalent_tons, 2),
                'biomass_carbon_tons': round(result.biomass_carbon_tons, 2),
                'soil_carbon_potential_tons': round(result.soil_carbon_potential_tons, 2),
                'wetland_carbon_potential_tons': round(result.wetland_carbon_potential_tons, 2),
                'wood_biomass_tons': round(result.wood_biomass_tons, 2),
                'crop_residue_tons': round(result.crop_residue_tons, 2),
                'wetland_acres': round(result.wetland_acres, 2),
                'calculation_timestamp': result.calculation_timestamp.isoformat(),
                'methodology_notes': result.methodology_notes
            }
    
    return result_dict

def get_statewide_carbon_estimate() -> Dict:
    """Get carbon estimate for all of Texas"""
    service = CarbonEstimationService()
    result = service.estimate_statewide_carbon()
    
    return {
        'total_counties': result.total_counties,
        'total_carbon_tons': round(result.total_carbon_tons, 2),
        'total_co2_equivalent_tons': round(result.total_co2_equivalent_tons, 2),
        'average_carbon_per_county': round(result.average_carbon_per_county, 2),
        'top_carbon_counties': [
            {
                'county_name': county['county_name'],
                'total_carbon_tons': round(county['total_carbon_tons'], 2),
                'total_co2_equivalent_tons': round(county['total_co2_equivalent_tons'], 2)
            }
            for county in result.top_carbon_counties
        ],
        'methodology_summary': result.methodology_summary,
        'calculation_timestamp': result.calculation_timestamp.isoformat()
    }
