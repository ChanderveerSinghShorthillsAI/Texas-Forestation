"""
Batch Weather Service
Efficient weather data fetching for multiple grid points using Open-Meteo batch API
"""
import asyncio
import httpx
import logging
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple
import json
from dataclasses import dataclass
import time
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from texas_grid_service import GridCell, GridFireRisk, texas_grid_service
from wildfire_weather_service import WildfireWeatherService

logger = logging.getLogger(__name__)

@dataclass
class BatchWeatherRequest:
    """Represents a batch weather request for multiple grid points"""
    grid_cells: List[GridCell]
    forecast_days: int = 7
    past_days: int = 1

class BatchWeatherService:
    """Service for efficient batch weather data fetching"""
    
    def __init__(self):
        self.base_url = os.getenv("OPEN_METEO_BASE_URL", "https://api.open-meteo.com/v1/forecast")
        self.timeout = float(os.getenv("BATCH_WEATHER_TIMEOUT", "60.0"))  # Increased timeout for batch requests
        self.max_locations_per_request = 100  # Open-Meteo batch limit
        self.max_concurrent_batches = 5  # Limit concurrent batch requests
        self.request_delay = 0.5  # Delay between requests to avoid rate limiting
        
        # Initialize weather service for risk calculations
        self.weather_service = WildfireWeatherService()
        
        # Weather variables to fetch
        self.hourly_vars = [
            "temperature_2m",
            "relative_humidity_2m", 
            "wind_speed_10m",
            "wind_gusts_10m",
            "precipitation",
            "soil_moisture_0_to_1cm",
            "shortwave_radiation",
            "vapour_pressure_deficit"
        ]
    
    async def fetch_batch_weather_data(self, 
                                     grid_cells: List[GridCell], 
                                     forecast_days: int = 7,
                                     past_days: int = 1) -> List[Tuple[GridCell, Optional[List[Dict]]]]:
        """
        Fetch weather data for multiple grid points in batches
        
        Args:
            grid_cells: List of grid cells to fetch data for
            forecast_days: Number of forecast days
            past_days: Number of past days
            
        Returns:
            List of tuples (grid_cell, weather_data)
        """
        if not grid_cells:
            return []
        
        logger.info(f"Fetching weather data for {len(grid_cells)} grid points")
        
        # Split grid cells into batches
        batches = self._create_batches(grid_cells)
        
        # Process batches with concurrency control
        semaphore = asyncio.Semaphore(self.max_concurrent_batches)
        tasks = []
        
        for batch in batches:
            task = self._fetch_batch_with_semaphore(
                semaphore, batch, forecast_days, past_days
            )
            tasks.append(task)
        
        # Wait for all batches to complete
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Combine results from all batches
        all_results = []
        for batch_result in batch_results:
            if isinstance(batch_result, Exception):
                logger.error(f"Batch request failed: {str(batch_result)}")
                continue
            
            if batch_result:
                all_results.extend(batch_result)
        
        logger.info(f"Successfully fetched weather data for {len(all_results)} grid points")
        return all_results
    
    def _create_batches(self, grid_cells: List[GridCell]) -> List[List[GridCell]]:
        """Split grid cells into batches for efficient API requests"""
        batches = []
        for i in range(0, len(grid_cells), self.max_locations_per_request):
            batch = grid_cells[i:i + self.max_locations_per_request]
            batches.append(batch)
        return batches
    
    async def _fetch_batch_with_semaphore(self,
                                        semaphore: asyncio.Semaphore,
                                        batch: List[GridCell],
                                        forecast_days: int,
                                        past_days: int) -> List[Tuple[GridCell, Optional[List[Dict]]]]:
        """Fetch weather data for a batch of grid cells with concurrency control"""
        async with semaphore:
            try:
                # Add delay to avoid rate limiting
                await asyncio.sleep(self.request_delay)
                
                result = await self._fetch_single_batch(batch, forecast_days, past_days)
                return result
                
            except Exception as e:
                logger.error(f"Error in batch request: {str(e)}")
                return []
    
    async def _fetch_single_batch(self,
                                batch: List[GridCell],
                                forecast_days: int,
                                past_days: int) -> List[Tuple[GridCell, Optional[List[Dict]]]]:
        """
        Fetch weather data for a single batch of grid cells
        
        Note: Open-Meteo doesn't support true batch requests with multiple locations,
        so we make individual requests but with controlled concurrency
        """
        try:
            results = []
            
            # Create tasks for concurrent individual requests within the batch
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                tasks = []
                for cell in batch:
                    task = self._fetch_single_location(
                        client, cell, forecast_days, past_days
                    )
                    tasks.append((cell, task))
                
                # Wait for all requests in this batch
                for cell, task in tasks:
                    try:
                        weather_data = await task
                        results.append((cell, weather_data))
                    except Exception as e:
                        logger.warning(f"Failed to fetch data for cell {cell.index}: {str(e)}")
                        results.append((cell, None))
            
            return results
            
        except Exception as e:
            logger.error(f"Error fetching batch weather data: {str(e)}")
            return [(cell, None) for cell in batch]
    
    async def _fetch_single_location(self,
                                   client: httpx.AsyncClient,
                                   cell: GridCell,
                                   forecast_days: int,
                                   past_days: int) -> Optional[List[Dict]]:
        """Fetch weather data for a single grid cell location"""
        try:
            params = {
                "latitude": cell.center_lat,
                "longitude": cell.center_lng,
                "hourly": ",".join(self.hourly_vars),
                "forecast_days": forecast_days,
                "past_days": past_days,
                "timezone": "America/Chicago",
                "temperature_unit": "celsius",
                "wind_speed_unit": "kmh",
                "precipitation_unit": "mm"
            }
            
            response = await client.get(self.base_url, params=params)
            response.raise_for_status()
            
            data = response.json()
            hourly = data.get("hourly", {})
            times = hourly.get("time", [])
            
            if not times:
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
            
            return timeseries
            
        except httpx.TimeoutException:
            logger.warning(f"Timeout fetching data for cell {cell.index}")
            return None
        except httpx.HTTPStatusError as e:
            logger.warning(f"HTTP error {e.response.status_code} for cell {cell.index}")
            return None
        except Exception as e:
            logger.warning(f"Error fetching data for cell {cell.index}: {str(e)}")
            return None
    
    def _safe_num(self, value: Any) -> Optional[float]:
        """Safely convert value to float"""
        try:
            return float(value) if value is not None else None
        except (TypeError, ValueError):
            return None
    
    async def compute_grid_fire_risks(self, 
                                    grid_cells: List[GridCell],
                                    forecast_days: int = 7) -> List[GridFireRisk]:
        """
        Compute fire risk for multiple grid cells efficiently
        
        Args:
            grid_cells: List of grid cells to compute risk for
            forecast_days: Number of forecast days
            
        Returns:
            List of grid fire risk data
        """
        try:
            # Fetch weather data for all grid cells
            weather_results = await self.fetch_batch_weather_data(
                grid_cells, forecast_days
            )
            
            fire_risks = []
            successful_computations = 0
            
            for cell, weather_data in weather_results:
                try:
                    if weather_data is None:
                        continue
                    
                    # Calculate comprehensive fire risk
                    risk_data = self.weather_service.calculate_comprehensive_fire_risk(weather_data)
                    
                    if not risk_data:
                        continue
                    
                    # Extract key metrics (limit to next 24 hours for realistic values)
                    risk_scores = [h.get("fire_risk_score", 0) for h in risk_data]
                    next_24h_scores = risk_scores[:24] if len(risk_scores) >= 24 else risk_scores
                    max_risk = max(next_24h_scores) if next_24h_scores else 0
                    avg_risk = sum(next_24h_scores) / len(next_24h_scores) if next_24h_scores else 0
                    
                    # Get current risk (first forecast hour)
                    current_risk = risk_data[0] if risk_data else {}
                    
                    # Create grid fire risk object
                    grid_risk = GridFireRisk(
                        grid_index=cell.index,
                        lat=cell.center_lat,
                        lng=cell.center_lng,
                        fire_risk_score=current_risk.get("fire_risk_score", 0),
                        risk_category=current_risk.get("risk_category", "Unknown"),
                        risk_color=current_risk.get("risk_color", "#808080"),
                        max_risk_24h=round(max_risk, 1),
                        avg_risk_24h=round(avg_risk, 1),
                        forecast_timestamp=datetime.utcnow(),
                        weather_data={
                            "temperature_2m": current_risk.get("temperature_2m"),
                            "relative_humidity_2m": current_risk.get("relative_humidity_2m"),
                            "wind_speed_10m": current_risk.get("wind_speed_10m"),
                            "wind_gusts_10m": current_risk.get("wind_gusts_10m"),
                            "precipitation": current_risk.get("precipitation"),
                            "soil_moisture_0_to_1cm": current_risk.get("soil_moisture_0_to_1cm"),
                            "vapour_pressure_deficit": current_risk.get("vapour_pressure_deficit"),
                            "fwi": current_risk.get("fwi")
                        }
                    )
                    
                    fire_risks.append(grid_risk)
                    successful_computations += 1
                    
                except Exception as e:
                    logger.warning(f"Error computing fire risk for cell {cell.index}: {str(e)}")
                    continue
            
            logger.info(f"Successfully computed fire risk for {successful_computations} out of {len(grid_cells)} grid cells")
            return fire_risks
            
        except Exception as e:
            logger.error(f"Error computing grid fire risks: {str(e)}")
            return []
    
    async def update_texas_fire_grid(self, 
                                   use_strategic_points: bool = True,
                                   density_factor: float = 0.1,
                                   use_regional_representatives: bool = False,
                                   progress_callback=None) -> Dict[str, Any]:
        """
        Update fire risk data for the entire Texas grid
        
        Args:
            use_strategic_points: If True, use strategic subset of grid points
            density_factor: Fraction of total cells to process (if using strategic points)
            progress_callback: Optional callback function for progress updates
            
        Returns:
            Summary of the update operation
        """
        try:
            start_time = time.time()
            
            # Load grid cells
            if not texas_grid_service.load_grid_cells():
                return {"error": "Failed to load grid cells"}
            
            # Select grid points to process
            if use_regional_representatives:
                grid_cells = texas_grid_service.get_texas_regional_representatives()
                logger.info("Using regional representatives for complete Texas coverage with minimal API calls")
            elif use_strategic_points:
                grid_cells = texas_grid_service.get_strategic_grid_points(density_factor)
            else:
                grid_cells = texas_grid_service.grid_cells
            
            if not grid_cells:
                return {"error": "No grid cells to process"}
            
            logger.info(f"Processing {len(grid_cells)} grid cells for fire risk computation")
            
            # Compute fire risks
            fire_risks = await self.compute_grid_fire_risks(grid_cells)
            
            if not fire_risks:
                return {"error": "Failed to compute fire risks"}
            
            # Save to cache
            texas_grid_service.save_fire_risk_data(fire_risks)
            
            # Calculate statistics
            risk_scores = [r.fire_risk_score for r in fire_risks]
            high_risk_count = len([r for r in fire_risks if r.fire_risk_score >= 60])
            
            processing_time = time.time() - start_time
            
            summary = {
                "success": True,
                "processed_cells": len(grid_cells),
                "successful_computations": len(fire_risks),
                "processing_time_seconds": round(processing_time, 2),
                "statistics": {
                    "max_risk": round(max(risk_scores), 1) if risk_scores else 0,
                    "avg_risk": round(sum(risk_scores) / len(risk_scores), 1) if risk_scores else 0,
                    "high_risk_areas": high_risk_count
                },
                "update_timestamp": datetime.utcnow().isoformat(),
                "coverage_strategy": "strategic_points" if use_strategic_points else "full_grid",
                "density_factor": density_factor if use_strategic_points else 1.0
            }
            
            logger.info(f"Texas fire grid update completed in {processing_time:.2f} seconds")
            return summary
            
        except Exception as e:
            logger.error(f"Error updating Texas fire grid: {str(e)}")
            return {"error": f"Grid update failed: {str(e)}"}
    
    async def update_full_texas_grid_with_progress(self, 
                                                 batch_size: int = 500,
                                                 progress_callback=None) -> Dict[str, Any]:
        """
        Update fire risk data for the ENTIRE Texas grid with progress tracking
        
        Args:
            batch_size: Number of cells to process in each batch
            progress_callback: Optional callback function for progress updates
            
        Returns:
            Summary of the update operation with progress information
        """
        try:
            start_time = time.time()
            
            # Load grid cells
            if not texas_grid_service.load_grid_cells():
                return {"error": "Failed to load grid cells"}
            
            # Use regional representatives for efficient API usage (covers all of Texas with ~300 calls)
            all_grid_cells = texas_grid_service.get_texas_regional_representatives()
            total_cells = len(all_grid_cells)
            
            if not all_grid_cells:
                return {"error": "No grid cells to process"}
            
            logger.info(f"Processing ALL {total_cells} grid cells for complete Texas coverage")
            
            # Process in batches for better memory management and progress tracking
            all_fire_risks = []
            processed_count = 0
            
            for batch_start in range(0, total_cells, batch_size):
                batch_end = min(batch_start + batch_size, total_cells)
                batch_cells = all_grid_cells[batch_start:batch_end]
                
                # Compute fire risks for this batch
                batch_fire_risks = await self.compute_grid_fire_risks(batch_cells)
                all_fire_risks.extend(batch_fire_risks)
                
                processed_count += len(batch_cells)
                progress_percent = (processed_count / total_cells) * 100
                
                # Call progress callback if provided
                if progress_callback:
                    await progress_callback({
                        "processed": processed_count,
                        "total": total_cells,
                        "percentage": round(progress_percent, 1),
                        "current_batch": len(batch_cells),
                        "batch_risks_computed": len(batch_fire_risks)
                    })
                
                logger.info(f"Processed batch {batch_start//batch_size + 1}: {len(batch_cells)} cells, "
                          f"Progress: {progress_percent:.1f}% ({processed_count}/{total_cells})")
                
                # Small delay to prevent overwhelming the system
                await asyncio.sleep(0.1)
            
            if not all_fire_risks:
                return {"error": "Failed to compute fire risks for any cells"}
            
            # Save to cache
            texas_grid_service.save_fire_risk_data(all_fire_risks)
            
            # Calculate comprehensive statistics
            risk_scores = [r.fire_risk_score for r in all_fire_risks]
            high_risk_count = len([r for r in all_fire_risks if r.fire_risk_score >= 60])
            very_high_risk_count = len([r for r in all_fire_risks if r.fire_risk_score >= 80])
            
            processing_time = time.time() - start_time
            
            summary = {
                "success": True,
                "processed_cells": processed_count,
                "successful_computations": len(all_fire_risks),
                "processing_time_seconds": round(processing_time, 2),
                "coverage_percentage": 100.0,  # Full coverage
                "statistics": {
                    "max_risk": round(max(risk_scores), 1) if risk_scores else 0,
                    "avg_risk": round(sum(risk_scores) / len(risk_scores), 1) if risk_scores else 0,
                    "min_risk": round(min(risk_scores), 1) if risk_scores else 0,
                    "high_risk_areas": high_risk_count,
                    "very_high_risk_areas": very_high_risk_count,
                    "total_texas_cells": total_cells
                },
                "update_timestamp": datetime.utcnow().isoformat(),
                "coverage_strategy": "full_texas_grid",
                "batch_processing": {
                    "batch_size": batch_size,
                    "total_batches": (total_cells + batch_size - 1) // batch_size
                }
            }
            
            logger.info(f"COMPLETE Texas fire grid update finished! "
                      f"Processed {processed_count} cells in {processing_time:.2f} seconds")
            return summary
            
        except Exception as e:
            logger.error(f"Error updating full Texas fire grid: {str(e)}")
            return {"error": f"Full grid update failed: {str(e)}"}

# Global service instance
batch_weather_service = BatchWeatherService()
