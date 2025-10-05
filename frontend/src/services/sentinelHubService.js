/**
 * Sentinel Hub Service
 * High-quality satellite imagery comparison using Sentinel-2
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class SentinelHubService {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/sentinel-hub`;
  }

  /**
   * Check if Sentinel Hub service is healthy
   */
  async checkHealth() {
    try {
      console.log('🛰️ Checking Sentinel Hub service health...');
      const response = await fetch(`${this.baseUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('🛰️ Sentinel Hub service health:', data);
      return data;
    } catch (error) {
      console.error('❌ Sentinel Hub health check failed:', error);
      throw error;
    }
  }

  /**
   * Compare satellite images from two dates
   * @param {number} latitude - Location latitude
   * @param {number} longitude - Location longitude
   * @param {string} date1 - First date (YYYY-MM-DD)
   * @param {string} date2 - Second date (YYYY-MM-DD)
   * @param {number} bboxSize - Bounding box size (default: 0.05)
   */
  async compareImages(latitude, longitude, date1, date2, bboxSize = 0.05) {
    try {
      console.log(`📊 Comparing Sentinel-2 images for (${latitude}, ${longitude})`);
      console.log(`📅 Date 1: ${date1}, Date 2: ${date2}`);
      
      const response = await fetch(`${this.baseUrl}/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude,
          longitude,
          date1,
          date2,
          bbox_size: bboxSize,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Comparison complete: ${data.comparison.days_between} days between images`);
      return data;
    } catch (error) {
      console.error('❌ Comparison failed:', error);
      throw error;
    }
  }

  /**
   * Get a single satellite image for a specific date
   * @param {number} latitude - Location latitude
   * @param {number} longitude - Location longitude
   * @param {string} date - Target date (YYYY-MM-DD)
   * @param {number} bboxSize - Bounding box size (default: 0.05)
   */
  async getSingleImage(latitude, longitude, date, bboxSize = 0.05) {
    try {
      console.log(`📡 Fetching Sentinel-2 image for ${date} at (${latitude}, ${longitude})`);
      
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        date: date,
        bbox_size: bboxSize.toString(),
      });
      
      const response = await fetch(`${this.baseUrl}/image?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Image retrieved successfully`);
      return data;
    } catch (error) {
      console.error('❌ Image retrieval failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
const sentinelHubService = new SentinelHubService();
export default sentinelHubService;

