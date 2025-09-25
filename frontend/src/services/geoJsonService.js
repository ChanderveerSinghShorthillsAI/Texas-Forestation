/**
 * Service for loading and caching GeoJSON data
 */

class GeoJsonService {
  constructor() {
    this.cache = new Map();
    this.loadingPromises = new Map();
  }

  /**
   * Load GeoJSON data from file with caching
   * @param {string} filename - The GeoJSON filename
   * @param {string} basePath - Optional base path for the file
   * @returns {Promise<Object>} - The GeoJSON data
   */
  async loadGeoJson(filename, basePath = null) {
    const cacheKey = basePath ? `${basePath}${filename}` : filename;
    
    // Return cached data if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Return existing loading promise if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    // Create new loading promise
    const loadingPromise = this.fetchGeoJson(filename, basePath);
    this.loadingPromises.set(cacheKey, loadingPromise);

    try {
      const data = await loadingPromise;
      this.cache.set(cacheKey, data);
      this.loadingPromises.delete(cacheKey);
      return data;
    } catch (error) {
      this.loadingPromises.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Fetch GeoJSON data from the public folder
   * @param {string} filename - The GeoJSON filename
   * @param {string} basePath - Optional base path for the file
   * @returns {Promise<Object>} - The GeoJSON data
   */
  async fetchGeoJson(filename, basePath = null) {
    try {
      // Determine the full URL based on basePath
      let url;
      if (basePath) {
        url = `${basePath}${filename}`;
      } else {
        url = `/Texas_Geojsons/Texas_Geojsons/${filename}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load ${filename}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Validate GeoJSON structure
      if (!data || !data.type) {
        throw new Error(`Invalid GeoJSON structure in ${filename}`);
      }

      return data;
    } catch (error) {
      console.error(`Error loading GeoJSON file ${filename}:`, error);
      throw new Error(`Failed to load ${filename}: ${error.message}`);
    }
  }

  /**
   * Preload multiple GeoJSON files
   * @param {string[]} filenames - Array of filenames to preload
   * @returns {Promise<Object[]>} - Array of loaded GeoJSON data
   */
  async preloadGeoJsonFiles(filenames) {
    const promises = filenames.map(filename => this.loadGeoJson(filename));
    return Promise.allSettled(promises);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get cache size
   * @returns {number} - Number of cached files
   */
  getCacheSize() {
    return this.cache.size;
  }

  /**
   * Get loading status for a file
   * @param {string} filename - The GeoJSON filename
   * @param {string} basePath - Optional base path for the file
   * @returns {string} - 'cached', 'loading', or 'not-loaded'
   */
  getLoadingStatus(filename, basePath = null) {
    const cacheKey = basePath ? `${basePath}${filename}` : filename;
    if (this.cache.has(cacheKey)) return 'cached';
    if (this.loadingPromises.has(cacheKey)) return 'loading';
    return 'not-loaded';
  }
}

// Create and export singleton instance
export const geoJsonService = new GeoJsonService();
export default geoJsonService; 