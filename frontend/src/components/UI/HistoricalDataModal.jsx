import React, { useState, useEffect } from 'react';
import historicalDataService from '../../services/historicalDataService';
import './HistoricalDataModal.css';

/**
 * Data Table Component for displaying Excel data
 */
const DataTable = ({ data, isLoading, error }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100); // Increased from 50 to 100 to show more data

  // Use data directly without search filtering
  const filteredData = data;

  // Pagination
  const totalItems = filteredData?.rows?.length || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRows = filteredData?.rows?.slice(startIndex, endIndex) || [];

  if (isLoading) {
    return (
      <div className="data-table-loading">
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
        </div>
        <div className="loading-text">Loading historical data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="data-table-error">
        <div className="error-icon">⚠️</div>
        <div className="error-title">Failed to Load Data</div>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!data || !data.rows || data.rows.length === 0) {
    return (
      <div className="data-table-empty">
        <div className="empty-icon">📊</div>
        <div className="empty-title">No Data Available</div>
        <div className="empty-message">This dataset appears to be empty.</div>
      </div>
    );
  }

  return (
    <div className="data-table-container">
      {/* Info Bar */}
      <div className="data-table-controls">
        <div className="data-info">
          Showing {currentRows.length} of {totalItems} records
        </div>
      </div>

      {/* Data Table */}
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {filteredData.headers.map((header, index) => (
                <th key={index} className="table-header">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="table-row">
                {filteredData.headers.map((header, colIndex) => (
                  <td key={colIndex} className="table-cell">
                    {row[header] || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            ← Previous
          </button>
          
          <div className="pagination-info">
            Page {currentPage} of {totalPages}
          </div>
          
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="pagination-btn"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Historical Data Modal Component
 * Modal with three tabs displaying different Excel files
 */
const HistoricalDataModal = ({ isVisible, onClose }) => {
  const [activeTab, setActiveTab] = useState('deadliest');
  const [historicalData, setHistoricalData] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Tab configuration
  const tabs = [
    {
      id: 'deadliest',
      name: 'Deadliest Fires',
      // icon: '💀',
      description: 'Historical data of the most deadly wildfires in Texas'
    },
    {
      id: 'destructive',
      name: 'Most Destructive',
      // icon: '💥',
      description: 'Historical data of the most destructive wildfires in Texas'
    },
    {
      id: 'stats',
      name: 'Statistics',
      // icon: '📈',
      description: 'General wildfire statistics and trends for Texas'
    }
  ];

  // Load data when modal becomes visible
  useEffect(() => {
    if (isVisible && Object.keys(historicalData).length === 0) {
      loadHistoricalData();
    }
  }, [isVisible]);

  const loadHistoricalData = async () => {
    setIsLoading(true);
    try {
      console.log('📋 Loading all historical fire data...');
      const data = await historicalDataService.loadAllHistoricalData();
      setHistoricalData(data);
      console.log('✅ Historical data loaded successfully:', data);
    } catch (error) {
      console.error('❌ Error loading historical data:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const handleClose = () => {
    onClose();
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  const activeTabData = historicalData[activeTab];
  const currentTab = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="historical-data-modal-overlay" onClick={handleClose}>
      <div className="historical-data-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-section">
            <div className="modal-icon">📊</div>
            <div className="modal-title-content">
              <h2 className="modal-title">Historical Fire Data</h2>
              <p className="modal-subtitle">Texas Wildfire Historical Records</p>
            </div>
          </div>
          <button 
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="tab-navigation">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-name">{tab.name}</span>
              {historicalData[tab.id] && !historicalData[tab.id].loaded && (
                <span className="tab-error-indicator">⚠️</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {currentTab && (
            <div className="tab-panel">
              {/* Tab Description */}
              <div className="tab-description">
                <div className="description-icon">{currentTab.icon}</div>
                <div className="description-text">{currentTab.description}</div>
              </div>

              {/* Data Table */}
              <DataTable
                data={activeTabData?.data}
                isLoading={isLoading || !activeTabData}
                error={activeTabData?.error}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <div className="footer-info">
            <span className="data-source">
              📁 Data source: Texas Historical Fire Records
            </span>
          </div>
          <div className="footer-actions">
            <button 
              className="footer-btn secondary"
              onClick={() => {
                historicalDataService.clearCache();
                loadHistoricalData();
              }}
            >
              🔄 Refresh Data
            </button>
            <button 
              className="footer-btn primary"
              onClick={handleClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoricalDataModal;
