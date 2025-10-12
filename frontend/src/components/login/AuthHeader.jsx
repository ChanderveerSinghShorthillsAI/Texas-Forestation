/**
 * Authentication Header Component for Texas Forestation Application
 * 
 * Displays user information and authentication controls:
 * - User welcome message
 * - Session time remaining
 * - Logout button
 * - Responsive design
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AuthHeader.css';
import { FaSpinner } from 'react-icons/fa';

const AuthHeader = () => {
  const { user, logout, getTimeUntilExpiry, isAuthenticated } = useAuth();
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Update time remaining periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateTimer = () => {
      setTimeLeft(getTimeUntilExpiry());
    };

    // Update immediately
    updateTimer();

    // Update every 30 seconds
    const interval = setInterval(updateTimer, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, getTimeUntilExpiry]);

  /**
   * Handle logout with loading state
   */
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  /**
   * Format time remaining in readable format
   */
  const formatTimeRemaining = (seconds) => {
    if (seconds <= 0) return 'Expired';
    
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  /**
   * Get session status color based on time remaining
   */
  const getSessionStatusColor = () => {
    if (timeLeft <= 300) return '#ff6b6b'; // Red for < 5 minutes
    if (timeLeft <= 900) return '#ffa726'; // Orange for < 15 minutes
    return '#4caf50'; // Green for healthy session
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <header className="auth-header">
      <div className="auth-header-content">
        <div className="user-info">
          <div className="welcome-section">
            <span className="welcome-text">Welcome back,</span>
            <span className="username">{user.username}</span>
          </div>
          
          <div className="session-info">
            <div className="session-status">
              <span 
                className="session-indicator"
                style={{ color: getSessionStatusColor() }}
              >
                ●
              </span>
              <span className="session-text">
                Session: {formatTimeRemaining(timeLeft)}
              </span>
            </div>
          </div>
        </div>

        <div className="auth-controls">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`logout-button ${isLoggingOut ? 'loading' : ''}`}
            title="Sign out of Texas Forestation System"
          >
            {isLoggingOut ? (
              <div className="loading-container">
               <FaSpinner className="loading-spinner-icon" />
               <p>Signing Out...</p>
              </div>
            ) : (
              <>
                <span className="logout-icon">🚪</span>
                Sign Out
              </>
            )}
          </button>
        </div>
      </div>

      {/* Warning for expiring session */}
      {timeLeft <= 300 && timeLeft > 0 && (
        <div className="session-warning">
          <span className="warning-icon">⚠️</span>
          Your session will expire in {formatTimeRemaining(timeLeft)}. 
          Please save your work.
        </div>
      )}
    </header>
  );
};

export default AuthHeader; 