/**
 * Grid Fire Service
 * Handles API calls for Texas-wide grid-based fire prediction system
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const GRID_FIRE_API_URL = `${API_BASE_URL}/api/grid-fire`;

class GridFireService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get cached data if still fresh
   */
  getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Cache data with timestamp
   */
  setCachedData(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get grid fire system health status
   */
  async getHealth() {
    try {
      const response = await fetch(`${GRID_FIRE_API_URL}/health`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching grid fire health:', error);
      throw error;
    }
  }

  /**
   * Get grid system statistics
   */
  async getStatistics() {
    const cacheKey = 'grid_statistics';
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${GRID_FIRE_API_URL}/statistics`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching grid statistics:', error);
      throw error;
    }
  }

  /**
   * Update fire risk grid data
   */
  async updateGrid(options = {}) {
    const {
      useStrategicPoints = true,
      densityFactor = 0.1,
      forecastDays = 7
    } = options;

    try {
      const response = await fetch(`${GRID_FIRE_API_URL}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          use_strategic_points: useStrategicPoints,
          density_factor: densityFactor,
          forecast_days: forecastDays
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Clear cache after update
      this.cache.clear();
      
      return await response.json();
    } catch (error) {
      console.error('Error updating grid:', error);
      throw error;
    }
  }

  /**
   * Quick grid update using strategic points
   */
  async quickUpdate() {
    try {
      const response = await fetch(`${GRID_FIRE_API_URL}/update/quick`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Clear cache after update
      this.cache.clear();
      
      return await response.json();
    } catch (error) {
      console.error('Error in quick update:', error);
      throw error;
    }
  }

  /**
   * Get fire risk data in GeoJSON format
   */
  async getFireRiskGeoJSON(options = {}) {
    const {
      riskThreshold = 40.0,
      formatType = 'geojson'
    } = options;

    const cacheKey = `geojson_${riskThreshold}_${formatType}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        risk_threshold: riskThreshold,
        format_type: formatType
      });

      const response = await fetch(`${GRID_FIRE_API_URL}/geojson?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching fire risk GeoJSON:', error);
      throw error;
    }
  }

  /**
   * Get high-risk fire areas
   */
  async getHighRiskAreas(options = {}) {
    const {
      riskThreshold = 60.0,
      limit = 50
    } = options;

    const cacheKey = `high_risk_${riskThreshold}_${limit}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        risk_threshold: riskThreshold,
        limit: limit
      });

      const response = await fetch(`${GRID_FIRE_API_URL}/high-risk-areas?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching high-risk areas:', error);
      throw error;
    }
  }

  /**
   * Get fire risk statistics by Texas regions
   */
  async getRiskByRegion() {
    const cacheKey = 'risk_by_region';
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${GRID_FIRE_API_URL}/risk-by-region`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching risk by region:', error);
      throw error;
    }
  }

  /**
   * Get detailed information for a specific grid cell
   */
  async getGridCellInfo(gridIndex) {
    try {
      const response = await fetch(`${GRID_FIRE_API_URL}/grid-info/${gridIndex}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching grid cell ${gridIndex} info:`, error);
      throw error;
    }
  }

  /**
   * Get cache status and recommendations
   */
  async getCacheStatus() {
    try {
      const response = await fetch(`${GRID_FIRE_API_URL}/cache-status`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching cache status:', error);
      throw error;
    }
  }

  /**
   * Format fire risk data for map visualization
   */
  formatForMap(geoJsonData) {
    if (!geoJsonData || !geoJsonData.features) {
      return { features: [], metadata: {} };
    }

    return {
      type: 'FeatureCollection',
      features: geoJsonData.features.map(feature => ({
        ...feature,
        properties: {
          ...feature.properties,
          // Add formatted display text
          displayText: `Risk: ${feature.properties.fire_risk_score}% (${feature.properties.risk_category})`,
          popupContent: this.createPopupContent(feature.properties)
        }
      })),
      metadata: geoJsonData.metadata
    };
  }

  /**
   * Create popup content for map markers
   */
  createPopupContent(properties) {
    return `
      <div class="fire-risk-popup">
        <h4>Fire Risk: ${properties.fire_risk_score}%</h4>
        <p><strong>Category:</strong> ${properties.risk_category}</p>
        <p><strong>24h Max:</strong> ${properties.max_risk_24h}%</p>
        <p><strong>24h Avg:</strong> ${properties.avg_risk_24h}%</p>
        ${properties.temperature ? `<p><strong>Temperature:</strong> ${properties.temperature}°C</p>` : ''}
        ${properties.humidity ? `<p><strong>Humidity:</strong> ${properties.humidity}%</p>` : ''}
        ${properties.wind_speed ? `<p><strong>Wind Speed:</strong> ${properties.wind_speed} km/h</p>` : ''}
        <p><small>Updated: ${new Date(properties.forecast_time).toLocaleString()}</small></p>
      </div>
    `;
  }

  /**
   * Get risk color based on score
   */
  getRiskColor(riskScore) {
    if (riskScore < 20) return '#00ff00';      // Low - Green
    if (riskScore < 40) return '#ffff00';      // Moderate - Yellow  
    if (riskScore < 60) return '#ff8000';      // High - Orange
    if (riskScore < 80) return '#ff0000';      // Very High - Red
    return '#8b0000';                          // Extreme - Dark Red
  }

  /**
   * Get risk category based on score
   */
  getRiskCategory(riskScore) {
    if (riskScore < 20) return 'Low';
    if (riskScore < 40) return 'Moderate';
    if (riskScore < 60) return 'High';
    if (riskScore < 80) return 'Very High';
    return 'Extreme';
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let freshEntries = 0;
    let staleEntries = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp < this.cacheTimeout) {
        freshEntries++;
      } else {
        staleEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      freshEntries,
      staleEntries,
      cacheTimeout: this.cacheTimeout
    };
  }
}

// Create and export singleton instance
const gridFireService = new GridFireService();
export default gridFireService;
