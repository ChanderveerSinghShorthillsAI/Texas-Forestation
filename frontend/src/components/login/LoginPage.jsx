/**
 * LoginPage Component for Texas Forestation Application
 * 
 * A modern, responsive login page with:
 * - Background image
 * - Form validation
 * - API integration
 * - Loading states
 * - Error handling
 */

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { FaLeaf, FaComments } from 'react-icons/fa';
import './LoginPage.css';

const LoginPage = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  /**
   * Handle input changes and clear related errors
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear field-specific error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // Clear general login error
    if (loginError) {
      setLoginError('');
    }
  };

  /**
   * Validate form data
   */
  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setLoginError('');

    try {
      const loginResponse = await login(formData.username, formData.password);
      
      if (loginResponse.success) {
        // Success! The AuthContext will handle state updates automatically
        console.log('🎉 Login successful! Redirecting to main app...');
        
        // Call success callback if provided
        if (onLoginSuccess) {
          onLoginSuccess({ user: { username: formData.username } });
        }
      } else {
        setLoginError(loginResponse.error || 'Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Enter key press on form fields
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  /**
   * Navigate to citizen chatbot page
   */
  const handleChatbotClick = () => {
    navigate('/citizen-chatbot');
  };

  return (
    <div className="login-page">
      <div 
        className="login-background"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL}/login/loginBgImage.png)`
        }}
      >
        <div className="login-overlay">
          <div className="login-container">
            <div className="login-header">
              <h1>Texas Forestation</h1>
              <p>Spatial Analysis & Plantation Planning System</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="username" className="form-label">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  className={`form-input ${errors.username ? 'error' : ''}`}
                  placeholder="Enter your username"
                  disabled={isLoading}
                  autoComplete="username"
                />
                {errors.username && (
                  <span className="error-message">{errors.username}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                {errors.password && (
                  <span className="error-message">{errors.password}</span>
                )}
              </div>

              {loginError && (
                <div className="login-error">
                  <span className="error-icon">⚠️</span>
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className={`login-button ${isLoading ? 'loading' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="button-content">
                    <div className="loading-spinner"></div>
                    Signing In...
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="login-footer">
              <p>
                This system provides advanced spatial analysis and AI-powered 
                plantation planning for Texas forestation initiatives.
              </p>
            </div>
          </div>

          {/* Citizen Chatbot Button - Top Right */}
          <button
            type="button"
            className="chatbot-button-floating"
            onClick={handleChatbotClick}
            title="Chat with Texas Forest Guide"
          >
            <FaLeaf />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 