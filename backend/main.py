from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import os
from pathlib import Path
import logging
from contextlib import asynccontextmanager

from spatial_service import SpatialQueryService
from models import SpatialQueryRequest, SpatialQueryResponse

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global spatial service instance
spatial_service = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global spatial_service
    
    # Startup
    logger.info("🚀 Starting FastAPI Spatial Query Service")
    spatial_service = SpatialQueryService()
    
    # Load GeoJSON data into spatial database
    geojson_dir = Path("../frontend/public/Texas_Geojsons")
    if geojson_dir.exists():
        await spatial_service.initialize_spatial_data(geojson_dir)
        logger.info("✅ Spatial data initialization complete")
    else:
        logger.warning("⚠️ GeoJSON directory not found, spatial queries may not work")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down spatial service")
    await spatial_service.cleanup()

# Create FastAPI app
app = FastAPI(
    title="Texas Spatial Query API",
    description="High-performance spatial queries for Texas GeoJSON data",
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

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Texas Spatial Query API",
        "status": "running",
        "endpoints": {
            "spatial_query": "/api/spatial-query",
            "layers": "/api/layers",
            "health": "/api/health"
        }
    }

@app.get("/api/health")
async def health_check():
    """Detailed health check"""
    global spatial_service
    
    if not spatial_service:
        raise HTTPException(status_code=503, detail="Spatial service not initialized")
    
    stats = await spatial_service.get_stats()
    return {
        "status": "healthy",
        "spatial_service": "ready",
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    ) 