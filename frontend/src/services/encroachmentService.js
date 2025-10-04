/**
 * Encroachment Service
 * Handles API calls for encroachment tracking data
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class EncroachmentService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/api/encroachment`;
  }

  /**
   * Get latest encroachment data for Texas region (simplified)
   * @param {Object} params - Query parameters
   * @param {string} params.confidence_level - Confidence level filter
   * @param {number} params.limit - Maximum number of alerts
   * @param {number} params.offset - Number of alerts to skip
   * @returns {Promise<Object>} Latest encroachment data response
   */
  async getTexasEncroachment(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.confidence_level) queryParams.append('confidence_level', params.confidence_level);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.offset) queryParams.append('offset', params.offset);

      const url = `${this.baseURL}/texas?${queryParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching latest Texas encroachment data:', error);
      throw error;
    }
  }

  /**
   * Get recent encroachment alerts
   * @param {number} days - Number of days to look back
   * @param {number} limit - Maximum number of alerts
   * @returns {Promise<Object>} Recent encroachment data
   */
  async getRecentEncroachment(days = 7, limit = 500) {
    try {
      const url = `${this.baseURL}/recent?days=${days}&limit=${limit}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching recent encroachment data:', error);
      throw error;
    }
  }

  /**
   * Get high confidence encroachment alerts
   * @param {number} days - Number of days to look back
   * @param {number} limit - Maximum number of alerts
   * @returns {Promise<Object>} High confidence encroachment data
   */
  async getHighConfidenceEncroachment(days = 30, limit = 1000) {
    try {
      const url = `${this.baseURL}/high-confidence?days=${days}&limit=${limit}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching high confidence encroachment data:', error);
      throw error;
    }
  }

  /**
   * Get encroachment statistics
   * @returns {Promise<Object>} Encroachment statistics
   */
  async getStatistics() {
    try {
      const url = `${this.baseURL}/statistics`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching encroachment statistics:', error);
      throw error;
    }
  }

  /**
   * Get service health status
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    try {
      const url = `${this.baseURL}/health`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching encroachment health status:', error);
      throw error;
    }
  }

  /**
   * Manually refresh encroachment data
   * @returns {Promise<Object>} Refresh result
   */
  async refreshData() {
    try {
      const url = `${this.baseURL}/refresh`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error refreshing encroachment data:', error);
      throw error;
    }
  }

  /**
   * Export encroachment data as CSV
   * @param {Object} params - Export parameters
   * @returns {Promise<string>} CSV data
   */
  async exportCSV(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.start_date) queryParams.append('start_date', params.start_date);
      if (params.end_date) queryParams.append('end_date', params.end_date);
      if (params.confidence_level) queryParams.append('confidence_level', params.confidence_level);

      const url = `${this.baseURL}/export/csv?${queryParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.csv_data;
    } catch (error) {
      console.error('Error exporting encroachment CSV:', error);
      throw error;
    }
  }

  /**
   * Format date for API calls
   * @param {Date} date - Date to format
   * @returns {string} Formatted date string
   */
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get default date range (last 7 days)
   * @returns {Object} Date range object
   */
  getDefaultDateRange() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    return {
      start_date: this.formatDate(startDate),
      end_date: this.formatDate(endDate)
    };
  }

  /**
   * Get date range for last N days
   * @param {number} days - Number of days
   * @returns {Object} Date range object
   */
  getDateRangeForDays(days) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return {
      start_date: this.formatDate(startDate),
      end_date: this.formatDate(endDate)
    };
  }
}

// Create and export singleton instance
const encroachmentService = new EncroachmentService();
export default encroachmentService;
