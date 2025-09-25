"""
Carbon Estimation API Routes
============================

FastAPI routes for carbon stock estimation across Texas counties.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any
import logging

from carbon_estimation_service import (
    get_county_carbon_estimate, 
    get_statewide_carbon_estimate,
    CarbonEstimationService
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/carbon", tags=["Carbon Estimation"])

@router.get("/county")
async def get_county_carbon(
    county_name: Optional[str] = Query(None, description="County name (e.g., 'Harris', 'Dallas')"),
    county_fips: Optional[str] = Query(None, description="County FIPS code (e.g., '48201' for Harris)")
) -> Dict[str, Any]:
    """
    Get carbon stock estimation for a specific Texas county.
    
    Provides detailed carbon estimates including:
    - Total carbon stocks (tons)
    - CO2 equivalent (tons) 
    - Biomass carbon breakdown
    - Soil carbon potential
    - Wetland carbon sequestration
    - Data sources and methodology
    
    **Usage Examples:**
    - `/api/carbon/county?county_name=Harris`
    - `/api/carbon/county?county_fips=48201`
    """
    
    if not county_name and not county_fips:
        raise HTTPException(
            status_code=400, 
            detail="Must provide either county_name or county_fips parameter"
        )
    
    try:
        result = get_county_carbon_estimate(
            county_name=county_name,
            county_fips=county_fips
        )
        
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"No carbon data found for county: {county_name or county_fips}"
            )
        
        # Check if this is a default estimate (indicated by the methodology notes)
        is_default = "Default Carbon Estimation" in result.get('methodology_notes', '')
        message_suffix = " (using default values - no biomass data available)" if is_default else ""
        
        return {
            "success": True,
            "data": result,
            "message": f"Carbon estimation for {result['county_name']} County completed successfully{message_suffix}"
        }
        
    except Exception as e:
        logger.error(f"Error getting county carbon estimate: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while calculating carbon estimate"
        )

@router.get("/statewide")
async def get_statewide_carbon() -> Dict[str, Any]:
    """
    Get carbon stock estimation for all Texas counties (statewide summary).
    
    Provides comprehensive state-level carbon assessment including:
    - Total state carbon stocks
    - County-by-county breakdown
    - Top carbon-rich counties
    - Statistical summaries
    - Methodology documentation
    
    **Note:** This is a comprehensive calculation across all 254 Texas counties
    and may take a moment to complete.
    """
    
    try:
        result = get_statewide_carbon_estimate()
        
        return {
            "success": True,
            "data": result,
            "message": f"Statewide carbon estimation completed for {result['total_counties']} counties"
        }
        
    except Exception as e:
        logger.error(f"Error getting statewide carbon estimate: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while calculating statewide carbon estimate"
        )

@router.get("/counties/top")
async def get_top_carbon_counties(
    limit: int = Query(10, ge=1, le=50, description="Number of top counties to return")
) -> Dict[str, Any]:
    """
    Get the top carbon-rich counties in Texas.
    
    Returns counties ranked by total carbon stocks, useful for:
    - Conservation priority identification
    - Carbon offset project planning
    - Environmental impact assessment
    - Land use planning
    """
    
    try:
        statewide_data = get_statewide_carbon_estimate()
        
        top_counties = statewide_data['top_carbon_counties'][:limit]
        
        return {
            "success": True,
            "data": {
                "top_counties": top_counties,
                "total_counties_analyzed": statewide_data['total_counties'],
                "state_total_carbon_tons": statewide_data['total_carbon_tons'],
                "methodology": statewide_data['methodology_summary'],
                "calculation_timestamp": statewide_data['calculation_timestamp']
            },
            "message": f"Top {len(top_counties)} carbon-rich counties retrieved successfully"
        }
        
    except Exception as e:
        logger.error(f"Error getting top carbon counties: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while retrieving top carbon counties"
        )

@router.get("/counties/all")
async def get_all_counties_carbon() -> Dict[str, Any]:
    """
    Get cached carbon data for all Texas counties.
    Ensures the cache table exists and is populated once; subsequent calls are instant.
    """
    try:
        service = CarbonEstimationService()
        data = service.get_all_county_carbon(ensure_cache=True)
        return {
            "success": True,
            "data": {
                "counties": data,
                "total": len(data)
            },
            "message": f"Retrieved carbon data for {len(data)} counties"
        }
    except Exception as e:
        logger.error(f"Error getting all counties carbon: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while retrieving all counties carbon data"
        )

@router.get("/methodology")
async def get_methodology() -> Dict[str, Any]:
    """
    Get detailed information about carbon estimation methodology.
    
    Returns comprehensive documentation including:
    - Scientific conversion factors used
    - Data sources and quality
    - Calculation methods
    - Limitations and assumptions
    - References and validation
    """
    
    methodology = {
        "overview": "Texas Carbon Stock Estimation using Multi-Source Spatial Data",
        "version": "1.0",
        "data_sources": {
            "biomass_data": {
                "wood_biomass": "County-level urban wood biomass (TOTURBWOOD)",
                "secondary_residue": "Wood mill secondary residue (TOTSECMRES)",
                "crop_residue": "Agricultural crop residue biomass (CROPRES)",
                "spatial_coverage": "All 254 Texas counties"
            },
            "supporting_data": {
                "wetlands": "64,726 wetland features with type and acreage",
                "soil_map": "4,338 soil mapping units",
                "spatial_boundaries": "County-level polygon boundaries"
            }
        },
        "conversion_factors": {
            "wood_biomass_carbon": {
                "factor": 0.50,
                "description": "Wood biomass contains ~50% carbon by dry weight",
                "reference": "IPCC Guidelines for National GHG Inventories"
            },
            "crop_residue_carbon": {
                "factor": 0.45,
                "description": "Crop residue contains ~45% carbon by dry weight", 
                "reference": "FAO Agricultural Residue Assessment"
            },
            "carbon_to_co2": {
                "factor": 3.67,
                "description": "Molecular weight conversion (44/12)",
                "reference": "Standard atmospheric chemistry"
            }
        },
        "wetland_sequestration_rates": {
            "playa_lakes": "1.2 tons CO2/acre/year",
            "marshes": "2.0 tons CO2/acre/year",
            "swamps": "1.8 tons CO2/acre/year",
            "artificial_wetlands": "0.3 tons CO2/acre/year",
            "reference": "Wetland Carbon Science and Policy"
        },
        "soil_carbon_estimates": {
            "default_rate": "40 tons C/acre (0-1m depth)",
            "methodology": "Conservative estimate based on Texas soil surveys",
            "note": "Actual soil carbon varies significantly by soil type, management, and climate"
        },
        "limitations": [
            "Biomass data represents single point-in-time estimates",
            "Soil carbon estimates are generalized across counties",
            "Wetland sequestration rates are annual averages",
            "Does not account for carbon losses from disturbance",
            "County-level aggregation may mask spatial variability"
        ],
        "validation": {
            "data_quality": "Professional spatial databases from Texas agencies",
            "method_validation": "Peer-reviewed scientific conversion factors",
            "coverage": "Complete spatial coverage of Texas (254 counties)"
        },
        "recommended_applications": [
            "Regional carbon stock assessment",
            "Conservation planning and prioritization", 
            "Environmental impact evaluation",
            "Carbon offset project screening",
            "Land use planning support"
        ]
    }
    
    return {
        "success": True,
        "data": methodology,
        "message": "Carbon estimation methodology documentation retrieved successfully"
    }

@router.get("/health")
async def carbon_service_health() -> Dict[str, Any]:
    """
    Health check for carbon estimation service.
    
    Validates:
    - Database connectivity
    - Data availability
    - Service functionality
    """
    
    try:
        service = CarbonEstimationService()
        
        # Test with a known county
        test_result = service.estimate_county_carbon(county_name="Harris")
        
        if test_result:
            return {
                "success": True,
                "status": "healthy",
                "data": {
                    "database_accessible": True,
                    "biomass_data_available": True,
                    "calculation_functional": True,
                    "test_county": "Harris",
                    "test_carbon_tons": round(test_result.total_carbon_tons, 2)
                },
                "message": "Carbon estimation service is healthy and operational"
            }
        else:
            return {
                "success": False,
                "status": "degraded", 
                "data": {
                    "database_accessible": True,
                    "biomass_data_available": False,
                    "calculation_functional": False
                },
                "message": "Carbon estimation service has limited functionality"
            }
            
    except Exception as e:
        logger.error(f"Carbon service health check failed: {e}")
        return {
            "success": False,
            "status": "unhealthy",
            "error": str(e),
            "message": "Carbon estimation service is not operational"
        }
