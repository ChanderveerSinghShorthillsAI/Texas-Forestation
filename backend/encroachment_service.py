import httpx
import json
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import logging

# Setup logging
logger = logging.getLogger(__name__)

class EncroachmentService:
    """Service for fetching encroachment data directly from Global Forest Watch API"""
    
    def __init__(self):
        self.api_url = "https://data-api.globalforestwatch.org/dataset/umd_glad_dist_alerts/latest/query/json"
        self.api_key = "782a188f-e7b1-4b3f-bc10-afad443b66e4"
        self.headers = {
            "origin": "http://localhost",
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
            "User-Agent": "Texas-Vanrakshak/1.0"
        }
        
        # Texas bounding box coordinates (using a more manageable area)
        self.texas_bounds = {
            "type": "Polygon",
            "coordinates": [[
                [-106.65, 31.51],  # Southwest corner
                [-93.50, 31.51],   # Southeast corner
                [-93.50, 36.50],   # Northeast corner
                [-106.65, 36.50],  # Northwest corner
                [-106.65, 31.51]   # Close the polygon
            ]]
        }
        
        # Use the full Texas boundary that matches the successful Postman test
        self.texas_regions = [
            # Full Texas region (matches successful Postman test)
            {
                "name": "Full Texas",
                "bounds": {
                    "type": "Polygon",
                    "coordinates": [[
                        [-106.65, 25.84],  # Southwest corner
                        [-93.51, 25.84],   # Southeast corner  
                        [-93.51, 36.50],   # Northeast corner
                        [-106.65, 36.50],  # Northwest corner
                        [-106.65, 25.84]   # Close the polygon
                    ]]
                }
            }
        ]
    
    async def health_check(self) -> Dict[str, Any]:
        """Check service health and API connectivity"""
        try:
            # Test API connectivity
            api_accessible = await self._test_api_connectivity()
            
            # Determine status based on API connectivity
            if api_accessible:
                status = "healthy"
            else:
                status = "degraded"
            
            return {
                "status": status,
                "api_accessible": api_accessible,
                "last_successful_fetch": None,
                "total_cached_alerts": 0,
                "cache_age_hours": None
            }
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "api_accessible": False,
                "last_successful_fetch": None,
                "total_cached_alerts": 0,
                "cache_age_hours": None
            }
    
    async def _test_api_connectivity(self) -> bool:
        """Test if the Global Forest Watch API is accessible"""
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                # Simple test query with minimal data using a very small region in central Texas
                test_payload = {
                    "sql": "SELECT longitude, latitude FROM results LIMIT 1",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-98.0, 30.0], [-97.0, 30.0], [-97.0, 31.0], [-98.0, 31.0], [-98.0, 30.0]
                        ]]
                    }
                }
                
                logger.info("🔍 Testing API connectivity with small region...")
                
                response = await client.post(
                    self.api_url,
                    headers=self.headers,
                    json=test_payload
                )
                
                logger.info(f"📊 Health check API response: {response.status_code}")
                return response.status_code in [200, 201]
                
        except Exception as e:
            logger.warning(f"API connectivity test failed: {e}")
            return False
    
    async def get_texas_encroachment(
        self,
        start_date: str = None,
        end_date: str = None,
        confidence_level: str = "all",
        limit: int = 5000,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get latest encroachment data for Texas region directly from API"""
        start_time = datetime.now()
        
        try:
            logger.info(f"Fetching latest encroachment data from API, confidence: {confidence_level}")
            
            # Fetch latest data directly from API (no date restrictions)
            all_alerts, latest_date = await self._fetch_latest_from_api(confidence_level)
            
            # Apply pagination
            total_count = len(all_alerts)
            paginated_alerts = all_alerts[offset:offset + limit] if offset < total_count else []
            
            # Calculate confidence breakdown
            confidence_breakdown = {}
            for alert in all_alerts:
                conf = alert.get("confidence", "unknown")
                confidence_breakdown[conf] = confidence_breakdown.get(conf, 0) + 1
            
            query_duration = (datetime.now() - start_time).total_seconds() * 1000
            
            return {
                "alerts": paginated_alerts,
                "total_count": total_count,
                "latest_data_date": latest_date,
                "confidence_breakdown": confidence_breakdown,
                "last_updated": datetime.now(),
                "query_duration_ms": query_duration,
                "message": f"Showing latest available encroachment data. Data available till {latest_date}, afterwards data is not available at the moment."
            }
            
        except Exception as e:
            logger.error(f"Failed to get Texas encroachment data: {e}")
            raise
    
    async def _find_latest_date(self) -> str:
        """Find the latest available date by searching backwards from today"""
        try:
            logger.info("🔍 Finding latest available date by searching backwards from today...")
            
            from datetime import datetime, timedelta
            
            # Start from today and go backwards up to 30 days
            current_date = datetime.now().date()
            max_days_back = 30
            
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                for days_back in range(max_days_back + 1):
                    check_date = current_date - timedelta(days=days_back)
                    date_str = check_date.strftime("%Y-%m-%d")
                    
                    logger.info(f"📅 Checking for data on: {date_str} (today - {days_back} days)")
                    
                    # Query to check if data exists for this specific date (more efficient)
                    sql_query = f"SELECT umd_glad_dist_alerts__date FROM results WHERE umd_glad_dist_alerts__date = '{date_str}' LIMIT 1"
                    
                    payload = {
                        "sql": sql_query,
                        "geometry": self.texas_regions[0]["bounds"]  # Use first region for date check
                    }
                    
                    try:
                        response = await client.post(
                            self.api_url,
                            headers=self.headers,
                            json=payload
                        )
                        
                        if response.status_code in [200, 201]:
                            data = response.json()
                            if "data" in data and data["data"] and len(data["data"]) > 0:
                                # If we got any data back, this date has alerts
                                found_date = data["data"][0].get("umd_glad_dist_alerts__date")
                                if found_date == date_str:
                                    logger.info(f"✅ Found data on {date_str}! Using this date.")
                                    return date_str
                                else:
                                    logger.info(f"❌ No data found on {date_str}, trying previous day...")
                            else:
                                logger.info(f"❌ No response data for {date_str}, trying previous day...")
                        else:
                            logger.warning(f"⚠️ API error for {date_str} (status {response.status_code}), trying previous day...")
                            
                    except Exception as e:
                        logger.warning(f"⚠️ Error checking {date_str}: {e}, trying previous day...")
                        continue
                
                # If no data found in the last 30 days, use known working date as fallback
                logger.warning("⚠️ No data found in the last 30 days, using known working date as fallback")
                return "2025-09-25"  # Known working date as fallback
                
        except Exception as e:
            logger.error(f"💥 Error in dynamic date discovery: {e}")
            return "2025-09-25"  # Known working date as fallback
    
    async def _fetch_latest_from_api(
        self,
        confidence_level: str = "all"
    ) -> tuple[List[Dict[str, Any]], str]:
        """Fetch ALL encroachment data for the latest available date only"""
        try:
            logger.info("Fetching ALL encroachment data for the latest available date")
            
            # Step 1: Find the latest available date
            latest_date = await self._find_latest_date()
            logger.info(f"🎯 Using latest date: {latest_date}")
            
            all_alerts = []
            
            # Step 2: Fetch ALL data for that specific date only
            for region in self.texas_regions:
                try:
                    logger.info(f"Fetching ALL data for {region['name']} on date {latest_date}")
                    
                    # Build SQL query to get ALL data for the specific latest date only
                    sql_query = f"SELECT longitude, latitude, umd_glad_dist_alerts__date, umd_glad_dist_alerts__confidence FROM results WHERE umd_glad_dist_alerts__date = '{latest_date}'"
                    
                    # Add confidence filter if specified
                    if confidence_level != "all":
                        sql_query += f" AND umd_glad_dist_alerts__confidence = '{confidence_level}'"
                    
                    # No limit - get ALL data for this date, but use pagination to avoid timeout
                    # We'll fetch in batches of 10000 to avoid API timeouts
                    batch_size = 10000
                    offset = 0
                    
                    while True:
                        batch_query = f"{sql_query} ORDER BY longitude, latitude LIMIT {batch_size} OFFSET {offset}"
                        
                        payload = {
                            "sql": batch_query,
                            "geometry": region["bounds"]
                        }
                        
                        logger.info(f"🔍 Fetching batch {offset//batch_size + 1} for {region['name']}: LIMIT {batch_size} OFFSET {offset}")
                        
                        async with httpx.AsyncClient(timeout=90.0, follow_redirects=True) as client:
                            response = await client.post(
                                self.api_url,
                                headers=self.headers,
                                json=payload
                            )
                            
                            if response.status_code not in [200, 201]:
                                logger.warning(f"API request failed for {region['name']} batch {offset//batch_size + 1} with status {response.status_code}")
                                break
                            
                            data = response.json()
                            batch_alerts = data.get('data', [])
                            
                            if not batch_alerts:
                                logger.info(f"No more data for {region['name']}, stopping pagination")
                                break
                            
                            # Process and add alerts from this batch
                            for alert in batch_alerts:
                                formatted_alert = {
                                    "latitude": alert["latitude"],
                                    "longitude": alert["longitude"],
                                    "date": alert["umd_glad_dist_alerts__date"],
                                    "confidence": alert["umd_glad_dist_alerts__confidence"],
                                    "alert_id": f"{alert['latitude']}_{alert['longitude']}_{alert['umd_glad_dist_alerts__date']}"
                                }
                                all_alerts.append(formatted_alert)
                            
                            logger.info(f"✅ Fetched {len(batch_alerts)} alerts from {region['name']} batch {offset//batch_size + 1}")
                            
                            # If we got less than the batch size, we've reached the end
                            if len(batch_alerts) < batch_size:
                                logger.info(f"Reached end of data for {region['name']} (got {len(batch_alerts)} < {batch_size})")
                                break
                            
                            # Move to next batch
                            offset += batch_size
                            
                except Exception as e:
                    logger.warning(f"Failed to fetch data for {region['name']}: {e}")
                    continue
            
            # Sort all alerts by coordinates for consistent ordering
            all_alerts.sort(key=lambda x: (x["latitude"], x["longitude"]))
            
            logger.info(f"🎉 Successfully fetched ALL {len(all_alerts)} encroachment alerts for date: {latest_date}")
            return all_alerts, latest_date
                
        except Exception as e:
            logger.error(f"Failed to fetch latest encroachment data: {e}")
            raise
    
    async def _fetch_from_api(
        self,
        start_date: str,
        end_date: str,
        confidence_level: str = "all"
    ) -> List[Dict[str, Any]]:
        """Fetch encroachment data directly from Global Forest Watch API"""
        try:
            logger.info("Fetching encroachment data from Global Forest Watch API")
            
            all_alerts = []
            
            # Fetch data from each region separately to avoid timeouts
            for region in self.texas_regions:
                try:
                    logger.info(f"Fetching data for {region['name']}")
                    
                    # Build SQL query with date and confidence filters (clean single line)
                    sql_query = f"SELECT longitude, latitude, umd_glad_dist_alerts__date, umd_glad_dist_alerts__confidence FROM results WHERE umd_glad_dist_alerts__date >= '{start_date}' AND umd_glad_dist_alerts__date <= '{end_date}'"
                    
                    # Add confidence filter if specified
                    if confidence_level != "all":
                        sql_query += f" AND umd_glad_dist_alerts__confidence = '{confidence_level}'"
                    
                    # Add LIMIT to prevent huge responses
                    sql_query += " LIMIT 1000 OFFSET 0"
                    
                    payload = {
                        "sql": sql_query,
                        "geometry": region["bounds"]
                    }
                    
                    logger.info(f"🔍 API Request for {region['name']}: {sql_query}")
                    logger.info(f"📍 Geometry: {region['bounds']}")
                    
                    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                        response = await client.post(
                            self.api_url,
                            headers=self.headers,
                            json=payload
                        )
                        
                        if response.status_code not in [200, 201]:
                            logger.warning(f"API request failed for {region['name']} with status {response.status_code}")
                            logger.warning(f"Response text: {response.text}")
                            continue
                        
                        data = response.json()
                        logger.info(f"📊 API Response for {region['name']}: {len(data.get('data', []))} alerts")
                        
                        if "data" in data and data["data"]:
                            # Process and format the alerts
                            for alert in data["data"]:
                                formatted_alert = {
                                    "latitude": alert["latitude"],
                                    "longitude": alert["longitude"],
                                    "date": alert["umd_glad_dist_alerts__date"],
                                    "confidence": alert["umd_glad_dist_alerts__confidence"],
                                    "alert_id": f"{alert['latitude']}_{alert['longitude']}_{alert['umd_glad_dist_alerts__date']}"
                                }
                                all_alerts.append(formatted_alert)
                            
                            logger.info(f"Fetched {len(data['data'])} alerts from {region['name']}")
                        else:
                            logger.info(f"No alerts found in {region['name']}")
                            
                except Exception as e:
                    logger.warning(f"Failed to fetch data for {region['name']}: {e}")
                    continue
            
            logger.info(f"Successfully fetched {len(all_alerts)} encroachment alerts from all regions")
            return all_alerts
                
        except Exception as e:
            logger.error(f"Failed to fetch encroachment data: {e}")
            raise
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get overall statistics for encroachment data from live API"""
        try:
            # Get data for the last 30 days for statistics
            end_date = datetime.now().strftime("%Y-%m-%d")
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            
            # Fetch all alerts for statistics
            all_alerts = await self._fetch_from_api(start_date, end_date, "all")
            
            # Calculate statistics
            total_alerts = len(all_alerts)
            
            # Alerts by confidence
            alerts_by_confidence = {}
            for alert in all_alerts:
                conf = alert.get("confidence", "unknown")
                alerts_by_confidence[conf] = alerts_by_confidence.get(conf, 0) + 1
            
            # Recent alerts (last 7 days)
            recent_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
            recent_alerts_count = len([a for a in all_alerts if a["date"] >= recent_date])
            
            # High confidence count
            high_confidence_count = len([a for a in all_alerts if a["confidence"] == "high"])
            
            # Last alert date
            last_alert_date = max([a["date"] for a in all_alerts]) if all_alerts else None
            
            # Alerts by date (last 30 days)
            alerts_by_date = {}
            for alert in all_alerts:
                date = alert["date"]
                alerts_by_date[date] = alerts_by_date.get(date, 0) + 1
            
            return {
                "total_alerts": total_alerts,
                "alerts_by_confidence": alerts_by_confidence,
                "alerts_by_date": alerts_by_date,
                "recent_alerts_count": recent_alerts_count,
                "high_confidence_count": high_confidence_count,
                "last_alert_date": last_alert_date
            }
                
        except Exception as e:
            logger.error(f"Failed to get statistics: {e}")
            raise
    
    async def refresh_data(self) -> Dict[str, Any]:
        """Refresh data from API (no-op since we always fetch live data)"""
        try:
            # Since we always fetch live data, just return current timestamp
            return {
                "alerts_fetched": 0,
                "timestamp": datetime.now().isoformat(),
                "message": "Live API mode - data is always fresh"
            }
            
        except Exception as e:
            logger.error(f"Failed to refresh data: {e}")
            raise
    
    async def export_csv(
        self,
        start_date: str,
        end_date: str,
        confidence_level: str
    ) -> str:
        """Export data as CSV format from live API"""
        try:
            # Fetch data from API
            alerts = await self._fetch_from_api(start_date, end_date, confidence_level)
            
            # Create CSV content
            csv_lines = ["latitude,longitude,date,confidence,alert_id"]
            
            for alert in alerts:
                csv_lines.append(
                    f"{alert['latitude']},{alert['longitude']},"
                    f"{alert['date']},{alert['confidence']},{alert['alert_id']}"
                )
            
            return "\n".join(csv_lines)
            
        except Exception as e:
            logger.error(f"Failed to export CSV: {e}")
            raise

