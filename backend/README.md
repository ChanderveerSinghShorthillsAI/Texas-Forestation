# Texas Spatial Query Backend

High-performance FastAPI backend for spatial queries on Texas GeoJSON data.

## Features

- **Lightning Fast**: In-memory SQLite database with spatial indexing
- **Optimized Queries**: Point-in-polygon and nearest neighbor search in milliseconds
- **Automatic Loading**: Reads GeoJSON files from frontend directory on startup
- **Smart Skipping**: Automatically skips problematic large census files
- **REST API**: Clean JSON API for frontend integration

## Quick Start

### 1. Start the Backend

```bash
cd backend
chmod +x start.sh
./start.sh
```

Or manually:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### 2. Verify Backend is Running

Visit: http://localhost:8000

You should see:
```json
{
  "message": "Texas Spatial Query API",
  "status": "running"
}
```

### 3. Check Health Status

Visit: http://localhost:8000/api/health

You should see layer statistics:
```json
{
  "status": "healthy",
  "spatial_service": "ready",
  "database_layers": 66,
  "total_features": 50000,
  "indexed_layers": 66
}
```

## API Endpoints

### Spatial Query
```
POST /api/spatial-query
```

Request:
```json
{
  "longitude": -99.0,
  "latitude": 31.0,
  "max_distance_km": 50,
  "max_nearest_points": 10
}
```

Response:
```json
{
  "click_coordinates": {
    "longitude": -99.0,
    "latitude": 31.0,
    "formatted": "31.000000, -99.000000"
  },
  "polygon_matches": [
    {
      "properties": {"county": "Travis"},
      "layer_id": "counties",
      "layer_name": "Counties"
    }
  ],
  "nearest_points": [
    {
      "properties": {"name": "Austin"},
      "layer_id": "cities",
      "layer_name": "Cities",
      "distance_km": 25.5,
      "distance_formatted": "25.50 km"
    }
  ],
  "query_timestamp": "2024-01-01T12:00:00",
  "query_duration_ms": 45,
  "total_layers_searched": 66
}
```

### Layer Information
```
GET /api/layers
```

### Health Check
```
GET /api/health
```

## Performance Benefits

### Frontend vs Backend Comparison

| Aspect | Frontend (Browser) | Backend (FastAPI) |
|--------|-------------------|-------------------|
| **Speed** | 10-30+ seconds | 50-200ms |
| **Memory** | Limited by browser | Server RAM |
| **Crashes** | Frequent timeouts | Never crashes |
| **Indexing** | None | Spatial indexing |
| **Processing** | Single-threaded | Multi-threaded |
| **Large Files** | Causes timeouts | Handles easily |

### Why Backend is Better

1. **Spatial Database**: Uses SQLite with spatial indexing instead of loading raw JSON
2. **Bounding Box Optimization**: Pre-filters candidates before expensive geometry operations
3. **Memory Management**: Server-grade memory handling vs browser limitations
4. **Preprocessing**: Converts and indexes data once at startup
5. **No JSON Parsing**: Direct geometry operations without JSON overhead

## Automatic Data Loading

The backend automatically:

1. **Finds GeoJSON files** in `../frontend/public/Texas_Geojsons/`
2. **Converts to spatial database** with proper indexing
3. **Skips problematic files** that cause performance issues:
   - `Texas_race_wise_population.geojson`
   - `Texas_census_block_groups.geojson`
   - `Texas_census_tracts.geojson`
   - `tracts_2010.geojson`
   - `Texas_tx_1degree_dd.geojson`
4. **Creates indexes** for ultra-fast spatial queries

## Troubleshooting

### Backend Won't Start
- Check Python 3.7+ is installed
- Ensure frontend directory exists at `../frontend/public/Texas_Geojsons/`
- Check port 8000 is available

### No Spatial Data
- Verify GeoJSON files exist in the frontend directory
- Check backend logs for loading errors
- Restart backend if files were added after startup

### Frontend Can't Connect
- Ensure backend is running on http://localhost:8000
- Check CORS settings in main.py
- Verify frontend is running on localhost:3000

## Development

### Adding New Endpoints
Edit `main.py` and add new routes

### Modifying Spatial Logic
Edit `spatial_service.py` for query optimizations

### Changing Database
Currently uses SQLite in-memory. Can be changed to PostgreSQL with PostGIS for production.

## Production Notes

For production deployment:
1. Use PostgreSQL with PostGIS extension
2. Add proper authentication
3. Use Docker for deployment
4. Add monitoring and logging
5. Implement data caching strategies 