import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import EncroachmentMap from './EncroachmentMap';
import EncroachmentStats from './EncroachmentStats';
import EncroachmentFilters from './EncroachmentFilters';
import EncroachmentAlertsList from './EncroachmentAlertsList';
import encroachmentService from '../../services/encroachmentService';
import './EncroachmentTrackingPage.css';

const EncroachmentTrackingPage = () => {
  const navigate = useNavigate();
  
  // State management
  const [encroachmentData, setEncroachmentData] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter state (simplified - only confidence level, no limit for all data)
  const [filters, setFilters] = useState({
    confidence_level: 'all',
    limit: 100000,  // Large limit to get all data
    offset: 0
  });
  
  // View state
  const [activeView, setActiveView] = useState('map'); // 'map', 'list', 'stats'
  const [selectedAlert, setSelectedAlert] = useState(null);

  /**
   * Load latest data (simplified - no date handling)
   */
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load latest data in parallel (no date filters needed)
      const [encroachmentResponse, statsResponse, healthResponse] = await Promise.all([
        encroachmentService.getTexasEncroachment(filters),
        encroachmentService.getStatistics(),
        encroachmentService.getHealthStatus()
      ]);

      console.log('🔍 Latest Encroachment Data Received:', encroachmentResponse);
      console.log('📊 Alerts Count:', encroachmentResponse?.alerts?.length || 0);
      console.log('📅 Latest Data Date:', encroachmentResponse?.latest_data_date);
      console.log('💬 Message:', encroachmentResponse?.message);

      setEncroachmentData(encroachmentResponse);
      setStatistics(statsResponse);
      setHealthStatus(healthResponse);

    } catch (err) {
      console.error('Error loading latest data:', err);
      setError(err.message || 'Failed to load latest encroachment data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
   * Handle confidence level changes (simplified)
   */
  const handleConfidenceChange = async (confidence_level) => {
    try {
      setLoading(true);
      setError(null);

      const updatedFilters = { ...filters, confidence_level };
      setFilters(updatedFilters);

      console.log('🔄 Confidence Change:', confidence_level);
      
      const response = await encroachmentService.getTexasEncroachment(updatedFilters);
      
      console.log('🔍 Updated Data Received:', response);
      console.log('📊 Updated Alerts Count:', response?.alerts?.length || 0);
      
      setEncroachmentData(response);

    } catch (err) {
      console.error('Error updating confidence filter:', err);
      setError(err.message || 'Failed to update confidence filter');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle alert selection
   */
  const handleAlertSelect = (alert) => {
    setSelectedAlert(alert);
    setActiveView('map'); // Switch to map view when alert is selected
  };

  /**
   * Export latest data as CSV
   */
  const handleExportCSV = async () => {
    try {
      const csvData = await encroachmentService.exportCSV(filters);
      
      // Create and download CSV file
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      link.download = `texas_encroachment_latest_${today}.csv`;
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
  if (loading && !encroachmentData) {
    return (
      <div className="encroachment-page">
        <div className="encroachment-header">
          <h1>🌲 Texas Encroachment Tracking</h1>
          <p>Monitoring forest encroachment alerts across Texas</p>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading encroachment data...</p>
        </div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error && !encroachmentData) {
    return (
      <div className="encroachment-page">
        <div className="encroachment-header">
          <h1>🌲 Texas Encroachment Tracking</h1>
          <p>Monitoring forest encroachment alerts across Texas</p>
        </div>
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h3>Error Loading Data</h3>
          <p>{error}</p>
          <button onClick={loadInitialData} className="retry-button">
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="encroachment-page">
      {/* Header */}
      <div className="encroachment-header">
        <div className="header-content">
          <div className="header-text">
            <h1>🌲 Texas Encroachment Tracking</h1>
            <p>Latest forest encroachment alerts across Texas</p>
            {encroachmentData?.message && (
              <div className="data-info">
                <span className="info-icon">ℹ️</span>
                <span className="info-text">{encroachmentData.message}</span>
              </div>
            )}
          </div>
          <div className="header-actions">
            <button 
              onClick={handleRefresh} 
              disabled={refreshing}
              className="refresh-button"
              title="Refresh data from Global Forest Watch API"
            >
              {refreshing ? '🔄' : '🔄'} {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
            <button 
              onClick={handleExportCSV}
              className="export-button"
              title="Export data as CSV"
            >
              📊 Export CSV
            </button>
            <button 
              onClick={() => navigate('/texas-forestation-planner')}
              className="back-button"
              title="Back to main application"
            >
              🏠 Back to Main
            </button>
          </div>
        </div>
        
        {/* Health Status */}
        {healthStatus && (
          <div className={`health-status ${healthStatus.status}`}>
            <span className="health-indicator">
              {healthStatus.status === 'healthy' ? '🟢' : 
               healthStatus.status === 'degraded' ? '🟡' : '🔴'}
            </span>
            <span className="health-text">
              Service: {healthStatus.status} | 
              API: {healthStatus.api_accessible ? 'Connected' : 'Disconnected'} | 
              Cached: {healthStatus.total_cached_alerts} alerts
              {healthStatus.cache_age_hours && ` (${healthStatus.cache_age_hours.toFixed(1)}h old)`}
            </span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="view-tabs">
        <button 
          className={`tab ${activeView === 'map' ? 'active' : ''}`}
          onClick={() => setActiveView('map')}
        >
          🗺️ Map View
        </button>
        <button 
          className={`tab ${activeView === 'list' ? 'active' : ''}`}
          onClick={() => setActiveView('list')}
        >
          📋 Alerts List
        </button>
        <button 
          className={`tab ${activeView === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveView('stats')}
        >
          📊 Statistics
        </button>
      </div>

      {/* Simple Confidence Filter */}
      <div className="simple-filters">
        <div className="filter-section">
          <h3>🎯 Filter by Confidence Level</h3>
          <div className="confidence-buttons">
            <button
              className={`confidence-btn ${filters.confidence_level === 'all' ? 'active' : ''}`}
              onClick={() => handleConfidenceChange('all')}
              disabled={loading}
            >
              All Levels ({encroachmentData?.total_count || 0})
            </button>
            <button
              className={`confidence-btn high ${filters.confidence_level === 'high' ? 'active' : ''}`}
              onClick={() => handleConfidenceChange('high')}
              disabled={loading}
            >
              🔴 High ({encroachmentData?.confidence_breakdown?.high || 0})
            </button>
            <button
              className={`confidence-btn nominal ${filters.confidence_level === 'nominal' ? 'active' : ''}`}
              onClick={() => handleConfidenceChange('nominal')}
              disabled={loading}
            >
              🟡 Nominal ({encroachmentData?.confidence_breakdown?.nominal || 0})
            </button>
            <button
              className={`confidence-btn low ${filters.confidence_level === 'low' ? 'active' : ''}`}
              onClick={() => handleConfidenceChange('low')}
              disabled={loading}
            >
              🟢 Low ({encroachmentData?.confidence_breakdown?.low || 0})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="encroachment-content">
        {activeView === 'map' && (
          <EncroachmentMap 
            alerts={encroachmentData?.alerts || []}
            selectedAlert={selectedAlert}
            onAlertSelect={handleAlertSelect}
            loading={loading}
          />
        )}
        
        {activeView === 'list' && (
          <EncroachmentAlertsList 
            alerts={encroachmentData?.alerts || []}
            selectedAlert={selectedAlert}
            onAlertSelect={handleAlertSelect}
            loading={loading}
            totalCount={encroachmentData?.total_count || 0}
          />
        )}
        
        {activeView === 'stats' && (
          <EncroachmentStats 
            statistics={statistics}
            encroachmentData={encroachmentData}
            healthStatus={healthStatus}
          />
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}
    </div>
  );
};

export default EncroachmentTrackingPage;
