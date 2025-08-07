/**
 * Backend Spatial Query Service
 * Communicates with FastAPI backend for high-performance spatial queries
 */

const API_BASE_URL = 'http://localhost:8000';

class BackendSpatialQueryService {
  constructor() {
    this.isBackendAvailable = false;
    this.checkBackendHealth();
  }

  /**
   * Check if backend is available
   */
  async checkBackendHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      if (response.ok) {
        this.isBackendAvailable = true;
        console.log('✅ Backend spatial query service is available');
      } else {
        this.isBackendAvailable = false;
        console.warn('⚠️ Backend spatial query service returned error');
      }
    } catch (error) {
      this.isBackendAvailable = false;
      console.warn('⚠️ Backend spatial query service not available:', error.message);
    }
  }

  /**
   * Perform spatial query using backend API
   * @param {Array} clickPoint - [lng, lat] coordinates
   * @param {Function} onProgress - Progress callback (not used for backend)
   * @param {Function} onResults - Results callback
   */
  async performSpatialQuery(clickPoint, onProgress = null, onResults = null) {
    if (!this.isBackendAvailable) {
      // Re-check backend availability
      await this.checkBackendHealth();
      
      if (!this.isBackendAvailable) {
        throw new Error('Backend spatial query service is not available. Please start the FastAPI server.');
      }
    }

    const [longitude, latitude] = clickPoint;

    // Show initial progress
    if (onProgress) {
      onProgress({
        processed: 0,
        total: 1,
        currentLayer: 'Connecting to backend...',
        polygonCount: 0,
        pointCount: 0
      });
    }

    try {
      console.log(`🔍 Querying backend for point: ${longitude}, ${latitude}`);
      
      const response = await fetch(`${API_BASE_URL}/api/spatial-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          longitude: longitude,
          latitude: latitude,
          max_distance_km: 50,
          max_nearest_points: 20
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Backend query failed');
      }

      const backendResults = await response.json();
      
      // Convert backend response to frontend format
      const frontendResults = this.convertBackendResponse(backendResults);
      
      console.log(`✅ Backend query complete: ${frontendResults.polygonData.length} polygons, ${frontendResults.nearestPoints.length} points in ${backendResults.query_duration_ms}ms`);

      // Show completion progress
      if (onProgress) {
        onProgress({
          processed: backendResults.total_layers_searched,
          total: backendResults.total_layers_searched,
          currentLayer: 'Query complete!',
          polygonCount: frontendResults.polygonData.length,
          pointCount: frontendResults.nearestPoints.length
        });
      }

      // Return results
      if (onResults) {
        onResults(frontendResults);
      }

      return frontendResults;

    } catch (error) {
      console.error('❌ Backend spatial query failed:', error);
      throw error;
    }
  }

  /**
   * Convert backend response format to frontend format
   */
  convertBackendResponse(backendResults) {
    return {
      clickCoordinates: {
        lng: backendResults.click_coordinates.longitude,
        lat: backendResults.click_coordinates.latitude,
        formatted: backendResults.click_coordinates.formatted
      },
      polygonData: backendResults.polygon_matches.map(match => ({
        properties: match.properties,
        layerId: match.layer_id,
        layerName: match.layer_name,
        queryType: 'polygon'
      })),
      nearestPoints: backendResults.nearest_points.map(point => ({
        properties: point.properties,
        layerId: point.layer_id,
        layerName: point.layer_name,
        distance: point.distance_km,
        distanceFormatted: point.distance_formatted,
        queryType: 'point'
      })),
      queryTimestamp: backendResults.query_timestamp,
      isComplete: true,
      processedLayers: backendResults.total_layers_searched,
      totalLayers: backendResults.total_layers_searched,
      queryDurationMs: backendResults.query_duration_ms,
      isBackendQuery: true
    };
  }

  /**
   * Get backend health status
   */
  async getHealthStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get layers information from backend
   */
  async getLayersInfo() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/layers`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Failed to get layers info:', error);
      return null;
    }
  }

  /**
   * Cancel query (immediate for backend)
   */
  cancelQuery() {
    console.log('🛑 Backend query cancellation requested');
    // Backend queries are fast, so cancellation is immediate
  }

  /**
   * Clear cache (backend manages its own cache)
   */
  clearCache() {
    console.log('🧹 Backend cache clearing requested');
    // Backend manages its own cache
  }

  /**
   * Get cache stats from backend
   */
  async getCacheStats() {
    const healthStatus = await this.getHealthStatus();
    if (healthStatus) {
      return {
        backendAvailable: true,
        totalLayers: healthStatus.database_layers,
        totalFeatures: healthStatus.total_features,
        indexedLayers: healthStatus.indexed_layers
      };
    }
    return {
      backendAvailable: false,
      totalLayers: 0,
      totalFeatures: 0,
      indexedLayers: 0
    };
  }
}

// Export singleton instance
export const backendSpatialQueryService = new BackendSpatialQueryService(); 