/**
 * S3 Configuration for GeoJSON files
 * Files are fetched via backend API (backend fetches from S3)
 * This avoids CORS issues and public access requirements
 */

const S3_CONFIG = {
  // Backend API URLs (backend handles S3 fetching)
  BACKEND_BASE_URL: process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000',
  
  // API endpoints for GeoJSON files
  get MAIN_GEOJSON_API_URL() {
    return `${this.BACKEND_BASE_URL}/api/geojson/main/`;
  },
  
  get FIRE_GEOJSON_API_URL() {
    return `${this.BACKEND_BASE_URL}/api/geojson/fire/`;
  },
  
  // Use local development mode if needed
  USE_LOCAL_FILES: process.env.REACT_APP_USE_LOCAL_GEOJSON === 'true',
  
  // Local fallback paths (only for essential default files)
  // Most files should be fetched via backend API from S3
  LOCAL_MAIN_PATH: '/default_geojsons/',  // Only contains texas.geojson and Texas_Counties.geojson
  // Fire GeoJSON files are fetched from backend/S3 (no local path needed)
};

export default S3_CONFIG;

