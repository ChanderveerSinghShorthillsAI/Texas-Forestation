import React from 'react';
import { 
  FaChartBar, FaMapMarkerAlt, FaClock, FaExclamationCircle, 
  FaCalendarAlt, FaBolt, FaBullseye, FaHourglassHalf, FaCircle,
  FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaSpinner
} from 'react-icons/fa';

const EncroachmentStats = ({ statistics, encroachmentData, healthStatus }) => {
  // Common style constants for consistency
  const styles = {
    container: {
      height: '100%',
      overflowY: 'auto',
      padding: '2rem',
      background: 'rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(10px)',
    },
    header: {
      marginBottom: '2.5rem',
      textAlign: 'center',
    },
    headerTitle: {
      margin: '0 0 0.75rem 0',
      color: 'white',
      fontSize: '1.75rem',
      fontWeight: '800',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      textShadow: '0 2px 12px rgba(0, 0, 0, 0.5)',
    },
    headerSubtitle: {
      margin: '0',
      color: 'white',
      fontSize: '1rem',
      fontWeight: '500',
      textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: '1.5rem',
      marginBottom: '2.5rem',
    },
    card: {
      background: 'linear-gradient(135deg, rgba(20, 25, 30, 0.85) 0%, rgba(30, 35, 40, 0.75) 100%)',
      backdropFilter: 'blur(20px)',
      borderRadius: '20px',
      padding: '2rem 1.75rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1.25rem',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      transition: 'all 0.3s ease',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    cardIcon: {
      fontSize: '3rem',
      opacity: 0.9,
    },
    cardContent: {
      flex: 1,
    },
    cardValue: {
      fontSize: '2.25rem',
      fontWeight: '800',
      color: '#ffffff',
      margin: '0 0 0.4rem 0',
      lineHeight: '1',
    },
    cardLabel: {
      fontSize: '1rem',
      fontWeight: '700',
      color: '#e2e8f0',
      margin: '0 0 0.25rem 0',
    },
    cardDescription: {
      fontSize: '0.85rem',
      color: '#cbd5e0',
      margin: '0',
      fontWeight: '500',
    },
    section: {
      marginBottom: '2.5rem',
      background: 'linear-gradient(135deg, rgba(20, 25, 30, 0.85) 0%, rgba(30, 35, 40, 0.75) 100%)',
      backdropFilter: 'blur(20px)',
      borderRadius: '20px',
      padding: '2rem',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    sectionTitle: {
      margin: '0 0 1.75rem 0',
      color: '#ffffff',
      fontSize: '1.4rem',
      fontWeight: '700',
      paddingBottom: '1rem',
      borderBottom: '2px solid rgba(255, 255, 255, 0.2)',
    },
    confidenceItem: {
      background: 'rgba(40, 45, 50, 0.6)',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
      marginBottom: '1.5rem',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    confidenceHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1rem',
    },
    confidenceLabel: {
      fontWeight: '700',
      color: '#ffffff',
      flex: 1,
      marginLeft: '0.75rem',
      fontSize: '1.1rem',
    },
    confidenceCount: {
      fontWeight: '800',
      color: '#ffffff',
      fontSize: '1.3rem',
      padding: '0.25rem 0.75rem',
      background: 'linear-gradient(135deg, rgba(45, 90, 61, 0.4) 0%, rgba(79, 119, 45, 0.4) 100%)',
      borderRadius: '12px',
    },
    confidenceBar: {
      height: '12px',
      background: 'rgba(226, 232, 240, 0.5)',
      borderRadius: '10px',
      overflow: 'hidden',
      marginBottom: '0.75rem',
    },
    confidencePercentage: {
      textAlign: 'right',
      fontSize: '1rem',
      fontWeight: '700',
      color: '#e2e8f0',
    },
    metricsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '1.5rem',
    },
    metricCard: {
      background: 'rgba(40, 45, 50, 0.6)',
      borderRadius: '16px',
      padding: '1.75rem',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      borderLeft: '4px solid #2d5a3d',
      transition: 'all 0.3s ease',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    metricIcon: {
      fontSize: '2.25rem',
      opacity: '0.85',
      color: '#4ade80',
    },
    metricLabel: {
      fontSize: '0.95rem',
      color: '#cbd5e0',
      fontWeight: '600',
      marginBottom: '0.5rem',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    metricValue: {
      fontSize: '1.75rem',
      fontWeight: '800',
      color: '#ffffff',
      marginBottom: '0.4rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    metricSubtitle: {
      fontSize: '0.8rem',
      color: '#94a3b8',
      fontWeight: '500',
    },
    healthGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '1.25rem',
    },
    healthItem: {
      background: 'rgba(40, 45, 50, 0.6)',
      borderRadius: '14px',
      padding: '1.5rem',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    healthLabel: {
      fontSize: '0.9rem',
      color: '#cbd5e0',
      marginBottom: '0.65rem',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
    },
    healthValue: {
      fontSize: '1.1rem',
      fontWeight: '700',
      color: '#ffffff',
    },
    queryInfo: {
      background: 'rgba(40, 45, 50, 0.6)',
      borderRadius: '14px',
      padding: '1.5rem',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    queryItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.75rem 0',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      fontSize: '0.95rem',
      color: '#ffffff',
    },
    loadingContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 2rem',
      textAlign: 'center',
    },
    loadingIcon: {
      fontSize: '3rem',
      color: '#4ade80',
      marginBottom: '1.5rem',
    },
    loadingText: {
      color: '#ffffff',
      fontSize: '1.1rem',
      margin: '0',
      fontWeight: '600',
    },
  };

  if (!statistics) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <FaSpinner style={styles.loadingIcon} />
          <p style={styles.loadingText}>Loading statistics...</p>
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
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.headerTitle}>
          <FaChartBar style={{ color: 'white' }} /> Encroachment Statistics
        </h3>
        <p style={styles.headerSubtitle}>Comprehensive overview of encroachment data and system health</p>
      </div>

      {/* Main Statistics Grid */}
      <div style={styles.grid}>
        {/* Total Alerts Card */}
        <div style={{ ...styles.card, borderLeft: '4px solid #2d5a3d' }}>
          <FaMapMarkerAlt style={{ ...styles.cardIcon, color: '#2d5a3d' }} />
          <div style={styles.cardContent}>
            <div style={styles.cardValue}>{statistics.total_alerts.toLocaleString()}</div>
            <div style={styles.cardLabel}>Total Alerts</div>
            <div style={styles.cardDescription}>Latest available date</div>
          </div>
        </div>

        {/* Latest Date Alerts Card */}
        <div style={{ ...styles.card, borderLeft: '4px solid #6c757d' }}>
          <FaClock style={{ ...styles.cardIcon, color: '#6c757d' }} />
          <div style={styles.cardContent}>
            <div style={styles.cardValue}>{statistics.recent_alerts_count.toLocaleString()}</div>
            <div style={styles.cardLabel}>Latest Date Alerts</div>
            <div style={styles.cardDescription}>From most recent data</div>
          </div>
        </div>

        {/* High Confidence Card */}
        <div style={{ ...styles.card, borderLeft: '4px solid #ffc107' }}>
          <FaExclamationCircle style={{ ...styles.cardIcon, color: '#ffc107' }} />
          <div style={styles.cardContent}>
            <div style={styles.cardValue}>{statistics.high_confidence_count.toLocaleString()}</div>
            <div style={styles.cardLabel}>High Confidence</div>
            <div style={styles.cardDescription}>Most reliable alerts</div>
          </div>
        </div>

        {/* Last Alert Card */}
        <div style={{ ...styles.card, borderLeft: '4px solid #17a2b8' }}>
          <FaCalendarAlt style={{ ...styles.cardIcon, color: '#17a2b8' }} />
          <div style={styles.cardContent}>
            <div style={styles.cardValue}>{formatDate(statistics.last_alert_date)}</div>
            <div style={styles.cardLabel}>Last Alert</div>
            <div style={styles.cardDescription}>Most recent detection</div>
          </div>
        </div>
      </div>

      {/* Confidence Breakdown */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Confidence Level Breakdown</h4>
        <div>
          {Object.entries(statistics.alerts_by_confidence).map(([level, count]) => (
            <div key={level} style={styles.confidenceItem}>
              <div style={styles.confidenceHeader}>
                <span style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center' }}>
                  {getConfidenceIconComponent(level)}
                </span>
                <span style={styles.confidenceLabel}>{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                <span style={styles.confidenceCount}>{count.toLocaleString()}</span>
              </div>
              <div style={styles.confidenceBar}>
                <div 
                  style={{ 
                    height: '100%',
                    width: `${getConfidencePercentage(count)}%`,
                    backgroundColor: getConfidenceColor(level),
                    borderRadius: '10px',
                    transition: 'width 0.6s ease',
                  }}
                ></div>
              </div>
              <div style={styles.confidencePercentage}>
                {getConfidencePercentage(count)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Key Metrics & Distribution</h4>
        <div style={styles.metricsGrid}>
          {/* Alert Severity Score */}
          <div style={styles.metricCard}>
            <FaBolt style={styles.metricIcon} />
            <div>
              <div style={styles.metricLabel}>Severity Score</div>
              <div style={styles.metricValue}>
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
              <div style={styles.metricSubtitle}>Weighted by confidence levels</div>
            </div>
          </div>

          {/* Action Priority Breakdown */}
          <div style={styles.metricCard}>
            <FaBullseye style={styles.metricIcon} />
            <div>
              <div style={styles.metricLabel}>Action Priority</div>
              <div style={{ ...styles.metricValue, fontSize: '1.2rem' }}>
                {statistics.total_alerts > 0 ? 
                  (() => {
                    const highPercent = ((statistics.high_confidence_count / statistics.total_alerts) * 100).toFixed(0);
                    if (highPercent >= 70) {
                      return <span style={{color: '#dc3545', display: 'flex', alignItems: 'center', gap: '0.5rem'}}><FaCircle style={{fontSize: '0.7rem'}} /> Critical</span>;
                    } else if (highPercent >= 40) {
                      return <span style={{color: '#ffc107', display: 'flex', alignItems: 'center', gap: '0.5rem'}}><FaCircle style={{fontSize: '0.7rem'}} /> Moderate</span>;
                    } else {
                      return <span style={{color: '#28a745', display: 'flex', alignItems: 'center', gap: '0.5rem'}}><FaCircle style={{fontSize: '0.7rem'}} /> Normal</span>;
                    }
                  })() : 
                  'N/A'
                }
              </div>
              <div style={styles.metricSubtitle}>
                {statistics.high_confidence_count.toLocaleString()} high priority alerts
              </div>
            </div>
          </div>

          {/* Risk Assessment Matrix */}
          <div style={{ ...styles.metricCard, gridColumn: 'span 2' }}>
            <FaChartBar style={styles.metricIcon} />
            <div>
              <div style={styles.metricLabel}>Risk Assessment Matrix</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
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
                      <div key={level} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ 
                            backgroundColor: getConfidenceColor(level),
                            color: 'white',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontWeight: '700',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.8px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                          }}>
                            {riskLabel}
                          </span>
                          <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#e2e8f0' }}>
                            {count.toLocaleString()} alerts ({percentage}%)
                          </span>
                        </div>
                        <div style={{ 
                          background: 'rgba(226, 232, 240, 0.3)', 
                          borderRadius: '12px', 
                          overflow: 'hidden', 
                          height: '28px',
                          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)' 
                        }}>
                          <div 
                            style={{ 
                              width: `${percentage}%`,
                              minWidth: '140px',
                              backgroundColor: getConfidenceColor(level),
                              height: '24px',
                              borderRadius: '8px',
                              transition: 'all 0.3s ease',
                              display: 'flex',
                              alignItems: 'center',
                              paddingLeft: '0.75rem',
                              color: 'white',
                              fontWeight: '600',
                              fontSize: '0.8rem',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
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
          <div style={styles.metricCard}>
            <FaHourglassHalf style={styles.metricIcon} />
            <div>
              <div style={styles.metricLabel}>Data Freshness</div>
              <div style={styles.metricValue}>
                {statistics.last_alert_date ? 
                  (() => {
                    const daysDiff = Math.floor((new Date() - new Date(statistics.last_alert_date)) / (1000 * 60 * 60 * 24));
                    return daysDiff === 0 ? 'Today' : `${daysDiff} days ago`;
                  })() : 
                  'N/A'
                }
              </div>
              <div style={styles.metricSubtitle}>Latest alert recorded</div>
            </div>
          </div>
        </div>
      </div>

      {/* System Health */}
      {healthStatus && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>System Health</h4>
          <div style={styles.healthGrid}>
            <div style={styles.healthItem}>
              <div style={styles.healthLabel}>Overall Status</div>
              <div style={styles.healthValue}>
                <span 
                  style={{ 
                    color: getHealthColor(healthStatus.status),
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    fontSize: '0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {getHealthIconComponent(healthStatus.status)} {healthStatus.status.toUpperCase()}
                </span>
              </div>
            </div>
            
            <div style={styles.healthItem}>
              <div style={styles.healthLabel}>API Connection</div>
              <div style={styles.healthValue}>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: '700',
                  color: healthStatus.api_accessible ? '#28a745' : '#dc3545'
                }}>
                  {healthStatus.api_accessible ? <><FaCheckCircle /> Connected</> : <><FaTimesCircle /> Disconnected</>}
                </span>
              </div>
            </div>
            
            <div style={styles.healthItem}>
              <div style={styles.healthLabel}>Cached Alerts</div>
              <div style={styles.healthValue}>
                {healthStatus.total_cached_alerts.toLocaleString()}
              </div>
            </div>
            
            <div style={styles.healthItem}>
              <div style={styles.healthLabel}>Cache Age</div>
              <div style={styles.healthValue}>
                {healthStatus.cache_age_hours ? 
                  `${healthStatus.cache_age_hours.toFixed(1)} hours` : 
                  'Unknown'
                }
              </div>
            </div>
            
            <div style={styles.healthItem}>
              <div style={styles.healthLabel}>Last Fetch</div>
              <div style={styles.healthValue}>
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
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Current Query Information</h4>
          <div style={styles.queryInfo}>
            {encroachmentData.latest_data_date && (
              <div style={styles.queryItem}>
                <strong style={{ color: '#cbd5e0', fontWeight: '700' }}>Latest Data Date:</strong>
                <span>{formatDate(encroachmentData.latest_data_date)}</span>
              </div>
            )}
            <div style={styles.queryItem}>
              <strong style={{ color: '#cbd5e0', fontWeight: '700' }}>Results Returned:</strong>
              <span>{encroachmentData.alerts?.length.toLocaleString() || 0} of {encroachmentData.total_count?.toLocaleString() || 0}</span>
            </div>
            <div style={styles.queryItem}>
              <strong style={{ color: '#cbd5e0', fontWeight: '700' }}>Query Duration:</strong>
              <span>{encroachmentData.query_duration_ms?.toFixed(2) || 'N/A'} ms</span>
            </div>
            <div style={styles.queryItem}>
              <strong style={{ color: '#cbd5e0', fontWeight: '700' }}>Last Updated:</strong>
              <span>{formatDate(encroachmentData.last_updated)}</span>
            </div>
            {encroachmentData.message && (
              <div style={{ ...styles.queryItem, borderBottom: 'none' }}>
                <strong style={{ color: '#cbd5e0', fontWeight: '700' }}>Status:</strong>
                <span>{encroachmentData.message}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EncroachmentStats;
