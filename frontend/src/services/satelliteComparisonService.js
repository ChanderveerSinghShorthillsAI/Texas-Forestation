/**
 * Satellite Comparison Service
 * Handles API calls for temporal satellite image comparison
 */

const API_BASE_URL = 'http://localhost:8000';

class SatelliteComparisonService {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/satellite-comparison`;
  }

  /**
   * Check if the satellite comparison service is healthy
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      
      console.log('🛰️ Satellite service health:', data);
      return data;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        status: 'error',
        message: error.message,
        authenticated: false
      };
    }
  }

  /**
   * Search for available satellite imagery
   * @param {Object} params - Search parameters
   * @param {number} params.latitude - Center latitude
   * @param {number} params.longitude - Center longitude
   * @param {string} params.startDate - Start date (YYYY-MM-DD)
   * @param {string} params.endDate - End date (YYYY-MM-DD)
   * @param {number} params.bboxSize - Bounding box size in degrees
   * @param {number} params.maxCloudCover - Max cloud coverage (0-1)
   * @returns {Promise<Object>} Available imagery results
   */
  async searchImagery({
    latitude,
    longitude,
    startDate,
    endDate,
    bboxSize = 0.05,
    maxCloudCover = 0.3
  }) {
    try {
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        start_date: startDate,
        end_date: endDate,
        bbox_size: bboxSize.toString(),
        max_cloud_cover: maxCloudCover.toString()
      });

      console.log(`🔍 Searching imagery for (${latitude}, ${longitude})`);
      console.log(`📅 Date range: ${startDate} to ${endDate}`);

      const response = await fetch(`${this.baseUrl}/search?${params}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Search failed');
      }

      const data = await response.json();
      console.log(`✅ Found ${data.count} images`);
      
      return data;
    } catch (error) {
      console.error('❌ Search imagery failed:', error);
      throw error;
    }
  }

  /**
   * Get the best image for a specific date
   * @param {Object} params - Image request parameters
   * @param {number} params.latitude - Center latitude
   * @param {number} params.longitude - Center longitude
   * @param {string} params.date - Target date (YYYY-MM-DD)
   * @param {number} params.bboxSize - Bounding box size
   * @param {number} params.dateToleranceDays - Days tolerance
   * @returns {Promise<Object>} Best matching image
   */
  async getImageForDate({
    latitude,
    longitude,
    date,
    bboxSize = 0.05,
    dateToleranceDays = 7
  }) {
    try {
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        date: date,
        bbox_size: bboxSize.toString(),
        date_tolerance_days: dateToleranceDays.toString()
      });

      console.log(`🛰️ Getting image for ${date} at (${latitude}, ${longitude})`);

      const response = await fetch(`${this.baseUrl}/image?${params}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get image');
      }

      const data = await response.json();
      console.log(`✅ Found image: ${data.image.id}`);
      
      return data;
    } catch (error) {
      console.error('❌ Get image failed:', error);
      throw error;
    }
  }

  /**
   * Get comparison data for two dates
   * @param {Object} params - Comparison parameters
   * @param {number} params.latitude - Center latitude
   * @param {number} params.longitude - Center longitude
   * @param {string} params.date1 - First date (YYYY-MM-DD)
   * @param {string} params.date2 - Second date (YYYY-MM-DD)
   * @param {number} params.bboxSize - Bounding box size
   * @returns {Promise<Object>} Comparison data with both images
   */
  async compareImages({
    latitude,
    longitude,
    date1,
    date2,
    bboxSize = 0.05
  }) {
    try {
      console.log(`📊 Comparing images for (${latitude}, ${longitude})`);
      console.log(`📅 Date 1: ${date1}, Date 2: ${date2}`);

      const response = await fetch(`${this.baseUrl}/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          latitude,
          longitude,
          date1,
          date2,
          bbox_size: bboxSize
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Comparison failed');
      }

      const data = await response.json();
      console.log(`✅ Comparison complete: ${data.comparison.comparison.days_between} days between images`);
      
      return data;
    } catch (error) {
      console.error('❌ Compare images failed:', error);
      throw error;
    }
  }

  /**
   * Get Texas bounding box for map initialization
   * @returns {Promise<Object>} Texas bounds
   */
  async getTexasBounds() {
    try {
      const response = await fetch(`${this.baseUrl}/texas-bounds`);
      
      if (!response.ok) {
        throw new Error('Failed to get Texas bounds');
      }

      const data = await response.json();
      return data.bounds;
    } catch (error) {
      console.error('❌ Get Texas bounds failed:', error);
      // Return default Texas bounds if API fails
      return {
        southwest: { lat: 25.84, lng: -106.65 },
        northeast: { lat: 36.50, lng: -93.51 },
        center: { lat: 31.17, lng: -100.08 }
      };
    }
  }

  /**
   * Format date for API (YYYY-MM-DD)
   * @param {Date} date - Date object
   * @returns {string} Formatted date string
   */
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Validate date range
   * @param {string} date1 - First date
   * @param {string} date2 - Second date
   * @returns {Object} Validation result
   */
  validateDateRange(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const now = new Date();

    const errors = [];

    if (isNaN(d1.getTime())) {
      errors.push('Invalid first date');
    }

    if (isNaN(d2.getTime())) {
      errors.push('Invalid second date');
    }

    if (d1 >= d2) {
      errors.push('First date must be before second date');
    }

    if (d1 > now || d2 > now) {
      errors.push('Dates cannot be in the future');
    }

    // Planet Labs data generally available from 2016
    const minDate = new Date('2016-01-01');
    if (d1 < minDate || d2 < minDate) {
      errors.push('Dates must be after January 2016');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate days between two dates
   * @param {string} date1 - First date
   * @param {string} date2 - Second date
   * @returns {number} Days between dates
   */
  daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  }
}

// Export singleton instance
const satelliteComparisonService = new SatelliteComparisonService();
export default satelliteComparisonService;

