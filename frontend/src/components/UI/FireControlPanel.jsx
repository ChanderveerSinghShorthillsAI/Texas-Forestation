import React, { useState, useEffect } from 'react';
import { fireTrackingService } from '../../services/fireTrackingService';
import './FireControlPanel.css';

/**
 * Fire Control Panel Component
 * Provides controls and statistics for fire tracking feature
 */
const FireControlPanel = ({ 
  isVisible = false, 
  onClose, 
  onDatasetChange, 
  onDaysChange,
  onRefresh,
  fireData = null 
}) => {
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('VIIRS_NOAA20_NRT');
  const [selectedDays, setSelectedDays] = useState(1);
  const [statistics, setStatistics] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Load available datasets on mount
  useEffect(() => {
    const loadDatasets = async () => {
      try {
        const datasets = await fireTrackingService.getAvailableDatasets();
        setAvailableDatasets(datasets.datasets || []);
      } catch (error) {
        console.error('Failed to load available datasets:', error);
      }
    };
    
    loadDatasets();
  }, []);

  // Load statistics when dataset or days change
  useEffect(() => {
    if (isVisible) {
      loadStatistics();
    }
  }, [selectedDataset, selectedDays, isVisible]);

  // Update last update time when fire data changes
  useEffect(() => {
    if (fireData && fireData.lastUpdate) {
      setLastUpdate(fireData.lastUpdate);
    }
  }, [fireData]);

  /**
   * Load fire statistics
   */
  const loadStatistics = async () => {
    setIsLoadingStats(true);
    try {
      const stats = await fireTrackingService.getFireStatistics(selectedDataset, selectedDays);
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load fire statistics:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  /**
   * Handle dataset selection change
   */
  const handleDatasetChange = (event) => {
    const newDataset = event.target.value;
    setSelectedDataset(newDataset);
    if (onDatasetChange) {
      onDatasetChange(newDataset);
    }
  };

  /**
   * Handle days selection change
   */
  const handleDaysChange = (event) => {
    const newDays = parseInt(event.target.value);
    setSelectedDays(newDays);
    if (onDaysChange) {
      onDaysChange(newDays);
    }
  };

  /**
   * Handle refresh button click
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Clear cache and refresh data
      console.log('🔄 Forcing refresh of fire data...');
      await fireTrackingService.clearServerCache();
      
      // Force refresh fire data
      await fireTrackingService.forceRefresh(selectedDataset, selectedDays);
      
      if (onRefresh) {
        await onRefresh();
      }
      await loadStatistics();
      console.log('✅ Fire data refresh completed');
    } catch (error) {
      console.error('Failed to refresh fire data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * Format time for display
   */
  const formatTime = (date) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  /**
   * Get confidence level color
   */
  const getConfidenceColor = (level) => {
    switch (level) {
      case 'High': return '#22c55e';
      case 'Medium': return '#f59e0b';
      case 'Low': return '#ef4444';
      case 'Very Low': return '#dc2626';
      default: return '#6b7280';
    }
  };

  /**
   * Get intensity level color
   */
  const getIntensityColor = (level) => {
    switch (level) {
      case 'Very High': return '#dc2626';
      case 'High': return '#ef4444';
      case 'Medium': return '#f59e0b';
      case 'Low': return '#22c55e';
      case 'Very Low': return '#16a34a';
      default: return '#6b7280';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fire-control-panel">
      <div className="fire-control-header">
        <div className="fire-control-title">
          <div className="fire-control-icon">🔥</div>
          <h3>Fire Tracking</h3>
        </div>
        <button 
          className="fire-control-close"
          onClick={onClose}
          aria-label="Close fire control panel"
        >
          ×
        </button>
      </div>

      <div className="fire-control-content">
        {/* Dataset Selection */}
        <div className="fire-control-section">
          <label className="fire-control-label">Satellite Dataset</label>
          <select 
            className="fire-control-select"
            value={selectedDataset}
            onChange={handleDatasetChange}
          >
            {availableDatasets.map(dataset => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.name}
              </option>
            ))}
          </select>
        </div>

        {/* Time Period Selection */}
        <div className="fire-control-section">
          <label className="fire-control-label">Time Period</label>
          <select 
            className="fire-control-select"
            value={selectedDays}
            onChange={handleDaysChange}
          >
            <option value={1}>Last 24 hours</option>
            <option value={2}>Last 2 days</option>
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
          </select>
        </div>

        {/* Refresh Controls */}
        <div className="fire-control-section">
          <div className="fire-control-refresh">
            <button 
              className={`fire-refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <span className="fire-refresh-icon">🔄</span>
              {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
            <div className="fire-last-update">
              Last updated: {formatTime(lastUpdate)}
            </div>
          </div>
        </div>

        {/* Statistics Display */}
        {statistics && !isLoadingStats && (
          <div className="fire-control-section">
            <div className="fire-stats-header">
              <h4>Detection Statistics</h4>
              <div className="fire-stats-period">{statistics.time_period}</div>
            </div>

            {/* Total Detections */}
            <div className="fire-stat-card fire-stat-total">
              <div className="fire-stat-number">{statistics.total_detections}</div>
              <div className="fire-stat-label">Total Detections</div>
            </div>

            {/* Confidence Breakdown */}
            {statistics.confidence_breakdown && Object.keys(statistics.confidence_breakdown).some(key => statistics.confidence_breakdown[key] > 0) && (
              <div className="fire-stat-breakdown">
                <div className="fire-breakdown-title">By Confidence Level</div>
                <div className="fire-breakdown-items">
                  {Object.entries(statistics.confidence_breakdown).map(([level, count]) => (
                    count > 0 && (
                      <div key={level} className="fire-breakdown-item">
                        <div 
                          className="fire-breakdown-indicator"
                          style={{ backgroundColor: getConfidenceColor(level) }}
                        ></div>
                        <span className="fire-breakdown-label">{level}</span>
                        <span className="fire-breakdown-count">{count}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Intensity Breakdown */}
            {statistics.intensity_breakdown && Object.keys(statistics.intensity_breakdown).some(key => statistics.intensity_breakdown[key] > 0) && (
              <div className="fire-stat-breakdown">
                <div className="fire-breakdown-title">By Fire Intensity</div>
                <div className="fire-breakdown-items">
                  {Object.entries(statistics.intensity_breakdown).map(([level, count]) => (
                    count > 0 && (
                      <div key={level} className="fire-breakdown-item">
                        <div 
                          className="fire-breakdown-indicator"
                          style={{ backgroundColor: getIntensityColor(level) }}
                        ></div>
                        <span className="fire-breakdown-label">{level}</span>
                        <span className="fire-breakdown-count">{count}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading Statistics */}
        {isLoadingStats && (
          <div className="fire-loading-stats">
            <div className="fire-loading-spinner"></div>
            <div>Loading statistics...</div>
          </div>
        )}

        {/* Info Section */}
        <div className="fire-control-section fire-info-section">
          <div className="fire-info-title">About Fire Tracking</div>
          <div className="fire-info-content">
            <p>Real-time fire detection data from NASA's Fire Information for Resource Management System (FIRMS).</p>
            <div className="fire-legend">
              <div className="fire-legend-title">Fire Marker Legend:</div>
              <div className="fire-legend-items">
                <div className="fire-legend-item">
                  <div className="fire-legend-marker high-confidence"></div>
                  <span>High Confidence (80%+)</span>
                </div>
                <div className="fire-legend-item">
                  <div className="fire-legend-marker medium-confidence"></div>
                  <span>Medium Confidence (50-80%)</span>
                </div>
                <div className="fire-legend-item">
                  <div className="fire-legend-marker low-confidence"></div>
                  <span>Low Confidence (&lt;50%)</span>
                </div>
              </div>
              <div className="fire-legend-note">
                Marker size indicates fire intensity (FRP - Fire Radiative Power)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FireControlPanel;
