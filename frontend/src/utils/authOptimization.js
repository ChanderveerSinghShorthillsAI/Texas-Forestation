/**
 * Authentication Optimization Utilities
 * Prevents authentication loops and optimizes the login flow
 */

/**
 * Debounce function to prevent rapid authentication attempts
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Check if authentication is in a loop
 */
export const isAuthLoop = () => {
  const authAttempts = JSON.parse(localStorage.getItem('authAttempts') || '[]');
  const now = Date.now();
  const recentAttempts = authAttempts.filter(attempt => now - attempt < 60000); // Last minute
  
  return recentAttempts.length > 3; // More than 3 attempts in a minute
};

/**
 * Record authentication attempt
 */
export const recordAuthAttempt = () => {
  const authAttempts = JSON.parse(localStorage.getItem('authAttempts') || '[]');
  authAttempts.push(Date.now());
  
  // Keep only last 10 attempts
  const recentAttempts = authAttempts.slice(-10);
  localStorage.setItem('authAttempts', JSON.stringify(recentAttempts));
};

/**
 * Clear authentication attempts history
 */
export const clearAuthAttempts = () => {
  localStorage.removeItem('authAttempts');
};

/**
 * Optimize token validation to prevent unnecessary API calls
 */
export const shouldValidateToken = () => {
  const lastValidation = localStorage.getItem('lastTokenValidation');
  const now = Date.now();
  
  // Only validate token if last validation was more than 5 minutes ago
  return !lastValidation || (now - parseInt(lastValidation)) > 300000;
};

/**
 * Record token validation
 */
export const recordTokenValidation = () => {
  localStorage.setItem('lastTokenValidation', Date.now().toString());
};

/**
 * Enhanced authentication state management
 */
export class AuthStateManager {
  constructor() {
    this.state = {
      isValidating: false,
      lastValidation: 0,
      validationInProgress: false
    };
  }

  async optimizedValidation(validateFunction) {
    // Prevent concurrent validations
    if (this.state.validationInProgress) {
      console.log('🔐 Token validation already in progress, skipping...');
      return { valid: true }; // Assume valid to prevent loops
    }

    // Check if validation is needed
    if (!shouldValidateToken()) {
      console.log('🔐 Token validation not needed (recent validation found)');
      return { valid: true };
    }

    // Prevent auth loops
    if (isAuthLoop()) {
      console.warn('🔐 Authentication loop detected, cooling down...');
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second cooldown
      clearAuthAttempts();
      return { valid: false };
    }

    this.state.validationInProgress = true;
    recordAuthAttempt();

    try {
      const result = await validateFunction();
      recordTokenValidation();
      return result;
    } catch (error) {
      console.error('🔐 Token validation error:', error);
      return { valid: false };
    } finally {
      this.state.validationInProgress = false;
    }
  }
}
