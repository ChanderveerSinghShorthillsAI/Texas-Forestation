/**
 * Fire Tracking Service
 * Handles communication with NASA FIRMS fire detection API
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class FireTrackingService {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/fire`;
    this.cache = new Map();
    this.loadingPromises = new Map();
    this.cacheExpiry = new Map();
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Fetch current fire data for Texas
   * @param {string} dataset - FIRMS dataset to use
   * @param {number} days - Number of days to fetch
   * @returns {Promise<Object>} - GeoJSON fire data
   */
  async getTexasFireData(dataset = 'VIIRS_NOAA20_NRT', days = 1) {
    const cacheKey = `fire_${dataset}_${days}`;
    
    // Return cached data if available and valid
    if (this._isCacheValid(cacheKey)) {
      console.log('🔥 Returning cached fire data');
      return this.cache.get(cacheKey);
    }

    // Return existing loading promise if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    // Create new loading promise
    const loadingPromise = this._fetchFireData(dataset, days);
    this.loadingPromises.set(cacheKey, loadingPromise);

    try {
      const data = await loadingPromise;
      
      // Cache the result
      this.cache.set(cacheKey, data);
      this.cacheExpiry.set(cacheKey, Date.now() + this.cacheDuration);
      this.loadingPromises.delete(cacheKey);
      
      return data;
    } catch (error) {
      this.loadingPromises.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Internal method to fetch fire data from API
   */
  async _fetchFireData(dataset, days) {
    try {
      const url = `${this.baseUrl}/texas?dataset=${encodeURIComponent(dataset)}&days=${days}`;
      console.log('🔥 Fetching fire data from:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch fire data: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Validate GeoJSON structure
      if (!data || data.type !== 'FeatureCollection') {
        throw new Error('Invalid fire data format received');
      }

      console.log(`🔥 Fire data loaded: ${data.features.length} detections`);
      return data;
    } catch (error) {
      console.error('❌ Error fetching fire data:', error);
      throw new Error(`Failed to fetch fire data: ${error.message}`);
    }
  }

  /**
   * Get fire statistics for Texas
   * @param {string} dataset - FIRMS dataset to use
   * @param {number} days - Number of days for statistics
   * @returns {Promise<Object>} - Fire statistics
   */
  async getFireStatistics(dataset = 'VIIRS_NOAA20_NRT', days = 1) {
    try {
      const url = `${this.baseUrl}/statistics?dataset=${encodeURIComponent(dataset)}&days=${days}`;
      console.log('📊 Fetching fire statistics from:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch fire statistics: ${response.status} ${response.statusText}`);
      }

      const stats = await response.json();
      console.log('📊 Fire statistics loaded:', stats);
      
      return stats;
    } catch (error) {
      console.error('❌ Error fetching fire statistics:', error);
      throw new Error(`Failed to fetch fire statistics: ${error.message}`);
    }
  }

  /**
   * Get available FIRMS datasets
   * @returns {Promise<Object>} - Available datasets
   */
  async getAvailableDatasets() {
    try {
      const url = `${this.baseUrl}/datasets`;
      console.log('📋 Fetching available datasets from:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch datasets: ${response.status} ${response.statusText}`);
      }

      const datasets = await response.json();
      console.log('📋 Available datasets loaded:', datasets);
      
      return datasets;
    } catch (error) {
      console.error('❌ Error fetching available datasets:', error);
      throw new Error(`Failed to fetch available datasets: ${error.message}`);
    }
  }

  /**
   * Clear fire data cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
    this.loadingPromises.clear();
    console.log('🧹 Fire data cache cleared');
  }

  /**
   * Force refresh by clearing cache and fetching new data
   */
  async forceRefresh(dataset = 'VIIRS_NOAA20_NRT', days = 1) {
    this.clearCache();
    return await this.getTexasFireData(dataset, days);
  }

  /**
   * Clear server-side cache
   */
  async clearServerCache() {
    try {
      const url = `${this.baseUrl}/cache/clear`;
      const response = await fetch(url, { method: 'POST' });
      
      if (!response.ok) {
        throw new Error(`Failed to clear server cache: ${response.status}`);
      }

      const result = await response.json();
      console.log('🧹 Server cache cleared:', result);
      
      // Also clear local cache
      this.clearCache();
      
      return result;
    } catch (error) {
      console.error('❌ Error clearing server cache:', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  async getServiceHealth() {
    try {
      const url = `${this.baseUrl}/health`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Fire service health check failed:', error);
      throw error;
    }
  }

  /**
   * Check if cached data is still valid
   */
  _isCacheValid(cacheKey) {
    if (!this.cache.has(cacheKey)) return false;
    if (!this.cacheExpiry.has(cacheKey)) return false;
    return Date.now() < this.cacheExpiry.get(cacheKey);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      loadingPromises: this.loadingPromises.size,
      cacheDurationMs: this.cacheDuration
    };
  }

  /**
   * Format fire detection for display
   */
  formatFireDetection(feature) {
    const props = feature.properties;
    
    return {
      id: `fire_${props.latitude}_${props.longitude}_${props.acq_date}_${props.acq_time}`,
      coordinates: feature.geometry.coordinates,
      detectionTime: props.detection_time || 'Unknown',
      confidence: parseFloat(props.confidence || 0),
      confidenceLevel: props.confidence_level || 'Unknown',
      fireRadiativePower: parseFloat(props.frp || 0),
      fireIntensity: props.fire_intensity || 'Unknown',
      dataset: props.dataset_name || props.dataset || 'Unknown',
      satellite: this._extractSatellite(props.dataset || ''),
      brightness: parseFloat(props.bright_ti4 || props.brightness || props.bright_ti5 || 0),
      scan: parseFloat(props.scan || 0),
      track: parseFloat(props.track || 0)
    };
  }

  /**
   * Extract satellite name from dataset
   */
  _extractSatellite(dataset) {
    if (dataset.includes('NOAA20')) return 'NOAA-20';
    if (dataset.includes('NOAA21')) return 'NOAA-21';
    if (dataset.includes('SNPP')) return 'Suomi-NPP';
    if (dataset.includes('MODIS')) return 'MODIS';
    if (dataset.includes('LANDSAT')) return 'Landsat';
    return 'Unknown';
  }

  /**
   * Get fire marker style based on properties
   */
  getFireMarkerStyle(feature) {
    const props = feature.properties;
    const confidence = parseFloat(props.confidence || 0);
    const frp = parseFloat(props.frp || 0);
    
    // Determine color based on confidence
    let fillColor = '#ff6b6b'; // Default red
    if (confidence >= 80) {
      fillColor = '#ff3333'; // Bright red for high confidence
    } else if (confidence >= 50) {
      fillColor = '#ff6b6b'; // Medium red
    } else if (confidence >= 30) {
      fillColor = '#ff9999'; // Light red
    } else {
      fillColor = '#ffcccc'; // Very light red
    }
    
    // Determine size based on FRP (Fire Radiative Power)
    let radius = 4;
    if (frp >= 100) {
      radius = 12;
    } else if (frp >= 50) {
      radius = 10;
    } else if (frp >= 20) {
      radius = 8;
    } else if (frp >= 5) {
      radius = 6;
    }
    
    return {
      radius,
      fillColor,
      color: '#cc0000',
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.8
    };
  }
}

// Create and export singleton instance
export const fireTrackingService = new FireTrackingService();
export default fireTrackingService;
