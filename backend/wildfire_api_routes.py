"""
Wildfire Prediction API Routes
Provides endpoints for wildfire risk assessment and forecasting across Texas
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime

from wildfire_weather_service import wildfire_weather_service

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/wildfire", tags=["wildfire"])

# Pydantic models for API requests/responses
class CoordinatesModel(BaseModel):
    lat: float = Field(..., ge=25.8, le=36.5, description="Latitude (Texas bounds: 25.8 to 36.5)")
    lon: float = Field(..., ge=-106.6, le=-93.5, description="Longitude (Texas bounds: -106.6 to -93.5)")

class WildfireRiskRequest(BaseModel):
    coordinates: CoordinatesModel
    forecast_days: int = Field(default=7, ge=1, le=16, description="Number of forecast days (1-16)")

class TexasForecastRequest(BaseModel):
    forecast_days: int = Field(default=7, ge=1, le=16, description="Number of forecast days (1-16)")

class RiskLocationModel(BaseModel):
    name: str
    lat: float
    lon: float
    max_risk: float
    avg_risk: float

class ForecastStatisticsModel(BaseModel):
    max_risk: float
    avg_risk: float
    locations_monitored: int
    high_risk_locations: int
    forecast_period_days: int
    generated_at: str

class TexasForecastResponse(BaseModel):
    success: bool
    statistics: ForecastStatisticsModel
    high_risk_locations: List[RiskLocationModel]
    metadata: Dict[str, Any]

class HourlyRiskData(BaseModel):
    time: str
    temperature_2m: Optional[float]
    relative_humidity_2m: Optional[float]
    wind_speed_10m: Optional[float]
    wind_gusts_10m: Optional[float]
    precipitation: Optional[float]
    soil_moisture_0_to_1cm: Optional[float]
    vapour_pressure_deficit: Optional[float]
    fire_risk_score: float
    risk_category: str
    risk_color: str
    fwi: Optional[float]

class PeakRiskPeriod(BaseModel):
    time: str
    risk_score: float
    category: str
    temperature: Optional[float]
    humidity: Optional[float]
    wind_speed: Optional[float]
    fwi: Optional[float]

class RiskAnalysis(BaseModel):
    coordinates: Dict[str, float]
    forecast_period_days: int
    total_hours: int
    max_risk_score: float
    avg_risk_score: float
    peak_risk_periods: List[PeakRiskPeriod]
    risk_category_distribution: Dict[str, int]
    generated_at: str

class PointRiskResponse(BaseModel):
    success: bool
    analysis: RiskAnalysis
    metadata: Dict[str, Any]

class WildfireHealthResponse(BaseModel):
    status: str
    service_name: str
    api_available: bool
    texas_grid_points: int
    last_check: str
    version: str

@router.get("/health", response_model=WildfireHealthResponse)
async def wildfire_health():
    """
    Health check endpoint for wildfire prediction service
    """
    try:
        return WildfireHealthResponse(
            status="healthy",
            service_name="Texas Wildfire Prediction Service",
            api_available=True,
            texas_grid_points=len(wildfire_weather_service.texas_grid_points),
            last_check=datetime.utcnow().isoformat(),
            version="1.0.0"
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@router.get("/texas-forecast", response_model=TexasForecastResponse)
async def get_texas_wildfire_forecast(
    forecast_days: int = Query(default=7, ge=1, le=16, description="Number of forecast days")
):
    """
    Get comprehensive wildfire risk forecast for all major Texas locations
    
    This endpoint provides:
    - State-wide wildfire risk statistics
    - List of high-risk locations
    - Metadata about the forecast
    
    The forecast covers 20 major Texas cities and provides hourly predictions
    for the specified number of days.
    """
    try:
        logger.info(f"Generating Texas wildfire forecast for {forecast_days} days")
        
        result = await wildfire_weather_service.get_texas_wildfire_forecast(forecast_days)
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        # Transform the result to match our response model
        response = TexasForecastResponse(
            success=result["success"],
            statistics=ForecastStatisticsModel(**result["statistics"]),
            high_risk_locations=[
                RiskLocationModel(**location) for location in result["high_risk_locations"]
            ],
            metadata=result["metadata"]
        )
        
        logger.info(f"Successfully generated forecast: {len(result['high_risk_locations'])} high-risk locations found")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating Texas forecast: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Forecast generation failed: {str(e)}")

@router.post("/point-risk", response_model=PointRiskResponse)
async def get_point_wildfire_risk(request: WildfireRiskRequest):
    """
    Get detailed wildfire risk analysis for a specific point in Texas
    
    This endpoint provides:
    - Hourly wildfire risk scores and categories
    - Peak risk periods identification
    - Comprehensive risk analysis using multiple methods:
      * Fire Weather Index (FWI)
      * Vapour Pressure Deficit (VPD)
      * Soil moisture levels
      * Temperature and humidity combinations
      * Wind effects
    
    The analysis includes both current conditions and forecasts for up to 16 days.
    """
    try:
        logger.info(f"Analyzing wildfire risk for point: {request.coordinates.lat}, {request.coordinates.lon}")
        
        result = await wildfire_weather_service.get_point_wildfire_risk(
            request.coordinates.lat,
            request.coordinates.lon,
            request.forecast_days
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        # Transform the result to match our response model
        response = PointRiskResponse(
            success=result["success"],
            analysis=RiskAnalysis(**result["analysis"]),
            metadata=result["metadata"]
        )
        
        logger.info(f"Successfully analyzed point risk: max risk {result['analysis']['max_risk_score']}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing point risk: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Risk analysis failed: {str(e)}")

@router.get("/point-risk")
async def get_point_wildfire_risk_query(
    lat: float = Query(..., ge=25.8, le=36.5, description="Latitude (Texas bounds)"),
    lon: float = Query(..., ge=-106.6, le=-93.5, description="Longitude (Texas bounds)"),
    forecast_days: int = Query(default=7, ge=1, le=16, description="Number of forecast days")
):
    """
    Get detailed wildfire risk analysis for a specific point (GET version)
    
    Alternative endpoint that accepts coordinates as query parameters instead of request body.
    Useful for simple GET requests from frontend applications.
    """
    try:
        request = WildfireRiskRequest(
            coordinates=CoordinatesModel(lat=lat, lon=lon),
            forecast_days=forecast_days
        )
        return await get_point_wildfire_risk(request)
    except Exception as e:
        logger.error(f"Error in GET point risk: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/detailed-forecast")
async def get_detailed_texas_forecast(
    forecast_days: int = Query(default=7, ge=1, le=16, description="Number of forecast days"),
    include_hourly: bool = Query(default=False, description="Include hourly data for all locations")
):
    """
    Get detailed wildfire forecast with optional hourly data
    
    This endpoint provides the same data as /texas-forecast but optionally includes
    complete hourly forecast data for all monitored locations. Use with caution
    as the response can be very large with include_hourly=true.
    """
    try:
        logger.info(f"Generating detailed Texas forecast (hourly={include_hourly})")
        
        result = await wildfire_weather_service.get_texas_wildfire_forecast(forecast_days)
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        if not include_hourly:
            # Remove detailed forecasts to reduce response size
            result.pop("detailed_forecasts", None)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating detailed forecast: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Detailed forecast failed: {str(e)}")

@router.get("/risk-categories")
async def get_risk_categories():
    """
    Get information about wildfire risk categories and their meanings
    
    Returns the risk category definitions used by the wildfire prediction system.
    """
    return {
        "risk_categories": {
            "Low": {
                "range": "0-19",
                "color": "#00ff00",
                "description": "Minimal fire danger. Fires are unlikely to start or spread.",
                "precautions": "Normal fire safety practices apply."
            },
            "Moderate": {
                "range": "20-39", 
                "color": "#ffff00",
                "description": "Some fire danger. Fires may start but spread slowly.",
                "precautions": "Be cautious with outdoor burning. Monitor weather conditions."
            },
            "High": {
                "range": "40-59",
                "color": "#ff8000", 
                "description": "High fire danger. Fires start easily and spread rapidly.",
                "precautions": "Avoid outdoor burning. Exercise extreme caution with ignition sources."
            },
            "Very High": {
                "range": "60-79",
                "color": "#ff0000",
                "description": "Very high fire danger. Fires start very easily and spread very rapidly.",
                "precautions": "No outdoor burning. Extreme caution required. Consider evacuation planning."
            },
            "Extreme": {
                "range": "80-100",
                "color": "#8b0000",
                "description": "Extreme fire danger. Any fire will spread rapidly and be difficult to control.",
                "precautions": "Emergency protocols. No ignition sources. Be prepared for immediate evacuation."
            }
        },
        "methodology": {
            "fire_weather_index": "Canadian Fire Weather Index System components",
            "vapour_pressure_deficit": "Atmospheric dryness measurement",
            "soil_moisture": "Surface soil moisture content",
            "weather_factors": "Temperature, humidity, wind speed and gusts",
            "precipitation_effects": "24-hour rolling precipitation totals",
            "solar_radiation": "Solar energy input affecting fire behavior"
        }
    }

@router.get("/texas-locations")
async def get_texas_monitoring_locations():
    """
    Get list of Texas locations being monitored for wildfire risk
    
    Returns the grid points across Texas where weather data is collected
    and wildfire risk is calculated.
    """
    return {
        "total_locations": len(wildfire_weather_service.texas_grid_points),
        "locations": [
            {
                "name": point["name"],
                "latitude": point["lat"],
                "longitude": point["lon"]
            }
            for point in wildfire_weather_service.texas_grid_points
        ],
        "coverage_area": {
            "state": "Texas",
            "bounds": wildfire_weather_service.texas_bounds,
            "description": "Major cities and regions across Texas for comprehensive coverage"
        }
    }
