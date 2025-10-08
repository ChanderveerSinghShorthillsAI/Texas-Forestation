/**
 * Carbon Estimation Service
 * Service for interacting with the backend carbon estimation API
 */

class CarbonEstimationService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
    this.cache = new Map();
    this.abortController = null;
  }

  /**
   * Get carbon estimation for a specific county
   * @param {string} countyName - County name (e.g., 'Harris')
   * @param {string} countyFips - County FIPS code (optional)
   * @param {boolean} useCache - Use cached data for faster response (default: true)
   * @returns {Promise<Object>} Carbon estimation data
   */
  async getCountyCarbon(countyName, countyFips = null, useCache = true) {
    const cacheKey = `county_${countyName || countyFips}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log(`[CarbonService] Using cached data for ${countyName || countyFips}`);
      return this.cache.get(cacheKey);
    }

    // Use per-call abort controller to avoid cancelling other requests (hover vs preload)
    const controller = new AbortController();

    try {
      let url = `${this.baseURL}/api/carbon/county`;
      const params = new URLSearchParams();
      
      if (countyName) params.append('county_name', countyName);
      if (countyFips) params.append('county_fips', countyFips);
      params.append('use_cache', useCache.toString());
      
      url += `?${params.toString()}`;

      console.log(`[CarbonService] Fetching carbon data for ${countyName || countyFips} (cache: ${useCache})`);
      const startTime = performance.now();

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const duration = (performance.now() - startTime).toFixed(0);
      console.log(`[CarbonService] Response received in ${duration}ms`);
      
      if (result.success) {
        // Cache the result for 60 minutes
        this.cache.set(cacheKey, result.data);
        setTimeout(() => this.cache.delete(cacheKey), 60 * 60 * 1000);
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to get county carbon data');
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[CarbonService] County carbon request aborted');
        return null;
      }
      console.error('[CarbonService] Error fetching county carbon:', error);
      throw error;
    }
  }

  /**
   * Get statewide carbon estimation for all Texas counties
   * @returns {Promise<Object>} Statewide carbon data
   */
  async getStatewideCarbon() {
    const cacheKey = 'statewide_carbon';
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log('[CarbonService] Using cached statewide data');
      return this.cache.get(cacheKey);
    }

    try {
      console.log('[CarbonService] Fetching statewide carbon data');
      const startTime = performance.now();
      
      const response = await fetch(`${this.baseURL}/api/carbon/statewide`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const duration = (performance.now() - startTime).toFixed(0);
      console.log(`[CarbonService] Statewide data received in ${duration}ms`);
      
      if (result.success) {
        // Cache for 60 minutes (statewide data doesn't change frequently)
        this.cache.set(cacheKey, result.data);
        setTimeout(() => this.cache.delete(cacheKey), 60 * 60 * 1000);
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to get statewide carbon data');
      }

    } catch (error) {
      console.error('[CarbonService] Error fetching statewide carbon:', error);
      throw error;
    }
  }

  /**
   * Get top carbon-rich counties
   * @param {number} limit - Number of top counties to return (default: 10)
   * @returns {Promise<Object>} Top counties data
   */
  async getTopCarbonCounties(limit = 10) {
    const cacheKey = `top_counties_${limit}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log(`[CarbonService] Using cached top ${limit} counties`);
      return this.cache.get(cacheKey);
    }

    try {
      console.log(`[CarbonService] Fetching top ${limit} counties`);
      const startTime = performance.now();
      
      const response = await fetch(`${this.baseURL}/api/carbon/counties/top?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const duration = (performance.now() - startTime).toFixed(0);
      console.log(`[CarbonService] Top counties received in ${duration}ms`);
      
      if (result.success) {
        // Cache for 60 minutes
        this.cache.set(cacheKey, result.data);
        setTimeout(() => this.cache.delete(cacheKey), 60 * 60 * 1000);
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to get top carbon counties');
      }

    } catch (error) {
      console.error('[CarbonService] Error fetching top carbon counties:', error);
      throw error;
    }
  }

  /**
   * Get cached carbon data for all Texas counties
   * @returns {Promise<Array<{county_name:string, county_fips:string, total_carbon_tons:number}>>}
   */
  async getAllCountiesCarbon() {
    const cacheKey = 'all_counties_carbon';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${this.baseURL}/api/carbon/counties/all`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        const list = result.data?.counties || [];
        this.cache.set(cacheKey, list);
        return list;
      }
      throw new Error(result.message || 'Failed to get all counties carbon data');
    } catch (error) {
      console.error('Error fetching all counties carbon:', error);
      throw error;
    }
  }

  /**
   * Get carbon estimation methodology documentation
   * @returns {Promise<Object>} Methodology information
   */
  async getMethodology() {
    const cacheKey = 'methodology';
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${this.baseURL}/api/carbon/methodology`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Cache methodology (doesn't change often)
        this.cache.set(cacheKey, result.data);
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to get methodology');
      }

    } catch (error) {
      console.error('Error fetching methodology:', error);
      throw error;
    }
  }

  /**
   * Check carbon service health
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseURL}/api/carbon/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('Error checking carbon service health:', error);
      throw error;
    }
  }

  /**
   * Extract county name from clicked feature properties
   * @param {Object} feature - GeoJSON feature
   * @returns {string|null} County name
   */
  extractCountyName(feature) {
    if (!feature || !feature.properties) return null;

    // Try different possible county name fields
    const nameFields = ['Name', 'NAME', 'NAME10', 'NAMELSAD', 'NAMELSAD10', 'county_name', 'COUNTY', 'County'];
    
    for (const field of nameFields) {
      if (feature.properties[field]) {
        return feature.properties[field];
      }
    }

    return null;
  }

  /**
   * Format carbon value for display
   * @param {number} value - Carbon value in tons
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted string
   */
  formatCarbonValue(value, decimals = 2) {
    if (value === null || value === undefined) return 'N/A';
    
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(decimals)}M tons`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(decimals)}K tons`;
    } else {
      return `${value.toFixed(decimals)} tons`;
    }
  }

  /**
   * Format CO2 equivalent value for display
   * @param {number} value - CO2 equivalent value in tons
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted string
   */
  formatCO2Value(value, decimals = 2) {
    if (value === null || value === undefined) return 'N/A';
    
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(decimals)}M tons CO2`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(decimals)}K tons CO2`;
    } else {
      return `${value.toFixed(decimals)} tons CO2`;
    }
  }

  /**
   * Check if carbon data is a default estimate
   * @param {Object} carbonData - Carbon data object
   * @returns {boolean} True if this is a default estimate
   */
  isDefaultEstimate(carbonData) {
    if (!carbonData) return false;
    return carbonData.methodology_notes && 
           carbonData.methodology_notes.includes('Default Carbon Estimation');
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Cancel any ongoing requests
   */
  cancelRequests() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Get carbon density categories for visualization
   * @param {number} carbonTons - Carbon amount in tons
   * @returns {Object} Category info with color and label
   */
  /**
   * Get continuous color based on carbon value using gradient interpolation
   * @param {number} carbonTons - Carbon amount in tons
   * @returns {Object} Category info with interpolated color
   */
  getCarbonCategory(carbonTons, isDefault = false) {
    if (carbonTons == null) {
      return { category: 'unknown', color: '#e5e7eb', label: 'No Data', percentage: 0 };
    }
    
    // Use percentile-based gradient for balanced color distribution
    const thresholds = window.dynamicCarbonThresholds;
    let result;
    if (!thresholds) {
      // Fallback gradient
      result = this._getPercentileGradientColor(carbonTons, 0, 500000);
    } else {
      result = this._getPercentileGradientColor(carbonTons, thresholds);
    }
    
    // If this is a default estimate, modify the label but keep the gradient color
    if (isDefault) {
      result.label = result.label + ' (Default)';
      result.category = 'default-' + result.category;
    }
    
    return result;
  }

  /**
   * Calculate gradient color between green -> yellow -> orange -> red -> dark blue
   * @param {number} value - Current carbon value
   * @param {number} min - Minimum value in dataset
   * @param {number} max - Maximum value in dataset
   * @returns {Object} Color info with RGB values
   */
  _getGradientColor(value, min, max) {
    // Normalize value to 0-1 range
    const normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const percentage = Math.round(normalizedValue * 100);
    
    let r, g, b, label;
    
    if (normalizedValue <= 0.2) {
      // Light Green to Green (0-20%)
      const t = normalizedValue / 0.2;
      r = Math.round(220 - (220 - 34) * t);   // 220 -> 34
      g = Math.round(252 - (252 - 197) * t);  // 252 -> 197
      b = Math.round(121 - (121 - 94) * t);   // 121 -> 94
      label = 'Very Low';
    } else if (normalizedValue <= 0.4) {
      // Green to Yellow-Green (20-40%)
      const t = (normalizedValue - 0.2) / 0.2;
      r = Math.round(34 + (132 - 34) * t);    // 34 -> 132
      g = Math.round(197 + (204 - 197) * t);  // 197 -> 204
      b = Math.round(94 - (94 - 22) * t);     // 94 -> 22
      label = 'Low';
    } else if (normalizedValue <= 0.6) {
      // Yellow-Green to Orange (40-60%)
      const t = (normalizedValue - 0.4) / 0.2;
      r = Math.round(132 + (249 - 132) * t);  // 132 -> 249
      g = Math.round(204 - (204 - 115) * t);  // 204 -> 115
      b = Math.round(22 + (0 - 22) * t);      // 22 -> 0
      label = 'Medium';
    } else if (normalizedValue <= 0.8) {
      // Orange to Red (60-80%)
      const t = (normalizedValue - 0.6) / 0.2;
      r = Math.round(249 - (249 - 239) * t);  // 249 -> 239
      g = Math.round(115 - (115 - 68) * t);   // 115 -> 68
      b = Math.round(0 + (68 - 0) * t);       // 0 -> 68
      label = 'High';
    } else {
      // Red to Dark Blue (80-100%)
      const t = (normalizedValue - 0.8) / 0.2;
      r = Math.round(239 - (239 - 30) * t);   // 239 -> 30
      g = Math.round(68 - (68 - 64) * t);     // 68 -> 64
      b = Math.round(68 + (175 - 68) * t);    // 68 -> 175
      label = 'Very High';
    }
    
    const color = `rgb(${r}, ${g}, ${b})`;
    const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    
    return {
      category: label.toLowerCase().replace(' ', '-'),
      color: hexColor,
      label: label,
      percentage: percentage,
      rgb: { r, g, b }
    };
  }

  /**
   * Calculate gradient color using percentile-based distribution for balanced colors
   * @param {number} value - Current carbon value
   * @param {Object} thresholds - Threshold object with percentile values
   * @returns {Object} Color info with RGB values
   */
  _getPercentileGradientColor(value, thresholds) {
    let normalizedValue, label;
    
    if (typeof thresholds === 'object' && thresholds.high && thresholds.medium) {
      // Use percentile-based mapping for even color distribution
      if (value >= thresholds.high) {
        // Top 33% - map to 0.6-1.0 range (orange to dark blue)
        const topRange = thresholds.max - thresholds.high;
        const topPosition = topRange > 0 ? (value - thresholds.high) / topRange : 0;
        normalizedValue = 0.6 + (topPosition * 0.4); // 60-100%
        label = topPosition > 0.5 ? 'Very High' : 'High';
      } else if (value >= thresholds.medium) {
        // Middle 33% - map to 0.3-0.6 range (yellow-green to orange)
        const midRange = thresholds.high - thresholds.medium;
        const midPosition = midRange > 0 ? (value - thresholds.medium) / midRange : 0;
        normalizedValue = 0.3 + (midPosition * 0.3); // 30-60%
        label = 'Medium';
      } else {
        // Bottom 33% - map to 0.0-0.3 range (light green to yellow-green)
        const lowRange = thresholds.medium - (thresholds.min || 0);
        const lowPosition = lowRange > 0 ? (value - (thresholds.min || 0)) / lowRange : 0;
        normalizedValue = lowPosition * 0.3; // 0-30%
        label = lowPosition > 0.5 ? 'Low' : 'Very Low';
      }
    } else {
      // Fallback linear mapping
      const range = (typeof thresholds === 'number' ? thresholds : 500000) - 0;
      normalizedValue = Math.max(0, Math.min(1, value / range));
      label = normalizedValue > 0.6 ? 'High' : normalizedValue > 0.3 ? 'Medium' : 'Low';
    }

    // Ensure normalizedValue is within bounds
    normalizedValue = Math.max(0, Math.min(1, normalizedValue));
    const percentage = Math.round(normalizedValue * 100);
    
    let r, g, b;
    
    // Realistic forest vegetation gradient (based on satellite imagery and NDVI)
    if (normalizedValue <= 0.2) {
      // Sparse/Grassland to Light Vegetation (0-20%) - prairie/savanna
      const t = normalizedValue / 0.2;
      r = Math.round(245 - (245 - 220) * t);  // 245 -> 220 (beige to light green)
      g = Math.round(245 - (245 - 235) * t);  // 245 -> 235 (pale yellow-green)
      b = Math.round(220 - (220 - 190) * t);  // 220 -> 190 (very light)
    } else if (normalizedValue <= 0.4) {
      // Light Vegetation to Young Forest (20-40%) - scrubland/young trees
      const t = (normalizedValue - 0.2) / 0.2;
      r = Math.round(220 - (220 - 180) * t);  // 220 -> 180 (light brown-green)
      g = Math.round(235 - (235 - 215) * t);  // 235 -> 215 (pale green)
      b = Math.round(190 - (190 - 150) * t);  // 190 -> 150 (muted)
    } else if (normalizedValue <= 0.6) {
      // Young Forest to Mature Forest (40-60%) - established woodland
      const t = (normalizedValue - 0.4) / 0.2;
      r = Math.round(180 - (180 - 120) * t);  // 180 -> 120 (earthy green)
      g = Math.round(215 - (215 - 180) * t);  // 215 -> 180 (natural green)
      b = Math.round(150 - (150 - 100) * t);  // 150 -> 100 (realistic tone)
    } else if (normalizedValue <= 0.8) {
      // Mature Forest to Dense Forest (60-80%) - thick canopy
      const t = (normalizedValue - 0.6) / 0.2;
      r = Math.round(120 - (120 - 70) * t);   // 120 -> 70 (deep forest)
      g = Math.round(180 - (180 - 140) * t);  // 180 -> 140 (rich green)
      b = Math.round(100 - (100 - 70) * t);   // 100 -> 70 (forest shadow)
    } else {
      // Dense Forest to Old Growth (80-100%) - pristine forest
      const t = (normalizedValue - 0.8) / 0.2;
      r = Math.round(70 - (70 - 40) * t);     // 70 -> 40 (very dark)
      g = Math.round(140 - (140 - 100) * t);  // 140 -> 100 (deep forest green)
      b = Math.round(70 - (70 - 50) * t);     // 70 -> 50 (old growth)
    }
    
    const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    
    return {
      category: label.toLowerCase().replace(' ', '-'),
      color: hexColor,
      label: label,
      percentage: percentage,
      rgb: { r, g, b }
    };
  }
}

// Create and export singleton instance
export const carbonEstimationService = new CarbonEstimationService();
export default carbonEstimationService;
