"""
Grid Fire Risk Scheduler
Automated scheduler for updating Texas-wide fire risk data
"""
import asyncio
import schedule
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
import threading
import signal
import sys
from pathlib import Path

from batch_weather_service import batch_weather_service
from texas_grid_service import texas_grid_service

logger = logging.getLogger(__name__)

class GridFireScheduler:
    """Scheduler for automated fire risk grid updates"""
    
    def __init__(self):
        self.is_running = False
        self.scheduler_thread = None
        self.current_task = None
        self.last_update_time = None
        self.update_history = []
        self.max_history_entries = 100
        
        # Schedule configuration
        self.quick_update_interval = 6  # hours
        self.full_update_interval = 24  # hours
        self.strategic_density = 0.15   # 15% of grid cells for quick updates
        self.full_density = 0.4        # 40% of grid cells for comprehensive updates
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        logger.info(f"Received signal {signum}, shutting down scheduler...")
        self.stop()
        sys.exit(0)
    
    def setup_schedules(self):
        """Setup all scheduled tasks"""
        try:
            # Quick updates every 6 hours using strategic points
            schedule.every(self.quick_update_interval).hours.do(
                self._run_async_task, 
                self._quick_update_task
            ).tag('quick_update')
            
            # Full updates every 24 hours using more comprehensive coverage
            schedule.every(self.full_update_interval).hours.do(
                self._run_async_task,
                self._full_update_task
            ).tag('full_update')
            
            # Health check every hour
            schedule.every().hour.do(
                self._run_async_task,
                self._health_check_task
            ).tag('health_check')
            
            # Cleanup old data every 7 days
            schedule.every(7).days.do(
                self._run_async_task,
                self._cleanup_task
            ).tag('cleanup')
            
            # Initial update on startup (delayed by 2 minutes)
            schedule.every(2).minutes.do(
                self._run_async_task,
                self._startup_update_task
            ).tag('startup').run_only_once = True
            
            logger.info("All scheduled tasks configured successfully")
            
        except Exception as e:
            logger.error(f"Error setting up schedules: {str(e)}")
            raise
    
    def _run_async_task(self, async_task):
        """Run an async task in the scheduler thread"""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            self.current_task = async_task.__name__
            result = loop.run_until_complete(async_task())
            
            # Record task completion
            self._record_task_completion(async_task.__name__, result)
            
            loop.close()
            self.current_task = None
            
        except Exception as e:
            logger.error(f"Error running async task {async_task.__name__}: {str(e)}")
            self._record_task_completion(async_task.__name__, {"error": str(e)})
            self.current_task = None
    
    def _record_task_completion(self, task_name: str, result: Dict[str, Any]):
        """Record task completion in history"""
        record = {
            "task_name": task_name,
            "timestamp": datetime.utcnow().isoformat(),
            "result": result,
            "success": "error" not in result
        }
        
        self.update_history.append(record)
        
        # Keep only recent history
        if len(self.update_history) > self.max_history_entries:
            self.update_history = self.update_history[-self.max_history_entries:]
        
        if record["success"]:
            logger.info(f"Task {task_name} completed successfully")
        else:
            logger.error(f"Task {task_name} failed: {result.get('error', 'Unknown error')}")
    
    async def _startup_update_task(self) -> Dict[str, Any]:
        """Initial update task on startup"""
        try:
            logger.info("Running startup fire risk update...")
            
            result = await batch_weather_service.update_texas_fire_grid(
                use_strategic_points=True,
                density_factor=self.strategic_density
            )
            
            if "error" not in result:
                self.last_update_time = datetime.utcnow()
                logger.info("Startup update completed successfully")
            
            return result
            
        except Exception as e:
            logger.error(f"Startup update failed: {str(e)}")
            return {"error": str(e)}
    
    async def _quick_update_task(self) -> Dict[str, Any]:
        """Quick update task using strategic points"""
        try:
            logger.info("Running quick fire risk update...")
            
            result = await batch_weather_service.update_texas_fire_grid(
                use_strategic_points=True,
                density_factor=self.strategic_density
            )
            
            if "error" not in result:
                self.last_update_time = datetime.utcnow()
                logger.info(f"Quick update completed: {result.get('successful_computations', 0)} cells processed")
            
            return result
            
        except Exception as e:
            logger.error(f"Quick update failed: {str(e)}")
            return {"error": str(e)}
    
    async def _full_update_task(self) -> Dict[str, Any]:
        """Full update task using comprehensive coverage"""
        try:
            logger.info("Running full fire risk update...")
            
            result = await batch_weather_service.update_texas_fire_grid(
                use_strategic_points=True,
                density_factor=self.full_density
            )
            
            if "error" not in result:
                self.last_update_time = datetime.utcnow()
                logger.info(f"Full update completed: {result.get('successful_computations', 0)} cells processed")
            
            return result
            
        except Exception as e:
            logger.error(f"Full update failed: {str(e)}")
            return {"error": str(e)}
    
    async def _health_check_task(self) -> Dict[str, Any]:
        """Health check task"""
        try:
            stats = texas_grid_service.get_grid_statistics()
            
            # Check if data is stale
            data_age_hours = None
            if stats.get("last_update"):
                last_update = datetime.fromisoformat(stats["last_update"])
                data_age_hours = (datetime.utcnow() - last_update).total_seconds() / 3600
            
            health_status = {
                "timestamp": datetime.utcnow().isoformat(),
                "cached_predictions": stats.get("cached_predictions", 0),
                "coverage_percentage": stats.get("coverage_percentage", 0),
                "data_age_hours": round(data_age_hours, 2) if data_age_hours else None,
                "is_healthy": True
            }
            
            # Determine if system is healthy
            if data_age_hours and data_age_hours > 12:
                health_status["is_healthy"] = False
                health_status["warning"] = "Data is stale (> 12 hours old)"
                logger.warning("Fire risk data is stale")
            
            if stats.get("cached_predictions", 0) < 100:
                health_status["is_healthy"] = False
                health_status["warning"] = "Insufficient cached predictions"
                logger.warning("Insufficient fire risk predictions cached")
            
            return health_status
            
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            return {"error": str(e), "is_healthy": False}
    
    async def _cleanup_task(self) -> Dict[str, Any]:
        """Cleanup old data and logs"""
        try:
            logger.info("Running cleanup task...")
            
            # Clean up old update history
            cutoff_time = datetime.utcnow() - timedelta(days=30)
            original_count = len(self.update_history)
            
            self.update_history = [
                record for record in self.update_history
                if datetime.fromisoformat(record["timestamp"]) > cutoff_time
            ]
            
            cleaned_count = original_count - len(self.update_history)
            
            # Could add database cleanup here if needed
            
            result = {
                "cleaned_history_records": cleaned_count,
                "remaining_history_records": len(self.update_history),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            logger.info(f"Cleanup completed: removed {cleaned_count} old history records")
            return result
            
        except Exception as e:
            logger.error(f"Cleanup task failed: {str(e)}")
            return {"error": str(e)}
    
    def start(self):
        """Start the scheduler"""
        if self.is_running:
            logger.warning("Scheduler is already running")
            return
        
        try:
            self.setup_schedules()
            self.is_running = True
            
            # Start scheduler in a separate thread
            self.scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
            self.scheduler_thread.start()
            
            logger.info("Grid fire risk scheduler started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start scheduler: {str(e)}")
            self.is_running = False
            raise
    
    def _run_scheduler(self):
        """Main scheduler loop"""
        logger.info("Scheduler thread started")
        
        while self.is_running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error(f"Error in scheduler loop: {str(e)}")
                time.sleep(60)  # Continue after error
        
        logger.info("Scheduler thread stopped")
    
    def stop(self):
        """Stop the scheduler"""
        if not self.is_running:
            return
        
        logger.info("Stopping scheduler...")
        self.is_running = False
        
        # Clear all scheduled jobs
        schedule.clear()
        
        # Wait for scheduler thread to finish
        if self.scheduler_thread and self.scheduler_thread.is_alive():
            self.scheduler_thread.join(timeout=5)
        
        logger.info("Scheduler stopped")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current scheduler status"""
        next_runs = {}
        for job in schedule.jobs:
            tag = list(job.tags)[0] if job.tags else "unknown"
            next_runs[tag] = job.next_run.isoformat() if job.next_run else None
        
        return {
            "is_running": self.is_running,
            "current_task": self.current_task,
            "last_update_time": self.last_update_time.isoformat() if self.last_update_time else None,
            "next_scheduled_runs": next_runs,
            "total_jobs": len(schedule.jobs),
            "update_history_count": len(self.update_history),
            "configuration": {
                "quick_update_interval_hours": self.quick_update_interval,
                "full_update_interval_hours": self.full_update_interval,
                "strategic_density": self.strategic_density,
                "full_density": self.full_density
            }
        }
    
    def get_update_history(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent update history"""
        return self.update_history[-limit:] if self.update_history else []
    
    def force_update(self, update_type: str = "quick") -> Dict[str, Any]:
        """Force an immediate update"""
        if not self.is_running:
            return {"error": "Scheduler is not running"}
        
        try:
            if update_type == "quick":
                task = self._quick_update_task
            elif update_type == "full":
                task = self._full_update_task
            else:
                return {"error": f"Unknown update type: {update_type}"}
            
            # Run the task in a separate thread
            thread = threading.Thread(
                target=self._run_async_task,
                args=(task,),
                daemon=True
            )
            thread.start()
            
            return {
                "success": True,
                "message": f"Forced {update_type} update started",
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {"error": f"Failed to force update: {str(e)}"}

# Global scheduler instance
grid_fire_scheduler = GridFireScheduler()

# Convenience functions for external use
def start_scheduler():
    """Start the grid fire scheduler"""
    return grid_fire_scheduler.start()

def stop_scheduler():
    """Stop the grid fire scheduler"""
    return grid_fire_scheduler.stop()

def get_scheduler_status():
    """Get scheduler status"""
    return grid_fire_scheduler.get_status()

if __name__ == "__main__":
    # Run scheduler as standalone script
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    try:
        logger.info("Starting Texas Grid Fire Risk Scheduler...")
        grid_fire_scheduler.start()
        
        # Keep the main thread alive
        while grid_fire_scheduler.is_running:
            time.sleep(10)
            
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
    except Exception as e:
        logger.error(f"Scheduler error: {str(e)}")
    finally:
        grid_fire_scheduler.stop()
        logger.info("Scheduler shutdown complete")
