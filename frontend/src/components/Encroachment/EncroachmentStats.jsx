import React from 'react';
import { 
  FaChartBar, FaMapMarkerAlt, FaClock, FaExclamationCircle, 
  FaCalendarAlt, FaBolt, FaBullseye, FaHourglassHalf, FaCircle,
  FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaSpinner
} from 'react-icons/fa';
import './EncroachmentStats.css';

const EncroachmentStats = ({ statistics, encroachmentData, healthStatus }) => {
  if (!statistics) {
    return (
      <div className="stats-container">
        <div className="loading-container">
          <FaSpinner className="loading-spinner-icon" />
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
   * Get confidence level icon component
   */
  const getConfidenceIconComponent = (level) => {
    const iconProps = { className: `confidence-icon-circle ${level}` };
    return <FaCircle {...iconProps} />;
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
   * Get health status icon component
   */
  const getHealthIconComponent = (status) => {
    const iconMap = {
      healthy: <FaCheckCircle />,
      degraded: <FaExclamationTriangle />,
      unhealthy: <FaTimesCircle />
    };
    return iconMap[status] || <FaCircle />;
  };

  return (
    <div className="stats-container">
      {/* Header */}
      <div className="stats-header">
        <h3><FaChartBar /> Encroachment Statistics</h3>
        <p>Comprehensive overview of encroachment data and system health</p>
      </div>

      {/* Main Statistics Grid */}
      <div className="stats-grid">
        {/* Total Alerts Card */}
        <div className="stat-card primary">
          <FaMapMarkerAlt className="stat-icon" />
          <div className="stat-content">
            <div className="stat-value">{statistics.total_alerts.toLocaleString()}</div>
            <div className="stat-label">Total Alerts</div>
            <div className="stat-description">Latest available date</div>
          </div>
        </div>

        {/* Latest Date Alerts Card */}
        <div className="stat-card secondary">
          <FaClock className="stat-icon" />
          <div className="stat-content">
            <div className="stat-value">{statistics.recent_alerts_count.toLocaleString()}</div>
            <div className="stat-label">Latest Date Alerts</div>
            <div className="stat-description">From most recent data</div>
          </div>
        </div>

        {/* High Confidence Card */}
        <div className="stat-card warning">
          <FaExclamationCircle className="stat-icon" />
          <div className="stat-content">
            <div className="stat-value">{statistics.high_confidence_count.toLocaleString()}</div>
            <div className="stat-label">High Confidence</div>
            <div className="stat-description">Most reliable alerts</div>
          </div>
        </div>

        {/* Last Alert Card */}
        <div className="stat-card info">
          <FaCalendarAlt className="stat-icon" />
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
                <span className="confidence-icon">{getConfidenceIconComponent(level)}</span>
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

      {/* Key Metrics Summary */}
      <div className="stats-section">
        <h4>Key Metrics & Distribution</h4>
        <div className="metrics-grid">
          {/* Alert Severity Score */}
          <div className="metric-card">
            <FaBolt className="metric-icon" />
            <div className="metric-content">
              <div className="metric-label">Severity Score</div>
              <div className="metric-value">
                {statistics.total_alerts > 0 ? 
                  (() => {
                    // Calculate weighted severity: High=3, Nominal=2, Low=1
                    const highCount = statistics.alerts_by_confidence['high'] || 0;
                    const nominalCount = statistics.alerts_by_confidence['nominal'] || 0;
                    const lowCount = statistics.alerts_by_confidence['low'] || 0;
                    const totalScore = (highCount * 3) + (nominalCount * 2) + (lowCount * 1);
                    const maxScore = statistics.total_alerts * 3;
                    const severityPercent = ((totalScore / maxScore) * 100).toFixed(0);
                    return `${severityPercent}/100`;
                  })() : 
                  'N/A'
                }
              </div>
              <div className="metric-subtitle">Weighted by confidence levels</div>
            </div>
          </div>

          {/* Action Priority Breakdown */}
          <div className="metric-card">
            <FaBullseye className="metric-icon" />
            <div className="metric-content">
              <div className="metric-label">Action Priority</div>
              <div className="metric-value" style={{ fontSize: '1.2rem' }}>
                {statistics.total_alerts > 0 ? 
                  (() => {
                    const highPercent = ((statistics.high_confidence_count / statistics.total_alerts) * 100).toFixed(0);
                    if (highPercent >= 70) {
                      return <span style={{color: '#dc3545'}}><FaCircle style={{fontSize: '0.7rem'}} /> Critical</span>;
                    } else if (highPercent >= 40) {
                      return <span style={{color: '#ffc107'}}><FaCircle style={{fontSize: '0.7rem'}} /> Moderate</span>;
                    } else {
                      return <span style={{color: '#28a745'}}><FaCircle style={{fontSize: '0.7rem'}} /> Normal</span>;
                    }
                  })() : 
                  'N/A'
                }
              </div>
              <div className="metric-subtitle">
                {statistics.high_confidence_count.toLocaleString()} high priority alerts
              </div>
            </div>
          </div>

          {/* Risk Assessment Matrix */}
          <div className="metric-card wide">
            <FaChartBar className="metric-icon" />
            <div className="metric-content">
              <div className="metric-label">Risk Assessment Matrix</div>
              <div className="risk-matrix">
                {Object.entries(statistics.alerts_by_confidence)
                  .sort(([a], [b]) => {
                    const order = { high: 0, nominal: 1, low: 2 };
                    return (order[a] || 99) - (order[b] || 99);
                  })
                  .map(([level, count]) => {
                    const percentage = ((count / statistics.total_alerts) * 100).toFixed(1);
                    const riskLabel = level === 'high' ? 'CRITICAL' : 
                                     level === 'nominal' ? 'MODERATE' : 'LOW';
                    const riskAction = level === 'high' ? 'Immediate Response' : 
                                       level === 'nominal' ? 'Monitor Closely' : 'Routine Check';
                    
                    return (
                      <div key={level} className="risk-item">
                        <div className="risk-header">
                          <span className="risk-badge" style={{ 
                            backgroundColor: getConfidenceColor(level),
                            color: 'white',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontWeight: '700',
                            fontSize: '0.75rem'
                          }}>
                            {riskLabel}
                          </span>
                          <span className="risk-count">{count.toLocaleString()} alerts ({percentage}%)</span>
                        </div>
                        <div className="risk-bar-wrapper">
                          <div 
                            className="risk-bar-fill"
                            style={{ 
                              width: `${percentage}%`,
                              backgroundColor: getConfidenceColor(level),
                              height: '24px',
                              borderRadius: '8px',
                              transition: 'all 0.3s ease',
                              display: 'flex',
                              alignItems: 'center',
                              paddingLeft: '0.75rem',
                              color: 'white',
                              fontWeight: '600',
                              fontSize: '0.8rem'
                            }}
                          >
                            {riskAction}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Data Freshness */}
          <div className="metric-card">
            <FaHourglassHalf className="metric-icon" />
            <div className="metric-content">
              <div className="metric-label">Data Freshness</div>
              <div className="metric-value">
                {statistics.last_alert_date ? 
                  (() => {
                    const daysDiff = Math.floor((new Date() - new Date(statistics.last_alert_date)) / (1000 * 60 * 60 * 24));
                    return daysDiff === 0 ? 'Today' : `${daysDiff} days ago`;
                  })() : 
                  'N/A'
                }
              </div>
              <div className="metric-subtitle">Latest alert recorded</div>
            </div>
          </div>
        </div>
      </div>

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
                  {getHealthIconComponent(healthStatus.status)} {healthStatus.status.toUpperCase()}
                </span>
              </div>
            </div>
            
            <div className="health-item">
              <div className="health-label">API Connection</div>
              <div className="health-value">
                <span className={`connection-status ${healthStatus.api_accessible ? 'connected' : 'disconnected'}`}>
                  {healthStatus.api_accessible ? <><FaCheckCircle /> Connected</> : <><FaTimesCircle /> Disconnected</>}
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
            {encroachmentData.latest_data_date && (
              <div className="query-item">
                <strong>Latest Data Date:</strong> {formatDate(encroachmentData.latest_data_date)}
              </div>
            )}
            <div className="query-item">
              <strong>Results Returned:</strong> {encroachmentData.alerts?.length.toLocaleString() || 0} of {encroachmentData.total_count?.toLocaleString() || 0}
            </div>
            <div className="query-item">
              <strong>Query Duration:</strong> {encroachmentData.query_duration_ms?.toFixed(2) || 'N/A'} ms
            </div>
            <div className="query-item">
              <strong>Last Updated:</strong> {formatDate(encroachmentData.last_updated)}
            </div>
            {encroachmentData.message && (
              <div className="query-item">
                <strong>Status:</strong> {encroachmentData.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EncroachmentStats;
