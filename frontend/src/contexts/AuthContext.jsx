/**
 * Authentication Context for Texas Forestation Application
 * 
 * Provides authentication state and functions throughout the React app:
 * - Authentication state management
 * - Login/logout functionality
 * - Protected route support
 * - User information access
 * - Token management
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService } from '../services/authService';

// Create the authentication context
const AuthContext = createContext(null);

/**
 * Hook to use authentication context
 * Throws error if used outside AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Authentication Provider Component
 * Wraps the application and provides authentication state
 */
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Initialize authentication state
   */
  const initializeAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔐 Initializing authentication...');

      // Check if user is authenticated from storage
      const authenticated = authService.isAuthenticated();
      const currentUser = authService.getCurrentUser();

      if (authenticated && currentUser) {
        // Validate token with server
        const validation = await authService.validateToken();
        
        if (validation.valid) {
          setIsAuthenticated(true);
          setUser(currentUser);
          console.log('✅ User authenticated from storage:', currentUser.username);
        } else {
          console.log('❌ Stored token is invalid, clearing auth state');
          setIsAuthenticated(false);
          setUser(null);
          authService.clearAuthData();
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
        console.log('ℹ️ No valid authentication found');
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      setError('Failed to initialize authentication');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login function
   */
  const login = useCallback(async (username, password) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔐 Attempting login...');

      const result = await authService.login(username, password);

      if (result.success) {
        // Set auth data in service
        authService.setAuthData(result.data);
        
        // Update context state
        setIsAuthenticated(true);
        setUser(result.data.user);
        
        console.log('✅ Login successful:', result.data.user.username);
        return { success: true };
      } else {
        console.error('❌ Login failed:', result.error);
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = 'Login failed. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout function
   */
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('🚪 Logging out...');

      await authService.logout();
      
      // Update context state
      setIsAuthenticated(false);
      setUser(null);
      setError(null);
      
      console.log('✅ Logout successful');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local state
      setIsAuthenticated(false);
      setUser(null);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh authentication state
   */
  const refreshAuth = useCallback(async () => {
    await initializeAuth();
  }, [initializeAuth]);

  /**
   * Get current authentication token
   */
  const getToken = useCallback(() => {
    return authService.getToken();
  }, []);

  /**
   * Check if token is expired
   */
  const isTokenExpired = useCallback(() => {
    return authService.isTokenExpired();
  }, []);

  /**
   * Get time until token expires
   */
  const getTimeUntilExpiry = useCallback(() => {
    return authService.getTimeUntilExpiry();
  }, []);

  /**
   * Make authenticated API request
   */
  const makeAuthenticatedRequest = useCallback(async (url, options = {}) => {
    try {
      return await authService.makeAuthenticatedRequest(url, options);
    } catch (error) {
      // If authentication fails, update context state
      if (error.message === 'Authentication expired') {
        setIsAuthenticated(false);
        setUser(null);
        setError('Your session has expired. Please login again.');
      }
      throw error;
    }
  }, []);

  /**
   * Clear any authentication errors
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize authentication on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Set up periodic token validation
  useEffect(() => {
    if (!isAuthenticated) return;

    const validationInterval = setInterval(async () => {
      if (authService.isAuthenticated()) {
        const timeLeft = authService.getTimeUntilExpiry();
        
        // If token expires in less than 5 minutes, validate it
        if (timeLeft < 300) {
          console.log('🔐 Token expiring soon, validating...');
          const validation = await authService.validateToken();
          
          if (!validation.valid) {
            console.log('🔐 Token validation failed, logging out');
            setIsAuthenticated(false);
            setUser(null);
            setError('Your session has expired. Please login again.');
          }
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(validationInterval);
  }, [isAuthenticated]);

  // Context value
  const contextValue = {
    // State
    isAuthenticated,
    user,
    isLoading,
    error,
    
    // Functions
    login,
    logout,
    refreshAuth,
    clearError,
    getToken,
    isTokenExpired,
    getTimeUntilExpiry,
    makeAuthenticatedRequest,
    
    // Utility
    isInitialized: !isLoading
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Protected Route Component
 * Renders children only if user is authenticated, otherwise shows login
 */
export const ProtectedRoute = ({ children, fallback = null }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return fallback || (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '1.2rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255,255,255,0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          Loading Texas Forestation...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback;
  }

  return children;
};

/**
 * Authentication Status Component
 * Shows current authentication status (useful for debugging)
 */
export const AuthStatus = () => {
  const { 
    isAuthenticated, 
    user, 
    isLoading, 
    error, 
    getTimeUntilExpiry 
  } = useAuth();

  if (isLoading) {
    return <div>Loading auth status...</div>;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999
    }}>
      <div>Auth: {isAuthenticated ? '✅' : '❌'}</div>
      {user && <div>User: {user.username}</div>}
      {isAuthenticated && (
        <div>Expires: {Math.floor(getTimeUntilExpiry() / 60)}m</div>
      )}
      {error && <div style={{ color: '#ff6b6b' }}>Error: {error}</div>}
    </div>
  );
}; 