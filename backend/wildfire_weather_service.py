"""
Wildfire Weather Service
Fetches weather data from Open-Meteo API and calculates wildfire risk predictions for Texas
"""
import asyncio
import httpx
import logging
import math
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from collections import deque

logger = logging.getLogger(__name__)

class WildfireWeatherService:
    """Service for fetching weather data and calculating wildfire risk"""
    
    def __init__(self):
        self.base_url = "https://api.open-meteo.com/v1/forecast"
        self.timeout = 30.0
        
        # Texas coordinate bounds for validation
        self.texas_bounds = {
            'lat_min': 25.8,
            'lat_max': 36.5,
            'lon_min': -106.6,
            'lon_max': -93.5
        }
        
        # Major Texas cities for grid points
        self.texas_grid_points = [
            {'name': 'Houston', 'lat': 29.7604, 'lon': -95.3698},
            {'name': 'Dallas', 'lat': 32.7767, 'lon': -96.7970},
            {'name': 'Austin', 'lat': 30.2672, 'lon': -97.7431},
            {'name': 'San Antonio', 'lat': 29.4241, 'lon': -98.4936},
            {'name': 'Fort Worth', 'lat': 32.7555, 'lon': -97.3308},
            {'name': 'El Paso', 'lat': 31.7619, 'lon': -106.4850},
            {'name': 'Corpus Christi', 'lat': 27.8006, 'lon': -97.3964},
            {'name': 'Lubbock', 'lat': 33.5779, 'lon': -101.8552},
            {'name': 'Amarillo', 'lat': 35.2220, 'lon': -101.8313},
            {'name': 'Beaumont', 'lat': 30.0860, 'lon': -94.1018},
            {'name': 'Brownsville', 'lat': 25.9018, 'lon': -97.4975},
            {'name': 'Laredo', 'lat': 27.5306, 'lon': -99.4803},
            {'name': 'Tyler', 'lat': 32.3513, 'lon': -95.3011},
            {'name': 'Waco', 'lat': 31.5494, 'lon': -97.1467},
            {'name': 'Abilene', 'lat': 32.4487, 'lon': -99.7331},
            {'name': 'Midland', 'lat': 32.0253, 'lon': -102.1040},
            {'name': 'Odessa', 'lat': 31.8457, 'lon': -102.3676},
            {'name': 'Texarkana', 'lat': 33.4251, 'lon': -94.0477},
            {'name': 'Victoria', 'lat': 28.8053, 'lon': -97.0036},
            {'name': 'Galveston', 'lat': 29.3013, 'lon': -94.7977}
        ]
    
    def _safe_num(self, value: Any) -> Optional[float]:
        """Safely convert value to float"""
        try:
            return float(value) if value is not None else None
        except (TypeError, ValueError):
            return None
    
    def _validate_coordinates(self, lat: float, lon: float) -> bool:
        """Validate if coordinates are within Texas bounds"""
        return (self.texas_bounds['lat_min'] <= lat <= self.texas_bounds['lat_max'] and
                self.texas_bounds['lon_min'] <= lon <= self.texas_bounds['lon_max'])
    
    async def fetch_weather_data(self, lat: float, lon: float, 
                                forecast_days: int = 7, past_days: int = 1) -> Optional[List[Dict]]:
        """
        Fetch weather data from Open-Meteo API for given coordinates
        
        Args:
            lat: Latitude
            lon: Longitude  
            forecast_days: Number of forecast days (default 7)
            past_days: Number of past days (default 1)
            
        Returns:
            List of hourly weather data dictionaries
        """
        try:
            if not self._validate_coordinates(lat, lon):
                logger.warning(f"Coordinates {lat}, {lon} are outside Texas bounds")
                return None
            
            # Prepare API parameters
            hourly_vars = [
                "temperature_2m",
                "relative_humidity_2m", 
                "wind_speed_10m",
                "wind_gusts_10m",
                "precipitation",
                "soil_moisture_0_to_1cm",
                "shortwave_radiation",
                "vapour_pressure_deficit"
            ]
            
            params = {
                "latitude": lat,
                "longitude": lon,
                "hourly": ",".join(hourly_vars),
                "forecast_days": forecast_days,
                "past_days": past_days,
                "timezone": "America/Chicago",  # Texas timezone
                "temperature_unit": "celsius",
                "wind_speed_unit": "kmh",
                "precipitation_unit": "mm"
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                logger.info(f"Fetching weather data for {lat}, {lon}")
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                
                data = response.json()
                hourly = data.get("hourly", {})
                times = hourly.get("time", [])
                
                if not times:
                    logger.warning("No time data received from API")
                    return None
                
                # Build timeseries data
                def safe_list(key: str) -> List[Optional[float]]:
                    lst = hourly.get(key)
                    if lst is None:
                        return [None] * len(times)
                    return [self._safe_num(v) for v in lst]
                
                timeseries = []
                for i, time_str in enumerate(times):
                    timeseries.append({
                        "time": time_str,
                        "temperature_2m": safe_list("temperature_2m")[i],
                        "relative_humidity_2m": safe_list("relative_humidity_2m")[i],
                        "wind_speed_10m": safe_list("wind_speed_10m")[i],
                        "wind_gusts_10m": safe_list("wind_gusts_10m")[i],
                        "precipitation": safe_list("precipitation")[i],
                        "soil_moisture_0_to_1cm": safe_list("soil_moisture_0_to_1cm")[i],
                        "shortwave_radiation": safe_list("shortwave_radiation")[i],
                        "vapour_pressure_deficit": safe_list("vapour_pressure_deficit")[i]
                    })
                
                logger.info(f"Successfully fetched {len(timeseries)} hours of weather data")
                return timeseries
                
        except httpx.TimeoutException:
            logger.error(f"Timeout fetching weather data for {lat}, {lon}")
            return None
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching weather data: {e.response.status_code}")
            return None
        except Exception as e:
            logger.error(f"Error fetching weather data: {str(e)}")
            return None
    
    def calculate_fire_weather_index(self, timeseries: List[Dict]) -> List[Dict]:
        """
        Calculate Fire Weather Index (FWI) components for each hour
        
        This implements a simplified version of the Canadian Fire Weather Index System
        """
        if not timeseries:
            return []
        
        scored_data = []
        
        # Initialize FWI components with default values
        ffmc_prev = 85.0  # Fine Fuel Moisture Code
        dmc_prev = 6.0    # Duff Moisture Code  
        dc_prev = 15.0    # Drought Code
        
        for i, row in enumerate(timeseries):
            temp = row.get("temperature_2m") or 0.0
            rh = row.get("relative_humidity_2m") or 50.0
            wind = row.get("wind_speed_10m") or 0.0
            precip = row.get("precipitation") or 0.0
            
            # Calculate FFMC (Fine Fuel Moisture Code)
            # Simplified calculation - represents moisture in litter/fine fuels
            if precip > 0.5:
                ffmc = ffmc_prev - (precip * 2)
            else:
                ffmc = ffmc_prev + (temp - rh/4) * 0.1
            ffmc = max(0, min(101, ffmc))
            
            # Calculate DMC (Duff Moisture Code)  
            # Represents moisture in deeper organic layers
            if precip > 1.5:
                dmc = dmc_prev - (precip * 1.5)
            else:
                dmc = dmc_prev + max(0, temp - 1.1) * (100 - rh) * 0.0001
            dmc = max(0, dmc)
            
            # Calculate DC (Drought Code)
            # Measures long-term soil dryness
            if precip > 2.8:
                dc = dc_prev - (precip * 0.83)
            else:
                dc = dc_prev + max(0, temp + 1.1) * 0.5
            dc = max(0, dc)
            
            # Calculate ISI (Initial Spread Index)
            # Combines wind and FFMC to estimate fire spread potential
            wind_effect = math.exp(0.05039 * wind)
            ffmc_effect = math.exp((ffmc - 85) * 0.05039)
            isi = 0.208 * wind_effect * ffmc_effect
            
            # Calculate BUI (Buildup Index)
            # Combines DMC and DC -> fuel availability
            if dmc <= 0.4 * dc:
                bui = (0.8 * dc * dmc) / (dmc + 0.4 * dc)
            else:
                bui = dmc - (1 - 0.8 * dc / (dmc + 0.4 * dc)) * (0.92 + (0.0114 * dmc) ** 1.7)
            bui = max(0, bui)
            
            # Calculate FWI (Fire Weather Index)
            # Final fire risk index
            if bui <= 80:
                fwi_intermediate = 0.1 * isi * (0.626 * bui ** 0.809 + 2)
            else:
                fwi_intermediate = 0.1 * isi * (1000 / (25 + 108.64 * math.exp(-0.023 * bui)))
            
            if fwi_intermediate <= 1:
                fwi = fwi_intermediate
            else:
                fwi = math.exp(2.72 * (0.434 * math.log(fwi_intermediate)) ** 0.647)
            
            # Update previous values for next iteration
            ffmc_prev = ffmc
            dmc_prev = dmc  
            dc_prev = dc
            
            # Create enhanced row with FWI components
            enhanced_row = dict(row)
            enhanced_row.update({
                "ffmc": round(ffmc, 2),
                "dmc": round(dmc, 2), 
                "dc": round(dc, 2),
                "isi": round(isi, 2),
                "bui": round(bui, 2),
                "fwi": round(fwi, 2)
            })
            
            scored_data.append(enhanced_row)
        
        return scored_data
    
    def calculate_comprehensive_fire_risk(self, timeseries: List[Dict]) -> List[Dict]:
        """
        Calculate comprehensive fire risk using multiple methods:
        1. Fire Weather Index (FWI)
        2. Vapour Pressure Deficit (VPD) 
        3. Soil Moisture
        4. Temperature/Humidity combination
        5. Wind effects
        """
        if not timeseries:
            return []
        
        # First calculate FWI components
        fwi_data = self.calculate_fire_weather_index(timeseries)
        
        # Track rolling precipitation for better risk assessment
        precip_window = deque()
        precip_24h_sum = 0.0
        
        final_scored_data = []
        
        for row in fwi_data:
            # Get weather variables
            temp = row.get("temperature_2m") or 0.0
            rh = row.get("relative_humidity_2m") or 50.0
            wind = row.get("wind_speed_10m") or 0.0
            gusts = row.get("wind_gusts_10m") or 0.0
            precip = row.get("precipitation") or 0.0
            vpd = row.get("vapour_pressure_deficit") or 0.0
            soil_moisture = row.get("soil_moisture_0_to_1cm") or 0.3
            solar_rad = row.get("shortwave_radiation") or 0.0
            fwi = row.get("fwi") or 0.0
            
            # Calculate 24-hour rolling precipitation
            precip_window.append(precip)
            precip_24h_sum += precip
            if len(precip_window) > 24:
                precip_24h_sum -= precip_window.popleft()
            
            # Method 1: FWI-based risk (0-100)
            fwi_risk = min(100, fwi * 5)  # Scale FWI to 0-100
            
            # Method 2: VPD-based risk (0-100)
            if vpd < 0.5:
                vpd_risk = 10
            elif vpd < 1.0:
                vpd_risk = 30
            elif vpd < 1.5:
                vpd_risk = 60
            elif vpd < 2.0:
                vpd_risk = 80
            else:
                vpd_risk = 95
            
            # Method 3: Soil moisture risk (0-100)
            soil_risk = max(0, min(100, (0.5 - soil_moisture) / 0.5 * 100))
            
            # Method 4: Temperature/Humidity risk (0-100)  
            temp_normalized = max(0, min(1, temp / 45.0))  # Normalize to 45°C max
            rh_factor = (100 - rh) / 100.0  # Lower humidity = higher risk
            temp_rh_risk = (temp_normalized * 0.6 + rh_factor * 0.4) * 100
            
            # Method 5: Wind risk multiplier (1.0 - 1.5) - reduced from 2.0
            wind_factor = 1.0 + min(0.5, (wind + gusts * 0.5) / 50.0)
            
            # Method 6: Solar radiation factor (0.9 - 1.1) - reduced from 0.8-1.2
            solar_factor = 0.9 + min(0.2, solar_rad / 1000.0)
            
            # Method 7: Precipitation dampening (0.1 - 1.0)
            if precip_24h_sum > 10:
                precip_factor = 0.1
            elif precip_24h_sum > 5:
                precip_factor = 0.3
            elif precip_24h_sum > 1:
                precip_factor = 0.6
            else:
                precip_factor = 1.0
            
            # Combine all risk factors with weights
            base_risk = (
                fwi_risk * 0.35 +           # FWI gets highest weight
                vpd_risk * 0.25 +           # VPD is very important for fire
                soil_risk * 0.15 +          # Soil moisture
                temp_rh_risk * 0.25         # Temperature/humidity combination
            )
            
            # Apply multipliers
            final_risk = base_risk * wind_factor * solar_factor * precip_factor
            final_risk = max(0, min(100, final_risk))
            
            # Determine risk category
            if final_risk < 20:
                risk_category = "Low"
                risk_color = "#00ff00"
            elif final_risk < 40:
                risk_category = "Moderate"  
                risk_color = "#ffff00"
            elif final_risk < 60:
                risk_category = "High"
                risk_color = "#ff8000"
            elif final_risk < 80:
                risk_category = "Very High"
                risk_color = "#ff0000"
            else:
                risk_category = "Extreme"
                risk_color = "#8b0000"
            
            # Add comprehensive risk data to row
            enhanced_row = dict(row)
            enhanced_row.update({
                "precip_24h": round(precip_24h_sum, 2),
                "fwi_risk": round(fwi_risk, 1),
                "vpd_risk": round(vpd_risk, 1),
                "soil_risk": round(soil_risk, 1),
                "temp_rh_risk": round(temp_rh_risk, 1),
                "wind_factor": round(wind_factor, 2),
                "solar_factor": round(solar_factor, 2),
                "precip_factor": round(precip_factor, 2),
                "fire_risk_score": round(final_risk, 1),
                "risk_category": risk_category,
                "risk_color": risk_color
            })
            
            final_scored_data.append(enhanced_row)
        
        return final_scored_data
    
    async def get_texas_wildfire_forecast(self, forecast_days: int = 7) -> Dict[str, Any]:
        """
        Get wildfire risk forecast for multiple locations across Texas
        
        Args:
            forecast_days: Number of days to forecast
            
        Returns:
            Dictionary containing forecast data for all Texas locations
        """
        try:
            logger.info(f"Generating Texas wildfire forecast for {forecast_days} days")
            
            # Fetch weather data for all grid points concurrently
            tasks = []
            for point in self.texas_grid_points:
                task = self.fetch_weather_data(
                    point['lat'], 
                    point['lon'], 
                    forecast_days=forecast_days,
                    past_days=1
                )
                tasks.append((point, task))
            
            # Wait for all requests to complete
            results = []
            for point, task in tasks:
                try:
                    weather_data = await task
                    if weather_data:
                        # Calculate comprehensive fire risk
                        risk_data = self.calculate_comprehensive_fire_risk(weather_data)
                        results.append({
                            "location": point,
                            "forecast": risk_data
                        })
                    else:
                        logger.warning(f"No weather data for {point['name']}")
                except Exception as e:
                    logger.error(f"Error processing {point['name']}: {str(e)}")
                    continue
            
            if not results:
                logger.error("No successful weather data fetches")
                return {"error": "No weather data available"}
            
            # Calculate state-wide statistics
            all_risks = []
            high_risk_locations = []
            
            for result in results:
                location_risks = [h.get("fire_risk_score", 0) for h in result["forecast"]]
                if location_risks:
                    max_risk = max(location_risks)
                    avg_risk = sum(location_risks) / len(location_risks)
                    
                    all_risks.extend(location_risks)
                    
                    if max_risk > 60:  # High risk threshold
                        high_risk_locations.append({
                            "name": result["location"]["name"],
                            "lat": result["location"]["lat"],
                            "lon": result["location"]["lon"],
                            "max_risk": round(max_risk, 1),
                            "avg_risk": round(avg_risk, 1)
                        })
            
            # Calculate overall statistics
            overall_stats = {
                "max_risk": round(max(all_risks) if all_risks else 0, 1),
                "avg_risk": round(sum(all_risks) / len(all_risks) if all_risks else 0, 1),
                "locations_monitored": len(results),
                "high_risk_locations": len(high_risk_locations),
                "forecast_period_days": forecast_days,
                "generated_at": datetime.utcnow().isoformat()
            }
            
            return {
                "success": True,
                "statistics": overall_stats,
                "high_risk_locations": high_risk_locations,
                "detailed_forecasts": results,
                "metadata": {
                    "data_source": "Open-Meteo API",
                    "risk_calculation": "Comprehensive (FWI + VPD + Soil + Weather)",
                    "update_frequency": "Hourly",
                    "timezone": "America/Chicago"
                }
            }
            
        except Exception as e:
            logger.error(f"Error generating Texas wildfire forecast: {str(e)}")
            return {"error": f"Forecast generation failed: {str(e)}"}
    
    async def get_point_wildfire_risk(self, lat: float, lon: float, 
                                    forecast_days: int = 7) -> Dict[str, Any]:
        """
        Get detailed wildfire risk for a specific point in Texas
        
        Args:
            lat: Latitude
            lon: Longitude
            forecast_days: Number of days to forecast
            
        Returns:
            Dictionary containing detailed risk analysis for the point
        """
        try:
            if not self._validate_coordinates(lat, lon):
                return {"error": "Coordinates are outside Texas bounds"}
            
            # Fetch weather data
            weather_data = await self.fetch_weather_data(lat, lon, forecast_days)
            if not weather_data:
                return {"error": "Unable to fetch weather data"}
            
            # Calculate comprehensive fire risk
            risk_data = self.calculate_comprehensive_fire_risk(weather_data)
            
            # Analyze the data (limit to next 24 hours for realistic max values)
            risks = [h.get("fire_risk_score", 0) for h in risk_data]
            next_24h_risks = risks[:24] if len(risks) >= 24 else risks
            categories = [h.get("risk_category", "Unknown") for h in risk_data]
            
            # Find peak risk periods
            peak_hours = sorted(risk_data, key=lambda x: x.get("fire_risk_score", 0), reverse=True)[:24]
            
            # Category distribution
            category_counts = {}
            for cat in categories:
                category_counts[cat] = category_counts.get(cat, 0) + 1
            
            analysis = {
                "coordinates": {"lat": lat, "lon": lon},
                "forecast_period_days": forecast_days,
                "total_hours": len(risk_data),
                "max_risk_score": round(max(next_24h_risks) if next_24h_risks else 0, 1),
                "avg_risk_score": round(sum(next_24h_risks) / len(next_24h_risks) if next_24h_risks else 0, 1),
                "peak_risk_periods": [
                    {
                        "time": hour["time"],
                        "risk_score": hour.get("fire_risk_score", 0),
                        "category": hour.get("risk_category", "Unknown"),
                        "temperature": hour.get("temperature_2m"),
                        "humidity": hour.get("relative_humidity_2m"),
                        "wind_speed": hour.get("wind_speed_10m"),
                        "fwi": hour.get("fwi")
                    }
                    for hour in peak_hours
                ],
                "risk_category_distribution": category_counts,
                "generated_at": datetime.utcnow().isoformat()
            }
            
            return {
                "success": True,
                "analysis": analysis,
                "hourly_data": risk_data,
                "metadata": {
                    "data_source": "Open-Meteo API",
                    "risk_calculation": "Comprehensive (FWI + VPD + Soil + Weather)",
                    "timezone": "America/Chicago"
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting point wildfire risk: {str(e)}")
            return {"error": f"Risk analysis failed: {str(e)}"}

# Global service instance
wildfire_weather_service = WildfireWeatherService()
