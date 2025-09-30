/**
 * Full Texas Wildfire Prediction Component
 * Provides complete wildfire risk assessment for all of Texas with progress tracking
 */
import React, { useState, useEffect, useCallback } from 'react';
import wildfireService from '../../services/wildfireService';
import './FullTexasWildfirePrediction.css';

const FullTexasWildfirePrediction = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(null);
  const [wildfireData, setWildfireData] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateStatus, setUpdateStatus] = useState(null);

  // Progress polling state
  const [isPollingProgress, setIsPollingProgress] = useState(false);
  const [progressInterval, setProgressInterval] = useState(null);

  /**
   * Start progress polling
   */
  const startProgressPolling = useCallback(() => {
    if (progressInterval) {
      clearInterval(progressInterval);
    }

    const interval = setInterval(async () => {
      try {
        const progress = await wildfireService.getUpdateProgress();
        setLoadingProgress(progress);
        
        // Check if we've reached full coverage
        if (progress.current_coverage.coverage_percentage >= 100) {
          setIsPollingProgress(false);
          clearInterval(interval);
          setProgressInterval(null);
          
          // Refresh data after completion
          await loadWildfireData();
        }
      } catch (error) {
        console.error('Error polling progress:', error);
      }
    }, 2000); // Poll every 2 seconds

    setProgressInterval(interval);
    setIsPollingProgress(true);
  }, [progressInterval]);

  /**
   * Stop progress polling
   */
  const stopProgressPolling = useCallback(() => {
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }
    setIsPollingProgress(false);
  }, [progressInterval]);

  /**
   * Load current wildfire data
   */
  const loadWildfireData = useCallback(async () => {
    try {
      setError(null);
      
      // Get current progress first
      const progress = await wildfireService.getUpdateProgress();
      setLoadingProgress(progress);
      
      // Get forecast data using grid system
      const forecastData = await wildfireService.getTexasForecast(7);
      setWildfireData(forecastData);
      setLastUpdate(new Date());
      
    } catch (err) {
      console.error('Error loading wildfire data:', err);
      setError(err.message);
    }
  }, []);

  /**
   * Trigger full Texas update
   */
  const triggerFullUpdate = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setUpdateStatus(null);
      
      // Start the full Texas update
      const result = await wildfireService.triggerFullTexasUpdate();
      setUpdateStatus(result);
      
      // Start polling for progress
      startProgressPolling();
      
    } catch (err) {
      console.error('Error starting full update:', err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  /**
   * Format coverage percentage
   */
  const formatCoveragePercentage = (percentage) => {
    return Math.min(100, Math.max(0, percentage || 0)).toFixed(1);
  };

  /**
   * Get progress bar color based on coverage
   */
  const getProgressColor = (percentage) => {
    if (percentage < 25) return '#ff6b6b';
    if (percentage < 50) return '#ffa726';
    if (percentage < 75) return '#42a5f5';
    if (percentage < 100) return '#26a69a';
    return '#4caf50';
  };

  /**
   * Format number with commas
   */
  const formatNumber = (num) => {
    return num?.toLocaleString() || '0';
  };

  // Load initial data on component mount
  useEffect(() => {
    loadWildfireData();
    
    // Cleanup on unmount
    return () => {
      stopProgressPolling();
    };
  }, [loadWildfireData, stopProgressPolling]);

  // Update loading state based on progress
  useEffect(() => {
    if (isPollingProgress && loadingProgress?.current_coverage?.coverage_percentage >= 100) {
      setIsLoading(false);
    }
  }, [isPollingProgress, loadingProgress]);

  return (
    <div className="full-texas-wildfire-prediction">
      {/* Header */}
      <div className="prediction-header">
        <h1>🔥 Texas Wildfire Risk Assessment</h1>
        <p>Complete wildfire prediction coverage for all of Texas</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      {/* Backend Status Notice */}
      {loadingProgress?.system_status === 'fallback_mode' && (
        <div className="info-banner">
          <span className="info-icon">ℹ️</span>
          <div className="info-content">
            <strong>Running in Fallback Mode</strong>
            <p>For full functionality, please restart the backend server. Currently using existing endpoints with full coverage settings.</p>
          </div>
        </div>
      )}

      {/* Update Status */}
      {updateStatus && (
        <div className="update-status-banner">
          <span className="success-icon">🚀</span>
          <div className="status-content">
            <h3>Full Texas Update Started!</h3>
            <p>{updateStatus.message}</p>
            <div className="status-details">
              <span>Target Coverage: {updateStatus.coverage_target}</span>
              <span>Estimated Time: {updateStatus.estimated_time_minutes} minutes</span>
              <span>Processing Cells: {formatNumber(updateStatus.estimated_cells)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Current Coverage Status */}
      <div className="coverage-status-card">
        <h2>Current Texas Coverage</h2>
        
        {loadingProgress ? (
          <div className="coverage-info">
            <div className="coverage-stats">
              <div className="stat-item">
                <span className="stat-label">Grid Cells Processed:</span>
                <span className="stat-value">
                  {formatNumber(loadingProgress.current_coverage.cached_predictions)} / {formatNumber(loadingProgress.current_coverage.total_grid_cells)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Coverage Percentage:</span>
                <span className="stat-value">
                  {formatCoveragePercentage(loadingProgress.current_coverage.coverage_percentage)}%
                </span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="progress-container">
              <div className="progress-bar-wrapper">
                <div 
                  className="progress-bar"
                  style={{ 
                    width: `${formatCoveragePercentage(loadingProgress.current_coverage.coverage_percentage)}%`,
                    backgroundColor: getProgressColor(loadingProgress.current_coverage.coverage_percentage)
                  }}
                >
                  <span className="progress-text">
                    {formatCoveragePercentage(loadingProgress.current_coverage.coverage_percentage)}%
                  </span>
                </div>
              </div>
            </div>
            
            {/* Status Indicators */}
            <div className="status-indicators">
              {isPollingProgress && (
                <div className="status-item loading">
                  <div className="loading-spinner"></div>
                  <span>Processing Texas grid data...</span>
                </div>
              )}
              
              {loadingProgress.current_coverage.coverage_percentage >= 100 && (
                <div className="status-item complete">
                  <span className="complete-icon">✅</span>
                  <span>Complete Texas coverage achieved!</span>
                </div>
              )}
              
              {loadingProgress.current_coverage.last_update && (
                <div className="status-item">
                  <span className="update-icon">🕒</span>
                  <span>Last updated: {new Date(loadingProgress.current_coverage.last_update).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="no-progress-data">
            <p>Loading coverage information...</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button 
          onClick={triggerFullUpdate}
          disabled={isLoading || isPollingProgress}
          className="btn btn-primary btn-full-update"
        >
          {isLoading || isPollingProgress ? (
            <>
              <div className="btn-spinner"></div>
              Processing Full Texas...
            </>
          ) : (
            <>
              🌟 Start Full Texas Update
            </>
          )}
        </button>
        
        <button 
          onClick={loadWildfireData}
          disabled={isLoading}
          className="btn btn-secondary"
        >
          🔄 Refresh Data
        </button>
        
        {isPollingProgress && (
          <button 
            onClick={stopProgressPolling}
            className="btn btn-warning"
          >
            ⏹️ Stop Monitoring
          </button>
        )}
      </div>

      {/* Wildfire Data Summary */}
      {wildfireData && wildfireData.success && (
        <div className="wildfire-summary">
          <h2>Texas Wildfire Risk Summary</h2>
          
          <div className="summary-grid">
            <div className="summary-card">
              <h3>Coverage Statistics</h3>
              <div className="stat-value">{formatNumber(wildfireData.statistics?.locations_monitored || 0)}</div>
              <div className="stat-label">Grid Cells Monitored</div>
              <div className="stat-detail">
                Across all {wildfireData.metadata?.total_grid_cells ? formatNumber(wildfireData.metadata.total_grid_cells) : '26,824'} Texas grid cells
              </div>
            </div>

            <div className="summary-card danger">
              <h3>Maximum Risk</h3>
              <div className="stat-value">{wildfireData.statistics?.max_risk || 0}%</div>
              <div className="stat-label">Highest Risk Found</div>
              <div className="stat-detail">
                Average: {wildfireData.statistics?.avg_risk || 0}%
              </div>
            </div>

            <div className="summary-card warning">
              <h3>High-Risk Areas</h3>
              <div className="stat-value">{wildfireData.statistics?.high_risk_locations || 0}</div>
              <div className="stat-label">Areas Requiring Attention</div>
              <div className="stat-detail">
                Risk ≥ 60%
              </div>
            </div>

            <div className="summary-card info">
              <h3>Data Source</h3>
              <div className="stat-value">{wildfireData.metadata?.grid_based ? 'Grid' : 'Legacy'}</div>
              <div className="stat-label">System Type</div>
              <div className="stat-detail">
                {wildfireData.metadata?.data_source || 'Texas Grid Fire System'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* High-Risk Locations Table */}
      {wildfireData?.high_risk_locations && wildfireData.high_risk_locations.length > 0 && (
        <div className="high-risk-locations">
          <h2>Current High-Risk Areas</h2>
          <div className="locations-table-container">
            <table className="locations-table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Max Risk</th>
                  <th>Avg Risk</th>
                  <th>Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {wildfireData.high_risk_locations.slice(0, 15).map((location, index) => (
                  <tr key={index}>
                    <td>{location.name}</td>
                    <td>
                      <span className={`risk-score risk-${Math.floor(location.max_risk / 20)}`}>
                        {location.max_risk}%
                      </span>
                    </td>
                    <td>{location.avg_risk}%</td>
                    <td>
                      <span className={`risk-level risk-${Math.floor(location.max_risk / 20)}`}>
                        {location.max_risk >= 80 ? 'Extreme' :
                         location.max_risk >= 60 ? 'Very High' :
                         location.max_risk >= 40 ? 'High' :
                         location.max_risk >= 20 ? 'Moderate' : 'Low'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer Information */}
      <div className="prediction-footer">
        <div className="footer-info">
          <h3>About Full Texas Coverage</h3>
          <p>
            This system processes all 26,824+ grid cells covering every part of Texas, providing 
            comprehensive wildfire risk assessment using advanced meteorological data, Fire Weather Index (FWI), 
            and machine learning algorithms.
          </p>
          <div className="footer-stats">
            <div className="footer-stat">
              <strong>Total Area:</strong> 695,662 km² (Texas)
            </div>
            <div className="footer-stat">
              <strong>Grid Resolution:</strong> ~5km × 5km cells
            </div>
            <div className="footer-stat">
              <strong>Update Frequency:</strong> Every 6 hours
            </div>
            <div className="footer-stat">
              <strong>Data Sources:</strong> Open-Meteo, NOAA, NASA
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullTexasWildfirePrediction;
