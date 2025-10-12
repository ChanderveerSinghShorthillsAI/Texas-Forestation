import React, { useState, useMemo } from 'react';
import {
  FaList, FaSearch, FaSpinner, FaMapMarkerAlt, FaCircle,
  FaMapMarkedAlt, FaArrowUp, FaArrowDown
} from 'react-icons/fa';

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

  // Styles object for consistent dark glassmorphism theme
  const styles = {
    container: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(10px)',
    },
    header: {
      padding: '1.5rem',
      background: 'linear-gradient(135deg, rgba(20, 25, 30, 0.85) 0%, rgba(30, 35, 40, 0.75) 100%)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
    },
    headerTitle: {
      margin: '0 0 0.25rem 0',
      color: '#ffffff',
      fontSize: '1.25rem',
      fontWeight: '700',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    headerSubtitle: {
      margin: '0',
      color: '#cbd5e0',
      fontSize: '0.9rem',
    },
    controls: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 1.5rem',
      background: 'rgba(40, 45, 50, 0.6)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      gap: '1rem',
      flexWrap: 'wrap',
    },
    searchContainer: {
      position: 'relative',
      flex: '1',
      maxWidth: '400px',
      minWidth: '250px',
    },
    searchInput: {
      width: '100%',
      padding: '0.75rem 1rem 0.75rem 2.5rem',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '25px',
      fontSize: '0.9rem',
      transition: 'all 0.3s ease',
      background: 'rgba(30, 35, 40, 0.6)',
      color: '#ffffff',
    },
    searchIcon: {
      position: 'absolute',
      left: '0.75rem',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#cbd5e0',
      fontSize: '1rem',
      pointerEvents: 'none',
    },
    select: {
      padding: '0.5rem 0.75rem',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      fontSize: '0.9rem',
      background: 'rgba(30, 35, 40, 0.6)',
      color: '#ffffff',
      cursor: 'pointer',
    },
    tableContainer: {
      flex: 1,
      overflow: 'auto',
      background: 'rgba(20, 25, 30, 0.5)',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '0.9rem',
    },
    thead: {
      background: 'rgba(30, 35, 40, 0.9)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    },
    th: {
      padding: '1rem 0.75rem',
      textAlign: 'left',
      color: '#ffffff',
      fontWeight: '700',
      cursor: 'pointer',
      userSelect: 'none',
      borderBottom: '2px solid rgba(255, 255, 255, 0.2)',
      transition: 'background 0.2s ease',
    },
    tr: {
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    },
    td: {
      padding: '1rem 0.75rem',
      color: '#e2e8f0',
    },
    confidenceBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem',
      padding: '0.35rem 0.75rem',
      borderRadius: '12px',
      fontSize: '0.85rem',
      fontWeight: '600',
      color: 'white',
    },
    button: {
      padding: '0.5rem 1rem',
      border: 'none',
      borderRadius: '8px',
      background: 'linear-gradient(135deg, #2d5a3d 0%, #4f772d 100%)',
      color: 'white',
      fontSize: '0.85rem',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem',
      transition: 'all 0.2s ease',
    },
    pagination: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 1.5rem',
      background: 'rgba(30, 35, 40, 0.8)',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      flexWrap: 'wrap',
      gap: '1rem',
    },
    paginationInfo: {
      color: '#cbd5e0',
      fontSize: '0.9rem',
    },
    paginationControls: {
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    paginationBtn: {
      padding: '0.5rem 0.75rem',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      background: 'rgba(30, 35, 40, 0.6)',
      color: '#ffffff',
      fontSize: '0.85rem',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
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
    noDataContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 2rem',
      textAlign: 'center',
    },
    noDataIcon: {
      fontSize: '4rem',
      color: '#4ade80',
      marginBottom: '1rem',
    },
    noDataTitle: {
      color: '#ffffff',
      fontSize: '1.5rem',
      fontWeight: '700',
      margin: '0 0 0.5rem 0',
    },
    noDataText: {
      color: '#cbd5e0',
      fontSize: '1rem',
      margin: '0',
      maxWidth: '500px',
    },
  };

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
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.headerTitle}>
            <FaList style={{ color: '#4ade80' }} /> Encroachment Alerts List
          </h3>
          <p style={styles.headerSubtitle}>Loading alerts...</p>
        </div>
        <div style={styles.loadingContainer}>
          <FaSpinner style={styles.loadingIcon} />
          <p style={styles.loadingText}>Loading alerts data...</p>
        </div>
      </div>
    );
  }

  /**
   * Render no data state
   */
  if (alerts.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.headerTitle}>
            <FaList style={{ color: '#4ade80' }} /> Encroachment Alerts List
          </h3>
          <p style={styles.headerSubtitle}>No alerts found</p>
        </div>
        <div style={styles.noDataContainer}>
          <FaMapMarkerAlt style={styles.noDataIcon} />
          <h4 style={styles.noDataTitle}>No Alerts Found</h4>
          <p style={styles.noDataText}>
            No encroachment alerts found for the selected criteria. Try adjusting your filters or date range.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.headerTitle}>
          <FaList style={{ color: '#4ade80' }} /> Encroachment Alerts List
        </h3>
        <p style={styles.headerSubtitle}>
          {totalCount.toLocaleString()} total alerts • {processedAlerts.length.toLocaleString()} filtered
        </p>
      </div>

      {/* Search and Controls */}
      <div style={styles.controls}>
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search alerts by date, confidence, ID, or coordinates..."
            value={searchTerm}
            onChange={handleSearchChange}
            style={styles.searchInput}
          />
          <FaSearch style={styles.searchIcon} />
        </div>
        
        <div>
          <select
            value={itemsPerPage}
            onChange={handleItemsPerPageChange}
            style={styles.select}
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value={200}>200 per page</option>
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead style={styles.thead}>
            <tr>
              <th 
                style={{
                  ...styles.th,
                  background: sortField === 'date' ? 'rgba(45, 90, 61, 0.3)' : undefined
                }}
                onClick={() => handleSort('date')}
              >
                Date {sortField === 'date' && (sortDirection === 'asc' ? <FaArrowUp /> : <FaArrowDown />)}
              </th>
              <th 
                style={{
                  ...styles.th,
                  background: sortField === 'confidence' ? 'rgba(45, 90, 61, 0.3)' : undefined
                }}
                onClick={() => handleSort('confidence')}
              >
                Confidence {sortField === 'confidence' && (sortDirection === 'asc' ? <FaArrowUp /> : <FaArrowDown />)}
              </th>
              <th 
                style={{
                  ...styles.th,
                  background: sortField === 'latitude' ? 'rgba(45, 90, 61, 0.3)' : undefined
                }}
                onClick={() => handleSort('latitude')}
              >
                Location {sortField === 'latitude' && (sortDirection === 'asc' ? <FaArrowUp /> : <FaArrowDown />)}
              </th>
              <th style={styles.th}>Alert ID</th>
              <th style={styles.th}>Actions</th>
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
                  style={{
                    ...styles.tr,
                    background: isSelected ? 'rgba(45, 90, 61, 0.4)' : 'rgba(30, 35, 40, 0.3)',
                  }}
                  onClick={() => onAlertSelect(alert)}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(40, 45, 50, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(30, 35, 40, 0.3)';
                  }}
                >
                  <td style={styles.td}>
                    <span>{formatDate(alert.date)}</span>
                  </td>
                  <td style={styles.td}>
                    <span 
                      style={{ ...styles.confidenceBadge, backgroundColor: config.color }}
                    >
                      {config.icon} {config.label}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span>
                      {formatCoordinates(alert.latitude, alert.longitude)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span>
                      {alert.alert_id || 'N/A'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button
                      style={styles.button}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAlertSelect(alert);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(45, 90, 61, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
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
        <div style={styles.pagination}>
          <div style={styles.paginationInfo}>
            Showing {startItem.toLocaleString()} to {endItem.toLocaleString()} of {processedAlerts.length.toLocaleString()} alerts
          </div>
          
          <div style={styles.paginationControls}>
            <button
              style={{
                ...styles.paginationBtn,
                opacity: currentPage === 1 ? 0.5 : 1,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              onMouseEnter={(e) => {
                if (currentPage !== 1) {
                  e.currentTarget.style.background = 'rgba(45, 90, 61, 0.4)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(30, 35, 40, 0.6)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              ⏮️ First
            </button>
            <button
              style={{
                ...styles.paginationBtn,
                opacity: currentPage === 1 ? 0.5 : 1,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              onMouseEnter={(e) => {
                if (currentPage !== 1) {
                  e.currentTarget.style.background = 'rgba(45, 90, 61, 0.4)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(30, 35, 40, 0.6)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              ⏪ Previous
            </button>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                    style={{
                      ...styles.paginationBtn,
                      background: currentPage === pageNum ? 'linear-gradient(135deg, #2d5a3d 0%, #4f772d 100%)' : 'rgba(30, 35, 40, 0.6)',
                      fontWeight: currentPage === pageNum ? '700' : '400',
                    }}
                    onClick={() => setCurrentPage(pageNum)}
                    onMouseEnter={(e) => {
                      if (currentPage !== pageNum) {
                        e.currentTarget.style.background = 'rgba(45, 90, 61, 0.4)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentPage !== pageNum) {
                        e.currentTarget.style.background = 'rgba(30, 35, 40, 0.6)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              style={{
                ...styles.paginationBtn,
                opacity: currentPage === totalPages ? 0.5 : 1,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              onMouseEnter={(e) => {
                if (currentPage !== totalPages) {
                  e.currentTarget.style.background = 'rgba(45, 90, 61, 0.4)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(30, 35, 40, 0.6)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              Next ⏩
            </button>
            <button
              style={{
                ...styles.paginationBtn,
                opacity: currentPage === totalPages ? 0.5 : 1,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              onMouseEnter={(e) => {
                if (currentPage !== totalPages) {
                  e.currentTarget.style.background = 'rgba(45, 90, 61, 0.4)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(30, 35, 40, 0.6)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
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
