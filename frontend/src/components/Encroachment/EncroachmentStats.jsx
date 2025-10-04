import React from 'react';
import './EncroachmentStats.css';

const EncroachmentStats = ({ statistics, encroachmentData, healthStatus }) => {
  if (!statistics) {
    return (
      <div className="stats-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading statistics...</p>
        </div>
      </div>
    );
  }

  /**
   * Calculate percentage for confidence levels
   */
  const getConfidencePercentage = (count) => {
    if (statistics.total_alerts === 0) return 0;
    return ((count / statistics.total_alerts) * 100).toFixed(1);
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  /**
   * Get confidence level color
   */
  const getConfidenceColor = (level) => {
    const colors = {
      high: '#dc3545',
      nominal: '#ffc107',
      low: '#28a745'
    };
    return colors[level] || '#6c757d';
  };

  /**
   * Get confidence level icon
   */
  const getConfidenceIcon = (level) => {
    const icons = {
      high: '🔴',
      nominal: '🟡',
      low: '🟢'
    };
    return icons[level] || '⚪';
  };

  /**
   * Get health status color
   */
  const getHealthColor = (status) => {
    const colors = {
      healthy: '#28a745',
      degraded: '#ffc107',
      unhealthy: '#dc3545'
    };
    return colors[status] || '#6c757d';
  };

  /**
   * Get health status icon
   */
  const getHealthIcon = (status) => {
    const icons = {
      healthy: '🟢',
      degraded: '🟡',
      unhealthy: '🔴'
    };
    return icons[status] || '⚪';
  };

  return (
    <div className="stats-container">
      {/* Header */}
      <div className="stats-header">
        <h3>📊 Encroachment Statistics</h3>
        <p>Comprehensive overview of encroachment data and system health</p>
      </div>

      {/* Main Statistics Grid */}
      <div className="stats-grid">
        {/* Total Alerts Card */}
        <div className="stat-card primary">
          <div className="stat-icon">📍</div>
          <div className="stat-content">
            <div className="stat-value">{statistics.total_alerts.toLocaleString()}</div>
            <div className="stat-label">Total Alerts</div>
            <div className="stat-description">All encroachment alerts in database</div>
          </div>
        </div>

        {/* Recent Alerts Card */}
        <div className="stat-card secondary">
          <div className="stat-icon">🕒</div>
          <div className="stat-content">
            <div className="stat-value">{statistics.recent_alerts_count.toLocaleString()}</div>
            <div className="stat-label">Recent Alerts</div>
            <div className="stat-description">Last 7 days</div>
          </div>
        </div>

        {/* High Confidence Card */}
        <div className="stat-card warning">
          <div className="stat-icon">🔴</div>
          <div className="stat-content">
            <div className="stat-value">{statistics.high_confidence_count.toLocaleString()}</div>
            <div className="stat-label">High Confidence</div>
            <div className="stat-description">Most reliable alerts</div>
          </div>
        </div>

        {/* Last Alert Card */}
        <div className="stat-card info">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <div className="stat-value">{formatDate(statistics.last_alert_date)}</div>
            <div className="stat-label">Last Alert</div>
            <div className="stat-description">Most recent detection</div>
          </div>
        </div>
      </div>

      {/* Confidence Breakdown */}
      <div className="stats-section">
        <h4>Confidence Level Breakdown</h4>
        <div className="confidence-breakdown">
          {Object.entries(statistics.alerts_by_confidence).map(([level, count]) => (
            <div key={level} className="confidence-item">
              <div className="confidence-header">
                <span className="confidence-icon">{getConfidenceIcon(level)}</span>
                <span className="confidence-label">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                <span className="confidence-count">{count.toLocaleString()}</span>
              </div>
              <div className="confidence-bar">
                <div 
                  className="confidence-fill"
                  style={{ 
                    width: `${getConfidencePercentage(count)}%`,
                    backgroundColor: getConfidenceColor(level)
                  }}
                ></div>
              </div>
              <div className="confidence-percentage">
                {getConfidencePercentage(count)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Chart */}
      {statistics.alerts_by_date && Object.keys(statistics.alerts_by_date).length > 0 && (
        <div className="stats-section">
          <h4>Recent Activity (Last 30 Days)</h4>
          <div className="activity-chart">
            {Object.entries(statistics.alerts_by_date)
              .sort(([a], [b]) => new Date(a) - new Date(b))
              .slice(-14) // Show last 14 days
              .map(([date, count]) => {
                const maxCount = Math.max(...Object.values(statistics.alerts_by_date));
                const height = (count / maxCount) * 100;
                
                return (
                  <div key={date} className="activity-bar">
                    <div 
                      className="bar-fill"
                      style={{ height: `${height}%` }}
                      title={`${date}: ${count} alerts`}
                    ></div>
                    <div className="bar-label">
                      {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="bar-count">{count}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* System Health */}
      {healthStatus && (
        <div className="stats-section">
          <h4>System Health</h4>
          <div className="health-grid">
            <div className="health-item">
              <div className="health-label">Overall Status</div>
              <div className="health-value">
                <span 
                  className="health-indicator"
                  style={{ color: getHealthColor(healthStatus.status) }}
                >
                  {getHealthIcon(healthStatus.status)} {healthStatus.status.toUpperCase()}
                </span>
              </div>
            </div>
            
            <div className="health-item">
              <div className="health-label">API Connection</div>
              <div className="health-value">
                <span className={`connection-status ${healthStatus.api_accessible ? 'connected' : 'disconnected'}`}>
                  {healthStatus.api_accessible ? '🟢 Connected' : '🔴 Disconnected'}
                </span>
              </div>
            </div>
            
            <div className="health-item">
              <div className="health-label">Cached Alerts</div>
              <div className="health-value">
                {healthStatus.total_cached_alerts.toLocaleString()}
              </div>
            </div>
            
            <div className="health-item">
              <div className="health-label">Cache Age</div>
              <div className="health-value">
                {healthStatus.cache_age_hours ? 
                  `${healthStatus.cache_age_hours.toFixed(1)} hours` : 
                  'Unknown'
                }
              </div>
            </div>
            
            <div className="health-item">
              <div className="health-label">Last Fetch</div>
              <div className="health-value">
                {healthStatus.last_successful_fetch ? 
                  formatDate(healthStatus.last_successful_fetch) : 
                  'Never'
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Query Info */}
      {encroachmentData && (
        <div className="stats-section">
          <h4>Current Query Information</h4>
          <div className="query-info">
            <div className="query-item">
              <strong>Date Range:</strong> {encroachmentData.date_range.start} to {encroachmentData.date_range.end}
            </div>
            <div className="query-item">
              <strong>Results Returned:</strong> {encroachmentData.alerts.length.toLocaleString()} of {encroachmentData.total_count.toLocaleString()}
            </div>
            <div className="query-item">
              <strong>Query Duration:</strong> {encroachmentData.query_duration_ms.toFixed(2)} ms
            </div>
            <div className="query-item">
              <strong>Last Updated:</strong> {formatDate(encroachmentData.last_updated)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EncroachmentStats;
