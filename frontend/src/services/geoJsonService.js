/**
 * Service for loading and caching GeoJSON data
 * Supports both S3 (production) and local (development) sources
 * Default layers load from local files (bundled) for fast initial load
 */

import S3_CONFIG from '../config/s3Config';
import { isDefaultGeoJson, getDefaultGeoJson } from '../data/defaultGeoJsons';

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

    // Check if this is a default GeoJSON (bundled locally)
    if (!basePath && isDefaultGeoJson(filename)) {
      console.log(`⚡ Loading default GeoJSON from bundle: ${filename}`);
      const data = getDefaultGeoJson(filename);
      
      // Validate and cache
      if (data && data.type) {
        this.cache.set(cacheKey, data);
        console.log(`✅ Loaded default GeoJSON: ${filename} (${data.features?.length || 0} features) - INSTANT!`);
        return data;
      }
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
   * Determine the correct URL for a GeoJSON file
   * @param {string} filename - The GeoJSON filename
   * @param {string} basePath - Optional base path for the file
   * @returns {string} - The full URL to fetch from
   */
  getGeoJsonUrl(filename, basePath = null) {
    // ALWAYS load default GeoJSONs from local public folder (fast!)
    // These files are critical for initial page load and should not go through backend/S3
    // Note: These are stored separately from Texas_Geojsons to avoid gitignore issues
    const ALWAYS_LOCAL_FILES = [
      'Texas_Counties.geojson',
      'texas.geojson' // Texas boundary
    ];
    
    if (!basePath && ALWAYS_LOCAL_FILES.includes(filename)) {
      console.log(`⚡ Loading ${filename} from local default_geojsons folder (INSTANT)`);
      return `/default_geojsons/${filename}`;
    }
    
    // If using local files (development mode)
    if (S3_CONFIG.USE_LOCAL_FILES) {
      if (basePath) {
        return `${basePath}${filename}`;
      }
      // Use default_geojsons for local development (only essential files)
      // Other files should be fetched via backend API
      return `${S3_CONFIG.LOCAL_MAIN_PATH}${filename}`;
    }

    // Production mode: Use Backend API (backend fetches from S3)
    // Determine if this is a fire-related GeoJSON by basePath or filename patterns
    const isFireGeoJson = (basePath && basePath.includes('fire')) || this._isFireRelatedFile(filename);
    
    if (isFireGeoJson) {
      return `${S3_CONFIG.FIRE_GEOJSON_API_URL}${filename}`;
    } else {
      return `${S3_CONFIG.MAIN_GEOJSON_API_URL}${filename}`;
    }
  }

  /**
   * Helper method to detect fire-related files by filename patterns
   * @param {string} filename - The filename to check
   * @returns {boolean} - True if the file is fire-related
   * @private
   */
  _isFireRelatedFile(filename) {
    // Fire-related filename patterns
    const firePatterns = [
      'MODIS_Thermal',           // MODIS thermal data
      'DMP_',                    // Dispatch, GACC boundaries
      'IMSR_',                   // IMSR incident data
      'WFIGS_',                  // Wildland Fire Information
      'PublicView_RAWS',         // RAWS weather stations
      'incident',                // All incident files
      'interagency',             // Interagency perimeters
      'dispatch',                // Dispatch-related
      'fire',                    // Generic fire keyword
      'perimeter',               // Fire perimeters
      'thermal'                  // Thermal data
    ];
    
    const lowerFilename = filename.toLowerCase();
    return firePatterns.some(pattern => lowerFilename.includes(pattern.toLowerCase()));
  }

  /**
   * Fetch GeoJSON data via backend API (backend fetches from S3) or local source
   * @param {string} filename - The GeoJSON filename
   * @param {string} basePath - Optional base path for the file
   * @returns {Promise<Object>} - The GeoJSON data
   */
  async fetchGeoJson(filename, basePath = null) {
    try {
      // Get the appropriate URL (backend API or local)
      const url = this.getGeoJsonUrl(filename, basePath);
      
      const source = S3_CONFIG.USE_LOCAL_FILES ? 'local' : 'backend API (S3)';
      console.log(`📥 Fetching GeoJSON: ${filename} from ${source}`);
      console.log(`   URL: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load ${filename}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Validate GeoJSON structure
      if (!data || !data.type) {
        throw new Error(`Invalid GeoJSON structure in ${filename}`);
      }

      console.log(`✅ Loaded GeoJSON: ${filename} (${data.features?.length || 0} features)`);
      return data;
    } catch (error) {
      console.error(`❌ Error loading GeoJSON file ${filename}:`, error);
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