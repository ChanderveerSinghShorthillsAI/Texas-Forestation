import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaTree, FaMapMarkedAlt, FaList, FaChartBar, FaHome, 
  FaSpinner, FaExclamationTriangle, FaRedoAlt, FaInfoCircle,
  FaCheckCircle, FaExclamationCircle, FaTimesCircle, FaTimes,
  FaCircle, FaBullseye
} from 'react-icons/fa';
import EncroachmentMap from './EncroachmentMap';
import EncroachmentStats from './EncroachmentStats';
import EncroachmentFilters from './EncroachmentFilters';
import EncroachmentAlertsList from './EncroachmentAlertsList';
import encroachmentService from '../../services/encroachmentService';
import './EncroachmentTrackingPage.css';

const EncroachmentTrackingPage = () => {
  const navigate = useNavigate();
  
  // State management
  const [allEncroachmentData, setAllEncroachmentData] = useState(null); // Store ALL data from API
  const [statistics, setStatistics] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter state (simplified - only confidence level, client-side filtering)
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  
  // View state
  const [activeView, setActiveView] = useState('map'); // 'map', 'list', 'stats'
  const [selectedAlert, setSelectedAlert] = useState(null);

  // Debug: Log background image element
  useEffect(() => {
    const bgElement = document.querySelector('.header-background-image');
    if (bgElement) {
      console.log('🖼️ Background element found:', bgElement);
      console.log('🎨 Applied styles:', window.getComputedStyle(bgElement).backgroundImage);
    } else {
      console.log('❌ Background element NOT found');
    }
  }, []);

  /**
   * Memoized filtered alerts - computed synchronously whenever data or filter changes
   */
  const filteredAlerts = useMemo(() => {
    if (!allEncroachmentData || !allEncroachmentData.alerts) {
      console.log('📭 No data available for filtering');
      return [];
    }

    const allAlerts = allEncroachmentData.alerts;
    
    if (confidenceFilter === 'all') {
      console.log('📊 Showing ALL alerts:', allAlerts.length);
      return allAlerts;
    } else {
      const filtered = allAlerts.filter(alert => alert.confidence === confidenceFilter);
      console.log(`📊 Filtered ${confidenceFilter} alerts:`, filtered.length, 'out of', allAlerts.length);
      return filtered;
    }
  }, [confidenceFilter, allEncroachmentData]);

  /**
   * Load latest data (fetch ALL data from API once)
   */
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load ALL data without confidence filter
      const requestFilters = {
        confidence_level: 'all',
        limit: 100000,  // Large limit to get all data
        offset: 0
      };

      const [encroachmentResponse, statsResponse, healthResponse] = await Promise.all([
        encroachmentService.getTexasEncroachment(requestFilters),
        encroachmentService.getStatistics(),
        encroachmentService.getHealthStatus()
      ]);

      console.log('🔍 Latest Encroachment Data Received:', encroachmentResponse);
      console.log('📊 Total Alerts Count:', encroachmentResponse?.alerts?.length || 0);
      console.log('📅 Latest Data Date:', encroachmentResponse?.latest_data_date);
      console.log('💬 Message:', encroachmentResponse?.message);

      // Store ALL data (filteredAlerts will be computed automatically via useMemo)
      setAllEncroachmentData(encroachmentResponse);
      setStatistics(statsResponse);
      setHealthStatus(healthResponse);

    } catch (err) {
      console.error('Error loading latest data:', err);
      setError(err.message || 'Failed to load latest encroachment data');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refresh data manually
   */
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);

      // Refresh data from API
      await encroachmentService.refreshData();
      
      // Reload all data
      await loadInitialData();

    } catch (err) {
      console.error('Error refreshing data:', err);
      setError(err.message || 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Handle confidence level changes (client-side filtering)
   */
  const handleConfidenceChange = (confidence_level) => {
    console.log('🔄 Confidence Filter Change:', confidence_level);
    setConfidenceFilter(confidence_level);
  };

  /**
   * Handle alert selection
   */
  const handleAlertSelect = (alert) => {
    console.log('🎯 Alert selected:', alert);
    
    // If already on map view, just update the selected alert
    if (activeView === 'map') {
      setSelectedAlert(alert);
    } else {
      // If not on map view, switch to map view first, then select the alert
      setActiveView('map');
      // Use setTimeout to ensure the map view is mounted before selecting the alert
      setTimeout(() => {
        setSelectedAlert(alert);
      }, 100);
    }
  };

  /**
   * Export latest data as CSV
   */
  const handleExportCSV = async () => {
    try {
      const exportFilters = {
        confidence_level: confidenceFilter,
        limit: 100000,
        offset: 0
      };
      const csvData = await encroachmentService.exportCSV(exportFilters);
      
      // Create and download CSV file
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      link.download = `texas_encroachment_${confidenceFilter}_${today}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Error exporting CSV:', err);
      setError(err.message || 'Failed to export data');
    }
  };

  /**
   * Load data on component mount
   */
  useEffect(() => {
    loadInitialData();
  }, []);

  /**
   * Auto-refresh data every 10 minutes
   */
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !refreshing) {
        loadInitialData();
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [loading, refreshing, loadInitialData]);

  /**
   * Render loading state
   */
  if (loading && !allEncroachmentData) {
    return (
      <div className="encroachment-page">
        <div className="encroachment-header">
          <h1><FaTree /> Texas Encroachment Tracking</h1>
          <p>Monitoring forest encroachment alerts across Texas</p>
        </div>
        <div className="loading-container">
          <FaSpinner className="loading-spinner-icon" />
          <p>Loading encroachment data...</p>
        </div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error && !allEncroachmentData) {
    return (
      <div className="encroachment-page">
        <div className="encroachment-header">
          <h1><FaTree /> Texas Encroachment Tracking</h1>
          <p>Monitoring forest encroachment alerts across Texas</p>
        </div>
        <div className="error-container">
          <FaExclamationTriangle className="error-icon" />
          <h3>Error Loading Data</h3>
          <p>{error}</p>
          <button onClick={loadInitialData} className="retry-button">
            <FaRedoAlt /> Retry
          </button>
        </div>
      </div>
    );
  }

  // Calculate filtered confidence breakdown
  const getFilteredConfidenceBreakdown = () => {
    if (!allEncroachmentData || !allEncroachmentData.alerts) {
      return { high: 0, nominal: 0, low: 0 };
    }
    const allAlerts = allEncroachmentData.alerts;
    return {
      high: allAlerts.filter(a => a.confidence === 'high').length,
      nominal: allAlerts.filter(a => a.confidence === 'nominal').length,
      low: allAlerts.filter(a => a.confidence === 'low').length
    };
  };

  const confidenceBreakdown = getFilteredConfidenceBreakdown();

  return (
    <div 
      className="encroachment-page"
      style={{
        backgroundImage: `url(${process.env.PUBLIC_URL}/images/encroachment.png)`
      }}
    >
      {/* Header */}
      <div className="encroachment-header">
        <div className="header-top-row">
          <button 
            onClick={() => navigate('/texas-forestation-planner')}
            className="back-button"
            title="Back to main application"
          >
            <FaHome /> Back to Main
          </button>
          <div className="header-text">
            <h1><FaTree className="header-icon" /> Texas Encroachment Tracking</h1>
            <p className="header-subtitle">Enhanced forest encroachment monitoring using satellite data</p>
          </div>
          <div className="header-actions">
            {/* Placeholder for alignment */}
          </div>
        </div>

        <div className="header-bottom-row">
          {/* Data Info */}
          {allEncroachmentData?.message && (
            <div className="data-info-card">
              <FaInfoCircle className="info-icon" />
              <span className="info-text">{allEncroachmentData.message}</span>
            </div>
          )}
          
          {/* Health Status */}
          {healthStatus && (
            <div className={`health-status-card ${healthStatus.status}`}>
              <div className="health-status-item">
                <span className="health-label">Service:</span>
                <span className="health-value">
                  {healthStatus.status === 'healthy' ? <FaCheckCircle className="status-icon healthy" /> : 
                   healthStatus.status === 'degraded' ? <FaExclamationCircle className="status-icon degraded" /> : 
                   <FaTimesCircle className="status-icon unhealthy" />}
                  {healthStatus.status}
                </span>
              </div>
              <div className="health-divider"></div>
              <div className="health-status-item">
                <span className="health-label">API:</span>
                <span className="health-value">
                  {healthStatus.api_accessible ? (
                    <><FaCheckCircle className="status-icon healthy" /> Connected</>
                  ) : (
                    <><FaTimesCircle className="status-icon unhealthy" /> Disconnected</>
                  )}
                </span>
              </div>
              <div className="health-divider"></div>
              <div className="health-status-item">
                <span className="health-label">Cached Alerts:</span>
                <span className="health-value">
                  {healthStatus.total_cached_alerts.toLocaleString()}
                  {healthStatus.cache_age_hours && (
                    <span className="cache-age"> ({healthStatus.cache_age_hours.toFixed(1)}h old)</span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="view-tabs">
        <button 
          className={`tab ${activeView === 'map' ? 'active' : ''}`}
          onClick={() => setActiveView('map')}
        >
          <FaMapMarkedAlt /> Map View
        </button>
        <button 
          className={`tab ${activeView === 'list' ? 'active' : ''}`}
          onClick={() => setActiveView('list')}
        >
          <FaList /> Alerts List
        </button>
        <button 
          className={`tab ${activeView === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveView('stats')}
        >
          <FaChartBar /> Statistics
        </button>
      </div>

      {/* Simple Confidence Filter */}
      <div className="simple-filters">
        <div className="filter-section">
          <h3><FaBullseye className="filter-icon" /> Filter by Confidence Level</h3>
          <div className="confidence-buttons">
            <button
              className={`confidence-btn ${confidenceFilter === 'all' ? 'active' : ''}`}
              onClick={() => handleConfidenceChange('all')}
            >
              All Levels ({allEncroachmentData?.total_count || 0})
            </button>
            <button
              className={`confidence-btn high ${confidenceFilter === 'high' ? 'active' : ''}`}
              onClick={() => handleConfidenceChange('high')}
            >
              <FaCircle className="conf-icon high" /> High ({confidenceBreakdown.high})
            </button>
            <button
              className={`confidence-btn nominal ${confidenceFilter === 'nominal' ? 'active' : ''}`}
              onClick={() => handleConfidenceChange('nominal')}
            >
              <FaCircle className="conf-icon nominal" /> Nominal ({confidenceBreakdown.nominal})
            </button>
            <button
              className={`confidence-btn low ${confidenceFilter === 'low' ? 'active' : ''}`}
              onClick={() => handleConfidenceChange('low')}
            >
              <FaCircle className="conf-icon low" /> Low ({confidenceBreakdown.low})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="encroachment-content">
        {activeView === 'map' && (
          <EncroachmentMap 
            alerts={filteredAlerts}
            selectedAlert={selectedAlert}
            onAlertSelect={handleAlertSelect}
            loading={loading}
          />
        )}
        
        {activeView === 'list' && (
          <EncroachmentAlertsList 
            alerts={filteredAlerts}
            selectedAlert={selectedAlert}
            onAlertSelect={handleAlertSelect}
            loading={loading}
            totalCount={filteredAlerts.length}
          />
        )}
        
        {activeView === 'stats' && (
          <EncroachmentStats 
            statistics={statistics}
            encroachmentData={allEncroachmentData}
            healthStatus={healthStatus}
          />
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <FaExclamationTriangle className="error-icon" />
          <span className="error-message">{error}</span>
          <button onClick={() => setError(null)} className="error-close"><FaTimes /></button>
        </div>
      )}
    </div>
  );
};

export default EncroachmentTrackingPage;
