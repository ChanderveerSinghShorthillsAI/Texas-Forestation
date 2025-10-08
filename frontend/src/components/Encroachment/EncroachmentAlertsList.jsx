import React, { useState, useMemo } from 'react';
import {
  FaList, FaSearch, FaSpinner, FaMapMarkerAlt, FaCircle,
  FaMapMarkedAlt, FaArrowUp, FaArrowDown
} from 'react-icons/fa';
import './EncroachmentAlertsList.css';

const EncroachmentAlertsList = ({ 
  alerts = [], 
  selectedAlert, 
  onAlertSelect, 
  loading = false,
  totalCount = 0 
}) => {
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Confidence level colors and icons using React Icons
  const confidenceConfig = {
    high: { color: '#dc3545', icon: <FaCircle />, label: 'High' },
    nominal: { color: '#ffc107', icon: <FaCircle />, label: 'Nominal' },
    low: { color: '#28a745', icon: <FaCircle />, label: 'Low' }
  };

  /**
   * Sort and filter alerts
   */
  const processedAlerts = useMemo(() => {
    let filtered = alerts;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(alert => 
        alert.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.confidence.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.alert_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.latitude.toString().includes(searchTerm) ||
        alert.longitude.toString().includes(searchTerm)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle date sorting
      if (sortField === 'date') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      // Handle confidence sorting (high > nominal > low)
      if (sortField === 'confidence') {
        const confidenceOrder = { high: 3, nominal: 2, low: 1 };
        aValue = confidenceOrder[aValue] || 0;
        bValue = confidenceOrder[bValue] || 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [alerts, searchTerm, sortField, sortDirection]);

  /**
   * Paginate alerts
   */
  const paginatedAlerts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return processedAlerts.slice(startIndex, endIndex);
  }, [processedAlerts, currentPage, itemsPerPage]);

  /**
   * Handle sort field change
   */
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  /**
   * Handle search change
   */
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  /**
   * Handle items per page change
   */
  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  };

  /**
   * Calculate pagination info
   */
  const totalPages = Math.ceil(processedAlerts.length / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, processedAlerts.length);

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  /**
   * Format coordinates for display
   */
  const formatCoordinates = (lat, lng) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="alerts-list-container">
        <div className="alerts-list-header">
          <h3><FaList /> Encroachment Alerts List</h3>
          <p>Loading alerts...</p>
        </div>
        <div className="loading-container">
          <FaSpinner className="loading-spinner-icon" />
          <p>Loading alerts data...</p>
        </div>
      </div>
    );
  }

  /**
   * Render no data state
   */
  if (alerts.length === 0) {
    return (
      <div className="alerts-list-container">
        <div className="alerts-list-header">
          <h3><FaList /> Encroachment Alerts List</h3>
          <p>No alerts found</p>
        </div>
        <div className="no-data-container">
          <FaMapMarkerAlt className="no-data-icon" />
          <h4>No Alerts Found</h4>
          <p>No encroachment alerts found for the selected criteria. Try adjusting your filters or date range.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="alerts-list-container">
      {/* Header */}
      <div className="alerts-list-header">
        <div className="header-content">
          <h3><FaList /> Encroachment Alerts List</h3>
          <p>{totalCount.toLocaleString()} total alerts • {processedAlerts.length.toLocaleString()} filtered</p>
        </div>
      </div>

      {/* Search and Controls */}
      <div className="alerts-controls">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search alerts by date, confidence, ID, or coordinates..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
          <FaSearch className="search-icon" />
        </div>
        
        <div className="controls-right">
          <select
            value={itemsPerPage}
            onChange={handleItemsPerPageChange}
            className="items-per-page-select"
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value={200}>200 per page</option>
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="alerts-table-container">
        <table className="alerts-table">
          <thead>
            <tr>
              <th 
                className={`sortable ${sortField === 'date' ? `sorted-${sortDirection}` : ''}`}
                onClick={() => handleSort('date')}
              >
                Date {sortField === 'date' && (sortDirection === 'asc' ? <FaArrowUp /> : <FaArrowDown />)}
              </th>
              <th 
                className={`sortable ${sortField === 'confidence' ? `sorted-${sortDirection}` : ''}`}
                onClick={() => handleSort('confidence')}
              >
                Confidence {sortField === 'confidence' && (sortDirection === 'asc' ? <FaArrowUp /> : <FaArrowDown />)}
              </th>
              <th 
                className={`sortable ${sortField === 'latitude' ? `sorted-${sortDirection}` : ''}`}
                onClick={() => handleSort('latitude')}
              >
                Location {sortField === 'latitude' && (sortDirection === 'asc' ? <FaArrowUp /> : <FaArrowDown />)}
              </th>
              <th>Alert ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedAlerts.map((alert, index) => {
              const isSelected = selectedAlert && 
                selectedAlert.latitude === alert.latitude && 
                selectedAlert.longitude === alert.longitude;
              
              const config = confidenceConfig[alert.confidence] || confidenceConfig.nominal;
              
              return (
                <tr 
                  key={`${alert.latitude}-${alert.longitude}-${alert.date}`}
                  className={`alert-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => onAlertSelect(alert)}
                >
                  <td className="date-cell">
                    <span className="date-value">{formatDate(alert.date)}</span>
                  </td>
                  <td className="confidence-cell">
                    <span 
                      className="confidence-badge"
                      style={{ backgroundColor: config.color }}
                    >
                      {config.icon} {config.label}
                    </span>
                  </td>
                  <td className="location-cell">
                    <span className="coordinates">
                      {formatCoordinates(alert.latitude, alert.longitude)}
                    </span>
                  </td>
                  <td className="alert-id-cell">
                    <span className="alert-id">
                      {alert.alert_id || 'N/A'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button
                      className="focus-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAlertSelect(alert);
                      }}
                      title="Focus on this alert"
                    >
                      <FaMapMarkedAlt /> Focus
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {startItem.toLocaleString()} to {endItem.toLocaleString()} of {processedAlerts.length.toLocaleString()} alerts
          </div>
          
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              ⏮️ First
            </button>
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ⏪ Previous
            </button>
            
            <div className="page-numbers">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    className={`pagination-btn page-number ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next ⏩
            </button>
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last ⏭️
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EncroachmentAlertsList;
