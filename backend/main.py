from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi import Request
from fastapi import Response
import asyncio
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import os
import sys
import argparse
from pathlib import Path
import logging
from contextlib import asynccontextmanager

from spatial_service import SpatialQueryService
from models import SpatialQueryRequest, SpatialQueryResponse
from plantation_plan_service import plantation_service

# Import citizen chatbot components
from citizen_chatbot.citizen_chatbot_http import router as chatbot_router
from citizen_chatbot.citizen_chatbot_websocket import handle_websocket_connection
from citizen_chatbot.citizen_chatbot_service import chat_service

# Import authentication components
from login import auth_router, user_db_service

# Import carbon estimation components  
from carbon_api_routes import router as carbon_router
from carbon_estimation_service import CarbonEstimationService

# Import fire tracking components
from fire_api_routes import router as fire_router

# Import wildfire prediction components
from wildfire_api_routes import router as wildfire_router
from grid_fire_api_routes import router as grid_fire_router
from grid_scheduler import grid_fire_scheduler

# Import encroachment tracking components
from encroachment_api_routes import router as encroachment_router

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global spatial service instance
spatial_service = None

# Pydantic models for plantation plan API
class PlantationPlanRequest(BaseModel):
    spatial_data: Dict[str, Any]
    additional_context: Optional[str] = None
    request_id: Optional[str] = None

class PlantationPlanResponse(BaseModel):
    plan_id: str
    title: str
    content: str
    pdf_url: Optional[str] = None
    preview_url: Optional[str] = None
    coordinates: Dict[str, Any]
    generated_at: str
    status: str

class PlantationPlanPreview(BaseModel):
    plan_id: str
    title: str
    content: str
    coordinates: Dict[str, Any]
    generated_at: str
    status: str
    spatial_data_summary: Dict[str, Any]
    knowledge_chunks_used: int

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Texas Spatial Query API Server')
    parser.add_argument('--rebuild-db', action='store_true', 
                       help='Force rebuild of spatial database')
    parser.add_argument('--port', type=int, default=8000,
                       help='Port to run the server on (default: 8000)')
    return parser.parse_args()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global spatial_service
    
    # Parse command line arguments
    args = parse_arguments()
    
    # Startup
    logger.info("🚀 Starting FastAPI Spatial Query Service")
    spatial_service = SpatialQueryService()
    
    # Initialize plantation service
    logger.info("🌱 Initializing Plantation Plan Service")
    try:
        await plantation_service.initialize()
        logger.info("✅ Plantation Plan Service initialized successfully")
    except Exception as e:
        logger.error(f"⚠️ Plantation Plan Service failed to initialize: {e}")
        logger.info("🔄 App will continue without plantation planning features")
    
    # Initialize citizen chatbot service
    logger.info("🤖 Initializing Citizen Chatbot Service")
    from citizen_chatbot.citizen_chatbot_models import init_database
    init_database()
    await chat_service.initialize()
    
    # Initialize authentication database and default user
    logger.info("🔐 Initializing Authentication Database")
    try:
        # Test database connection
        if user_db_service.health_check():
            logger.info("✅ User database connection successful")
            
            # Check if default user exists, create if not
            default_user = user_db_service.get_user_by_username("user1234")
            if not default_user:
                logger.info("🔧 Creating default user...")
                default_user = user_db_service.create_user("user1234", "pass123456")
                if default_user:
                    logger.info("✅ Default user created successfully")
                else:
                    logger.error("❌ Failed to create default user")
            else:
                logger.info("✅ Default user already exists in database")
        else:
            logger.error("❌ User database health check failed")
    except Exception as e:
        logger.error(f"⚠️ Authentication database initialization failed: {e}")
        logger.info("🔄 App will continue with authentication features disabled")
    
    # Force rebuild if requested
    if args.rebuild_db:
        logger.info("🔄 Forcing database rebuild...")
        spatial_service.force_rebuild = True
    
    # Load GeoJSON data into spatial database
    geojson_dir = Path("../frontend/public/Texas_Geojsons/Texas_Geojsons")
    if geojson_dir.exists():
        await spatial_service.initialize_spatial_data(geojson_dir)
        logger.info("✅ Spatial data initialization complete")
    else:
        logger.warning("⚠️ GeoJSON directory not found, spatial queries may not work")

    # Build county carbon cache once for instant frontend rendering
    try:
        logger.info("🧮 Building county carbon cache (one-time)...")
        carbon_service = CarbonEstimationService()
        written = carbon_service.build_county_carbon_cache(force_rebuild=False)
        logger.info(f"✅ County carbon cache ready ({written} new rows)")
    except Exception as e:
        logger.error(f"⚠️ Failed to prepare county carbon cache: {e}")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down services")
    await spatial_service.cleanup()
    await plantation_service.cleanup()
    await chat_service.cleanup()

# Create FastAPI app
app = FastAPI(
    title="Texas Spatial Query & Plantation Planning API",
    description="High-performance spatial queries, AI-powered plantation planning, and citizen chatbot for Texas",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chatbot_router)
app.include_router(auth_router)
app.include_router(carbon_router)
app.include_router(fire_router)
app.include_router(wildfire_router)
app.include_router(grid_fire_router)
app.include_router(encroachment_router)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Texas Spatial Query & Plantation Planning API",
        "status": "running",
        "endpoints": {
            "spatial_query": "/api/spatial-query",
            "generate_plan": "/api/generate-plantation-plan",
            "download_plan": "/api/download-plan/{plan_id}",
            "layers": "/api/layers",
            "health": "/api/health",
            "chatbot_websocket": "/ws/citizen_chatbot/",
            "chatbot_http": "/api/citizen_chatbot/chat/",
            "chatbot_stream": "/api/citizen_chatbot/chat/stream/",
            "auth_login": "/auth/login",
            "auth_status": "/auth/status",
            "auth_check": "/auth/check",
            "carbon_county": "/api/carbon/county",
            "carbon_statewide": "/api/carbon/statewide",
            "carbon_top_counties": "/api/carbon/counties/top",
            "carbon_methodology": "/api/carbon/methodology",
            "carbon_health": "/api/carbon/health",
            "fire_texas": "/api/fire/texas",
            "fire_statistics": "/api/fire/statistics",
            "fire_datasets": "/api/fire/datasets",
            "fire_health": "/api/fire/health",
            "wildfire_texas_forecast": "/api/wildfire/texas-forecast",
            "wildfire_point_risk": "/api/wildfire/point-risk",
            "wildfire_health": "/api/wildfire/health",
            "wildfire_categories": "/api/wildfire/risk-categories",
            "wildfire_locations": "/api/wildfire/texas-locations",
            "encroachment_texas": "/api/encroachment/texas",
            "encroachment_statistics": "/api/encroachment/statistics",
            "encroachment_recent": "/api/encroachment/recent",
            "encroachment_high_confidence": "/api/encroachment/high-confidence",
            "encroachment_health": "/api/encroachment/health",
            "encroachment_refresh": "/api/encroachment/refresh"
        }
    }

@app.get("/api/health")
async def health_check():
    """Detailed health check"""
    global spatial_service
    
    if not spatial_service:
        raise HTTPException(status_code=503, detail="Spatial service not initialized")
    
    # Check if spatial service connection is available
    spatial_status = "ready"
    stats = {}
    
    try:
        if spatial_service.conn is None:
            spatial_status = "not_initialized"
            stats = {
                "total_layers": 0,
                "total_features": 0,
                "polygon_features": 0,
                "point_features": 0,
                "indexed_layers": 0
            }
        else:
            stats = await spatial_service.get_stats()
    except Exception as e:
        logger.error(f"❌ Error getting spatial stats: {e}")
        spatial_status = "error"
        stats = {"error": str(e)}
    
    plantation_status = "ready" if plantation_service.is_initialized else "initializing"
    
    return {
        "status": "healthy",
        "spatial_service": spatial_status,
        "plantation_service": plantation_status,
        "database_layers": stats.get("total_layers", 0),
        "total_features": stats.get("total_features", 0),
        "indexed_layers": stats.get("indexed_layers", 0)
    }

@app.post("/api/spatial-query", response_model=SpatialQueryResponse)
async def spatial_query(request: SpatialQueryRequest):
    """
    Perform spatial query for a given point
    Returns polygons containing the point and nearest point features
    """
    global spatial_service
    
    if not spatial_service:
        raise HTTPException(status_code=503, detail="Spatial service not initialized")
    
    try:
        logger.info(f"🔍 Spatial query for point: {request.longitude}, {request.latitude}")
        
        # Perform the spatial query
        results = await spatial_service.query_point(
            longitude=request.longitude,
            latitude=request.latitude,
            max_distance_km=request.max_distance_km,
            max_nearest_points=request.max_nearest_points
        )
        
        logger.info(f"✅ Query complete: {len(results.polygon_matches)} polygons, {len(results.nearest_points)} points")
        
        return results
        
    except Exception as e:
        logger.error(f"❌ Spatial query failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Spatial query failed: {str(e)}")

@app.post("/api/generate-plantation-plan", response_model=PlantationPlanResponse)
async def generate_plantation_plan(request: PlantationPlanRequest, http_request: Request):
    """
    Generate a comprehensive 10-year plantation plan based on spatial data
    """
    try:
        logger.info("🌱 Starting plantation plan generation request")
        
        if not plantation_service.is_initialized:
            raise HTTPException(status_code=503, detail="Plantation service not initialized")
        
        # Generate the plan
        plan_data = await plantation_service.generate_plantation_plan(
            request.spatial_data,
            request_id=request.request_id,
            http_request=http_request,
        )
        
        # Store plan data for preview (PDF generation will be on-demand)
        logger.info("💾 Storing plan data for preview...")
        await plantation_service.store_plan_for_preview(plan_data)
        
        # Create response
        response = PlantationPlanResponse(
            plan_id=plan_data['id'],
            title=plan_data['title'],
            content=plan_data['content'],
            pdf_url=f"/api/download-plan/{plan_data['id']}",
            preview_url=f"/api/preview-plan/{plan_data['id']}",
            coordinates=plan_data['coordinates'],
            generated_at=plan_data['generated_at'],
            status=plan_data['status']
        )
        
        logger.info(f"✅ Plantation plan generated successfully: {plan_data['id']}")
        return response
    except asyncio.CancelledError:
        # Client cancelled or disconnected; return 499 Client Closed Request
        logger.info("🛑 Request cancelled by client; stopping plan generation")
        # Starlette/FastAPI does not have a built-in 499; use Response directly
        return Response(status_code=499)
    except Exception as e:
        logger.error(f"❌ Plantation plan generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Plan generation failed: {str(e)}")

@app.get("/api/preview-plan/{plan_id}", response_model=PlantationPlanPreview)
async def preview_plantation_plan(plan_id: str):
    """
    Get plan preview data for display before download
    """
    try:
        plan_data = await plantation_service.get_stored_plan(plan_id)
        if not plan_data:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Create spatial data summary
        spatial_data = plan_data.get('spatial_data', {})
        spatial_summary = {}
        
        # Count coverage layers
        polygons = spatial_data.get('polygonData') or spatial_data.get('polygon_matches') or []
        spatial_summary['coverage_layers'] = len(polygons)
        
        # Count nearby features
        nearest = spatial_data.get('nearestPoints') or spatial_data.get('nearest_points') or []
        spatial_summary['nearby_features'] = len(nearest)
        
        # Extract location info
        coords = spatial_data.get('clickCoordinates') or spatial_data.get('click_coordinates') or {}
        spatial_summary['location'] = coords.get('formatted', 'Unknown location')
        
        preview = PlantationPlanPreview(
            plan_id=plan_data['id'],
            title=plan_data['title'],
            content=plan_data['content'],
            coordinates=plan_data['coordinates'],
            generated_at=plan_data['generated_at'],
            status=plan_data['status'],
            spatial_data_summary=spatial_summary,
            knowledge_chunks_used=plan_data['knowledge_chunks_used']
        )
        
        return preview
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get plan preview: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")

@app.post("/api/cancel-plantation-plan/{request_id}")
async def cancel_plantation_plan(request_id: str):
    """Signal server-side cancellation for an in-flight plan generation."""
    try:
        if not request_id:
            raise HTTPException(status_code=400, detail="request_id is required")
        cancelled = await plantation_service.cancel_job(request_id)
        return {"success": cancelled, "request_id": request_id}
    except Exception as e:
        logger.error(f"❌ Failed to cancel plan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Cancel failed: {str(e)}")

@app.get("/api/download-plan/{plan_id}")
async def download_plantation_plan(plan_id: str):
    """
    Generate and download the plantation plan PDF
    """
    try:
        # Get stored plan data
        plan_data = await plantation_service.get_stored_plan(plan_id)
        if not plan_data:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Generate PDF on-demand
        logger.info("📄 Generating PDF document on-demand...")
        pdf_path = await plantation_service.generate_pdf_plan(plan_data)
        
        # Extract timestamp from plan_id for filename
        timestamp = plan_id.split('_')[-1] if '_' in plan_id else plan_id
        pdf_filename = f"texas_plantation_plan_{timestamp}.pdf"
        pdf_path = Path("generated_plans") / pdf_filename
         
        if not pdf_path.exists():
            raise HTTPException(status_code=404, detail="PDF generation failed")
         
        return FileResponse(
            path=str(pdf_path),
            filename=pdf_filename,
            media_type="application/pdf"
        )
         
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Plan file not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to download plan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

@app.get("/api/layers")
async def get_layers():
    """Get information about available spatial layers"""
    global spatial_service
    
    if not spatial_service:
        raise HTTPException(status_code=503, detail="Spatial service not initialized")
    
    try:
        layers_info = await spatial_service.get_layers_info()
        return {
            "total_layers": len(layers_info),
            "layers": layers_info
        }
    except Exception as e:
        logger.error(f"❌ Failed to get layers info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get layers info: {str(e)}")

@app.get("/api/layers/{layer_id}/stats")
async def get_layer_stats(layer_id: str):
    """Get statistics for a specific layer"""
    global spatial_service
    
    if not spatial_service:
        raise HTTPException(status_code=503, detail="Spatial service not initialized")
    
    try:
        stats = await spatial_service.get_layer_stats(layer_id)
        if not stats:
            raise HTTPException(status_code=404, detail=f"Layer {layer_id} not found")
        
        return stats
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get layer stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get layer stats: {str(e)}")

@app.websocket("/ws/citizen_chatbot/")
async def websocket_chatbot_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time citizen chatbot"""
    await handle_websocket_connection(websocket)

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    try:
        logger.info("Starting Texas Vanrakshak backend services...")
        
        # Start grid fire risk scheduler
        try:
            grid_fire_scheduler.start()
            logger.info("Grid fire risk scheduler started")
        except Exception as e:
            logger.warning(f"Failed to start grid fire scheduler: {str(e)}")
        
        logger.info("Grid fire services initialized successfully")
    except Exception as e:
        logger.error(f"Grid fire startup failed: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    try:
        logger.info("Shutting down Texas Vanrakshak backend services...")
        
        # Stop grid fire risk scheduler
        try:
            grid_fire_scheduler.stop()
            logger.info("Grid fire risk scheduler stopped")
        except Exception as e:
            logger.warning(f"Error stopping grid fire scheduler: {str(e)}")
        
        logger.info("Shutdown complete")
    except Exception as e:
        logger.error(f"Shutdown error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    args = parse_arguments()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=args.port,
        reload=True,
        log_level="info"
    ) 