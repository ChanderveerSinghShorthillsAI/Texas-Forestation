import React, { useState, useEffect, useCallback, useRef } from 'react';
import encroachmentService from '../../services/encroachmentService';
import './EncroachmentFilters.css';

const EncroachmentFilters = ({ filters, onFilterChange, loading = false }) => {
  const [localFilters, setLocalFilters] = useState(filters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState(false);
  const debounceTimeoutRef = useRef(null);

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Debounced filter change function
  const debouncedFilterChange = useCallback((newFilters) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    setPendingUpdate(true);
    
    debounceTimeoutRef.current = setTimeout(() => {
      onFilterChange(newFilters);
      setPendingUpdate(false);
    }, 500); // 500ms delay
  }, [onFilterChange]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Handle filter input changes with auto-apply for date changes
   */
  const handleInputChange = useCallback((field, value) => {
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
    
    // Auto-apply filters for date changes with debouncing
    if (field === 'start_date' || field === 'end_date') {
      // Only auto-apply if both dates are valid
      if (newFilters.start_date && newFilters.end_date) {
        debouncedFilterChange(newFilters);
      }
    }
  }, [localFilters, debouncedFilterChange]);

  /**
   * Apply filters
   */
  const handleApplyFilters = () => {
    onFilterChange(localFilters);
  };

  /**
   * Reset filters to default
   */
  const handleResetFilters = () => {
    const defaultRange = encroachmentService.getDefaultDateRange();
    const defaultFilters = {
      start_date: defaultRange.start_date,
      end_date: defaultRange.end_date,
      confidence_level: 'all',
      limit: 1000,
      offset: 0
    };
    setLocalFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  /**
   * Quick date range presets with auto-apply
   */
  const handleQuickDateRange = useCallback((days) => {
    const range = encroachmentService.getDateRangeForDays(days);
    const newFilters = { ...localFilters, ...range };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  }, [localFilters, onFilterChange]);

  /**
   * Handle confidence level change with auto-apply
   */
  const handleConfidenceChange = useCallback((confidence) => {
    const newFilters = { ...localFilters, confidence_level: confidence };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  }, [localFilters, onFilterChange]);

  return (
    <div className="encroachment-filters">
      <div className="filters-header">
        <h3>🔍 Filters & Search</h3>
        <div className="header-controls">
          {pendingUpdate && (
            <span className="pending-indicator">
              🔄 Updating...
            </span>
          )}
          <button 
            className="toggle-advanced"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▼' : '▶'} Advanced Options
          </button>
        </div>
      </div>

      <div className="filters-content">
        {/* Quick Date Range Buttons */}
        <div className="filter-group">
          <label className="filter-label">Quick Date Range:</label>
          <div className="quick-date-buttons">
            <button 
              className="quick-date-btn"
              onClick={() => handleQuickDateRange(7)}
              disabled={loading}
            >
              Last 7 Days
            </button>
            <button 
              className="quick-date-btn"
              onClick={() => handleQuickDateRange(30)}
              disabled={loading}
            >
              Last 30 Days
            </button>
            <button 
              className="quick-date-btn"
              onClick={() => handleQuickDateRange(90)}
              disabled={loading}
            >
              Last 90 Days
            </button>
          </div>
        </div>

        {/* Date Range Inputs */}
        <div className="filter-group">
          <label className="filter-label">Custom Date Range:</label>
          <div className="date-inputs">
            <div className="date-input-group">
              <label>Start Date:</label>
              <input
                type="date"
                value={localFilters.start_date}
                onChange={(e) => handleInputChange('start_date', e.target.value)}
                disabled={loading}
                className="date-input"
              />
            </div>
            <div className="date-input-group">
              <label>End Date:</label>
              <input
                type="date"
                value={localFilters.end_date}
                onChange={(e) => handleInputChange('end_date', e.target.value)}
                disabled={loading}
                className="date-input"
              />
            </div>
          </div>
        </div>

        {/* Confidence Level Filter */}
        <div className="filter-group">
          <label className="filter-label">Confidence Level:</label>
          <div className="confidence-buttons">
            <button
              className={`confidence-btn ${localFilters.confidence_level === 'all' ? 'active' : ''}`}
              onClick={() => handleConfidenceChange('all')}
              disabled={loading}
            >
              All Levels
            </button>
            <button
              className={`confidence-btn high ${localFilters.confidence_level === 'high' ? 'active' : ''}`}
              onClick={() => handleConfidenceChange('high')}
              disabled={loading}
            >
              🔴 High
            </button>
            <button
              className={`confidence-btn nominal ${localFilters.confidence_level === 'nominal' ? 'active' : ''}`}
              onClick={() => handleConfidenceChange('nominal')}
              disabled={loading}
            >
              🟡 Nominal
            </button>
            <button
              className={`confidence-btn low ${localFilters.confidence_level === 'low' ? 'active' : ''}`}
              onClick={() => handleConfidenceChange('low')}
              disabled={loading}
            >
              🟢 Low
            </button>
          </div>
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="advanced-options">
            <div className="filter-group">
              <label className="filter-label">Result Limit:</label>
              <select
                value={localFilters.limit}
                onChange={(e) => handleInputChange('limit', parseInt(e.target.value))}
                disabled={loading}
                className="limit-select"
              >
                <option value={500}>500 alerts</option>
                <option value={1000}>1,000 alerts</option>
                <option value={2000}>2,000 alerts</option>
                <option value={5000}>5,000 alerts</option>
                <option value={10000}>10,000 alerts</option>
                <option value={25000}>25,000 alerts</option>
                <option value={50000}>50,000 alerts</option>
                <option value={100000}>All alerts (no limit)</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Offset (for pagination):</label>
              <input
                type="number"
                value={localFilters.offset}
                onChange={(e) => handleInputChange('offset', parseInt(e.target.value) || 0)}
                disabled={loading}
                min="0"
                step="100"
                className="offset-input"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="filter-actions">
          <button
            onClick={handleApplyFilters}
            disabled={loading}
            className="apply-button"
          >
            {loading ? '🔄 Applying...' : '✅ Apply Filters'}
          </button>
          <button
            onClick={handleResetFilters}
            disabled={loading}
            className="reset-button"
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {/* Current Filter Summary */}
      <div className="filter-summary">
        <div className="summary-item">
          <strong>Date Range:</strong> {localFilters.start_date} to {localFilters.end_date}
        </div>
        <div className="summary-item">
          <strong>Confidence:</strong> {localFilters.confidence_level === 'all' ? 'All Levels' : localFilters.confidence_level}
        </div>
        <div className="summary-item">
          <strong>Limit:</strong> {localFilters.limit.toLocaleString()} alerts
        </div>
        {localFilters.offset > 0 && (
          <div className="summary-item">
            <strong>Offset:</strong> {localFilters.offset.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default EncroachmentFilters;
