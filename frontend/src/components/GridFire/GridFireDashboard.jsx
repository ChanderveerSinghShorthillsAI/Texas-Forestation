/**
 * Grid Fire Dashboard Component
 * Displays Texas-wide fire risk data with interactive controls
 */
import React, { useState, useEffect, useCallback } from 'react';
import gridFireService from '../../services/gridFireService';
import './GridFireDashboard.css';

const GridFireDashboard = () => {
  const [statistics, setStatistics] = useState(null);
  const [highRiskAreas, setHighRiskAreas] = useState([]);
  const [regionalStats, setRegionalStats] = useState(null);
  const [cacheStatus, setCacheStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Configuration state
  const [riskThreshold, setRiskThreshold] = useState(60);
  const [showRegionalView, setShowRegionalView] = useState(false);

  /**
   * Load dashboard data
   */
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all data in parallel
      const [stats, highRisk, regional, cache] = await Promise.all([
        gridFireService.getStatistics(),
        gridFireService.getHighRiskAreas({ riskThreshold, limit: 20 }),
        gridFireService.getRiskByRegion(),
        gridFireService.getCacheStatus()
      ]);

      setStatistics(stats);
      setHighRiskAreas(highRisk.high_risk_areas || []);
      setRegionalStats(regional);
      setCacheStatus(cache);
      setLastUpdate(new Date());

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [riskThreshold]);

  /**
   * Handle quick grid update
   */
  const handleQuickUpdate = async () => {
    try {
      setUpdating(true);
      setError(null);

      const result = await gridFireService.quickUpdate();
      console.log('Quick update result:', result);

      // Reload dashboard data after update
      await loadDashboardData();

    } catch (err) {
      console.error('Error in quick update:', err);
      setError(`Update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  /**
   * Handle full grid update
   */
  const handleFullUpdate = async () => {
    try {
      setUpdating(true);
      setError(null);

      const result = await gridFireService.updateGrid({
        useStrategicPoints: true,
        densityFactor: 0.2,
        forecastDays: 7
      });
      console.log('Full update result:', result);

      // Reload dashboard data after update
      await loadDashboardData();

    } catch (err) {
      console.error('Error in full update:', err);
      setError(`Update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  /**
   * Format number with commas
   */
  const formatNumber = (num) => {
    return num?.toLocaleString() || '0';
  };

  /**
   * Format percentage
   */
  const formatPercentage = (num) => {
    return `${(num || 0).toFixed(1)}%`;
  };

  /**
   * Get risk category color
   */
  const getRiskCategoryColor = (category) => {
    const colors = {
      'Low': '#00ff00',
      'Moderate': '#ffff00',
      'High': '#ff8000',
      'Very High': '#ff0000',
      'Extreme': '#8b0000'
    };
    return colors[category] || '#808080';
  };

  // Load data on component mount and when threshold changes
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!updating) {
        loadDashboardData();
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [loadDashboardData, updating]);

  if (loading && !statistics) {
    return (
      <div className="grid-fire-dashboard loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading Texas Fire Risk Grid...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid-fire-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h2>Texas Fire Risk Grid System</h2>
        <div className="header-controls">
          <button 
            onClick={handleQuickUpdate}
            disabled={updating}
            className="btn btn-primary"
          >
            {updating ? 'Updating...' : 'Quick Update'}
          </button>
          <button 
            onClick={handleFullUpdate}
            disabled={updating}
            className="btn btn-secondary"
          >
            {updating ? 'Updating...' : 'Full Update'}
          </button>
          <button 
            onClick={loadDashboardData}
            disabled={loading}
            className="btn btn-refresh"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-item">
          <span className="status-label">Last Update:</span>
          <span className="status-value">
            {lastUpdate ? lastUpdate.toLocaleString() : 'Never'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Cache Status:</span>
          <span className={`status-value ${cacheStatus?.cache_freshness?.is_fresh ? 'fresh' : 'stale'}`}>
            {cacheStatus?.cache_freshness?.is_fresh ? 'Fresh' : 'Stale'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Coverage:</span>
          <span className="status-value">
            {formatPercentage(statistics?.coverage_percentage)}
          </span>
        </div>
      </div>

      {/* Main Statistics Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Grid Coverage</h3>
          <div className="stat-value">{formatNumber(statistics?.cached_predictions)}</div>
          <div className="stat-label">Active Cells</div>
          <div className="stat-detail">
            of {formatNumber(statistics?.total_grid_cells)} total
          </div>
        </div>

        <div className="stat-card">
          <h3>Risk Overview</h3>
          <div className="stat-value">{formatPercentage(statistics?.risk_statistics?.max_risk)}</div>
          <div className="stat-label">Max Risk</div>
          <div className="stat-detail">
            Avg: {formatPercentage(statistics?.risk_statistics?.avg_risk)}
          </div>
        </div>

        <div className="stat-card danger">
          <h3>High Risk Areas</h3>
          <div className="stat-value">{formatNumber(statistics?.high_risk_areas)}</div>
          <div className="stat-label">Areas ≥60% Risk</div>
          <div className="stat-detail">
            Threshold: {riskThreshold}%
          </div>
        </div>

        <div className="stat-card">
          <h3>Risk Distribution</h3>
          <div className="risk-distribution">
            {statistics?.risk_category_distribution && 
              Object.entries(statistics.risk_category_distribution).map(([category, count]) => (
                <div key={category} className="risk-category-item">
                  <span 
                    className="risk-color-dot" 
                    style={{ backgroundColor: getRiskCategoryColor(category) }}
                  ></span>
                  <span className="risk-category-label">{category}</span>
                  <span className="risk-category-count">{count}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="controls-panel">
        <div className="control-group">
          <label htmlFor="risk-threshold">Risk Threshold:</label>
          <input
            id="risk-threshold"
            type="range"
            min="20"
            max="90"
            step="10"
            value={riskThreshold}
            onChange={(e) => setRiskThreshold(parseInt(e.target.value))}
            className="risk-threshold-slider"
          />
          <span className="threshold-value">{riskThreshold}%</span>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={showRegionalView}
              onChange={(e) => setShowRegionalView(e.target.checked)}
            />
            Show Regional View
          </label>
        </div>
      </div>

      {/* High Risk Areas Table */}
      <div className="high-risk-section">
        <h3>Current High-Risk Areas (≥{riskThreshold}%)</h3>
        {highRiskAreas.length > 0 ? (
          <div className="high-risk-table">
            <table>
              <thead>
                <tr>
                  <th>Grid #</th>
                  <th>Location</th>
                  <th>Risk Score</th>
                  <th>Category</th>
                  <th>24h Max</th>
                  <th>Temperature</th>
                  <th>Wind</th>
                </tr>
              </thead>
              <tbody>
                {highRiskAreas.slice(0, 10).map((area) => (
                  <tr key={area.grid_index}>
                    <td>{area.grid_index}</td>
                    <td>
                      {area.latitude.toFixed(3)}, {area.longitude.toFixed(3)}
                    </td>
                    <td>
                      <span 
                        className="risk-score"
                        style={{ color: getRiskCategoryColor(area.risk_category) }}
                      >
                        {area.fire_risk_score}%
                      </span>
                    </td>
                    <td>
                      <span 
                        className="risk-category"
                        style={{ color: getRiskCategoryColor(area.risk_category) }}
                      >
                        {area.risk_category}
                      </span>
                    </td>
                    <td>{area.max_risk_24h}%</td>
                    <td>{area.weather?.temperature || 'N/A'}°C</td>
                    <td>{area.weather?.wind_speed || 'N/A'} km/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-data">
            No high-risk areas found at current threshold.
          </div>
        )}
      </div>

      {/* Regional Statistics */}
      {showRegionalView && regionalStats && (
        <div className="regional-section">
          <h3>Risk by Texas Regions</h3>
          <div className="regional-grid">
            {Object.entries(regionalStats.regional_statistics).map(([region, stats]) => (
              <div key={region} className="regional-card">
                <h4>{region}</h4>
                <div className="regional-stats">
                  <div className="regional-stat">
                    <span className="label">Points:</span>
                    <span className="value">{stats.total_points}</span>
                  </div>
                  <div className="regional-stat">
                    <span className="label">Max Risk:</span>
                    <span className="value">{stats.max_risk}%</span>
                  </div>
                  <div className="regional-stat">
                    <span className="label">Avg Risk:</span>
                    <span className="value">{stats.avg_risk}%</span>
                  </div>
                  <div className="regional-stat">
                    <span className="label">High Risk:</span>
                    <span className="value">{stats.high_risk_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="dashboard-footer">
        <p>
          Texas Fire Risk Grid System provides comprehensive wildfire risk assessment 
          across {formatNumber(statistics?.total_grid_cells)} grid cells covering the entire state.
        </p>
        <p>
          Data updates automatically every 6 hours. Last cache update: {' '}
          {cacheStatus?.cache_freshness?.last_update ? 
            new Date(cacheStatus.cache_freshness.last_update).toLocaleString() : 
            'Unknown'
          }
        </p>
      </div>
    </div>
  );
};

export default GridFireDashboard;
