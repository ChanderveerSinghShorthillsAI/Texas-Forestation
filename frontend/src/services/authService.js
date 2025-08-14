/**
 * Authentication Service for Texas Forestation Frontend
 * 
 * Handles all authentication-related operations including:
 * - Login/logout
 * - Token management
 * - API communication
 * - Local storage management
 * - Authentication state
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const AUTH_ENDPOINTS = {
  login: `${API_BASE_URL}/auth/login`,
  logout: `${API_BASE_URL}/auth/logout`,
  validateToken: `${API_BASE_URL}/auth/validate-token`,
  userInfo: `${API_BASE_URL}/auth/me`,
  status: `${API_BASE_URL}/auth/status`,
  check: `${API_BASE_URL}/auth/check`
};

const STORAGE_KEYS = {
  token: 'texas_forestation_token',
  user: 'texas_forestation_user',
  expiresAt: 'texas_forestation_expires_at'
};

class AuthService {
  constructor() {
    this.token = null;
    this.user = null;
    this.expiresAt = null;
    this.isInitialized = false;
    
    // Initialize from localStorage
    this.initializeFromStorage();
  }

  /**
   * Initialize authentication state from localStorage
   */
  initializeFromStorage() {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.token);
      const user = localStorage.getItem(STORAGE_KEYS.user);
      const expiresAt = localStorage.getItem(STORAGE_KEYS.expiresAt);

      if (token && user && expiresAt) {
        this.token = token;
        this.user = JSON.parse(user);
        this.expiresAt = new Date(expiresAt);

        // Check if token is expired
        if (this.isTokenExpired()) {
          console.log('🔐 Token expired, clearing auth data');
          this.clearAuthData();
        } else {
          console.log('🔐 Auth data loaded from storage');
        }
      }
    } catch (error) {
      console.error('Error initializing auth from storage:', error);
      this.clearAuthData();
    }
    
    this.isInitialized = true;
  }

  /**
   * Login user with credentials
   */
  async login(username, password) {
    try {
      console.log('🔐 Attempting login for user:', username);

      const response = await fetch(AUTH_ENDPOINTS.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Login successful');
        return {
          success: true,
          data: data
        };
      } else {
        console.error('❌ Login failed:', data.detail);
        return {
          success: false,
          error: data.detail || 'Login failed'
        };
      }
    } catch (error) {
      console.error('Network error during login:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection and try again.'
      };
    }
  }

  /**
   * Logout current user
   */
  async logout() {
    try {
      console.log('🚪 Logging out user');

      // Call logout endpoint if we have a token
      if (this.token) {
        try {
          await fetch(AUTH_ENDPOINTS.logout, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json',
            },
          });
        } catch (error) {
          console.warn('Logout API call failed, proceeding with local logout:', error);
        }
      }

      // Clear local auth data
      this.clearAuthData();
      
      console.log('✅ Logout complete');
      return { success: true };
    } catch (error) {
      console.error('Error during logout:', error);
      // Even if logout fails, clear local data
      this.clearAuthData();
      return { success: false, error: error.message };
    }
  }

  /**
   * Set authentication data after successful login
   */
  setAuthData(authData) {
    try {
      this.token = authData.access_token;
      this.user = authData.user;
      
      // Calculate expiration time
      const expiresInMs = authData.expires_in * 1000;
      this.expiresAt = new Date(Date.now() + expiresInMs);

      // Store in localStorage
      localStorage.setItem(STORAGE_KEYS.token, this.token);
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(this.user));
      localStorage.setItem(STORAGE_KEYS.expiresAt, this.expiresAt.toISOString());

      console.log('🔐 Auth data stored successfully');
    } catch (error) {
      console.error('Error storing auth data:', error);
    }
  }

  /**
   * Clear all authentication data
   */
  clearAuthData() {
    this.token = null;
    this.user = null;
    this.expiresAt = null;

    // Clear localStorage
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.expiresAt);

    console.log('🔐 Auth data cleared');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!(this.token && this.user && !this.isTokenExpired());
  }

  /**
   * Check if token is expired
   */
  isTokenExpired() {
    if (!this.expiresAt) return true;
    return new Date() >= this.expiresAt;
  }

  /**
   * Get current user information
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Get current auth token
   */
  getToken() {
    return this.token;
  }

  /**
   * Get time until token expires (in seconds)
   */
  getTimeUntilExpiry() {
    if (!this.expiresAt) return 0;
    const now = new Date();
    const timeLeft = Math.max(0, Math.floor((this.expiresAt - now) / 1000));
    return timeLeft;
  }

  /**
   * Validate current token with server
   */
  async validateToken() {
    if (!this.token) {
      return { valid: false, error: 'No token available' };
    }

    try {
      const response = await fetch(AUTH_ENDPOINTS.validateToken, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.is_valid) {
        console.log('✅ Token validation successful');
        return { valid: true, data: data };
      } else {
        console.log('❌ Token validation failed');
        this.clearAuthData();
        return { valid: false, error: 'Token invalid' };
      }
    } catch (error) {
      console.error('Error validating token:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Make authenticated API request
   */
  async makeAuthenticatedRequest(url, options = {}) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // If unauthorized, clear auth data
      if (response.status === 401) {
        console.log('🔐 Received 401, clearing auth data');
        this.clearAuthData();
        throw new Error('Authentication expired');
      }

      return response;
    } catch (error) {
      console.error('Authenticated request failed:', error);
      throw error;
    }
  }

  /**
   * Check authentication status with server
   */
  async checkAuthStatus() {
    try {
      const response = await fetch(AUTH_ENDPOINTS.check, {
        method: 'GET',
        headers: this.token ? {
          'Authorization': `Bearer ${this.token}`,
        } : {},
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking auth status:', error);
      return { is_authenticated: false, error: error.message };
    }
  }

  /**
   * Get authentication service status
   */
  async getServiceStatus() {
    try {
      const response = await fetch(AUTH_ENDPOINTS.status);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting service status:', error);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Set up automatic token refresh (if needed in the future)
   */
  setupTokenRefresh() {
    // For now, we'll just validate periodically
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      if (this.isAuthenticated()) {
        const timeLeft = this.getTimeUntilExpiry();
        
        // If less than 5 minutes left, validate token
        if (timeLeft < 300) {
          const validation = await this.validateToken();
          if (!validation.valid) {
            console.log('🔐 Token no longer valid, clearing auth data');
            this.clearAuthData();
          }
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Cleanup when service is destroyed
   */
  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

// Create and export singleton instance
const authService = new AuthService();

// Set up automatic token refresh
authService.setupTokenRefresh();

export { authService }; 