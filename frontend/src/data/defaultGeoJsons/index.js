/**
 * Default GeoJSON files that load immediately (no API call)
 * These are bundled with the app for fast initial load
 */

import TexasCountiesData from './Texas_Counties.geojson';

// Map of default GeoJSON files
export const DEFAULT_GEOJSONS = {
  'Texas_Counties.geojson': TexasCountiesData,
};

/**
 * Check if a filename is a default GeoJSON
 * @param {string} filename - GeoJSON filename
 * @returns {boolean}
 */
export const isDefaultGeoJson = (filename) => {
  return filename in DEFAULT_GEOJSONS;
};

/**
 * Get default GeoJSON data
 * @param {string} filename - GeoJSON filename
 * @returns {Object|null} GeoJSON data or null if not default
 */
export const getDefaultGeoJson = (filename) => {
  return DEFAULT_GEOJSONS[filename] || null;
};

