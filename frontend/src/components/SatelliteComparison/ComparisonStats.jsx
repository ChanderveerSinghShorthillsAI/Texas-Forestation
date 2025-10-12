/**
 * Comparison Statistics Component
 * Displays metadata and statistics about the comparison
 */

import React from 'react';
import { 
  FaCalendarAlt, 
  FaChartBar, 
  FaCloudSun, 
  FaSatellite, 
  FaCheckCircle, 
  FaExclamationCircle,
  FaInfoCircle,
  FaExclamationTriangle 
} from 'react-icons/fa';
import './ComparisonStats.css';

const ComparisonStats = ({ data }) => {
  if (!data) return null;

  const { image1, image2, comparison } = data;

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get cloud cover color
  const getCloudCoverClass = (cloudCover) => {
    if (cloudCover < 10) return 'excellent';
    if (cloudCover < 30) return 'good';
    if (cloudCover < 50) return 'moderate';
    return 'poor';
  };

  return (
    <div className="comparison-stats">
      <div className="stats-grid">
        <div className="images-comparison-row">
          {/* Image 1 Stats */}
          <div className="stat-card image1-card">
            <div className="card-header">
              <FaCalendarAlt className="card-icon" />
              <h3 style={{color: 'white'}}>Before Image</h3>
            </div>
            <div className="card-body">
              <div className="stat-row">
                <span className="stat-label">Requested Date:</span>
                <span className="stat-value">{formatDate(image1.requested_date)}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Actual Date:</span>
                <span className="stat-value highlight">
                  {formatDate(image1.actual_date)}
                  {image1.days_from_requested > 0 && (
                    <span className="date-offset" title={`${image1.days_from_requested} days from requested`}>
                      {' '}±{image1.days_from_requested}d
                    </span>
                  )}
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Cloud Cover:</span>
                <span className={`stat-badge ${getCloudCoverClass(image1.cloud_cover)}`}>
                  {image1.cloud_cover.toFixed(1)}%
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Satellite:</span>
                <span className="stat-value">{image1.satellite_id || 'N/A'}</span>
              </div>
              {/* <div className="stat-row">
                <span className="stat-label">Image ID:</span>
                <span className="stat-value small">{image1.id}</span>
              </div> */}
            </div>
          </div>

          {/* Comparison Stats */}
          <div className="stat-card comparison-card">
            <div className="card-header">
              <FaChartBar className="card-icon" />
              <h3 style={{color: 'white'}}>Comparison</h3>
            </div>
            <div className="card-body">
              <div className="stat-row">
                <span className="stat-label">Time Span</span>
                <span className="stat-value highlight">
                  {comparison.days_between} days
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Same Satellite</span>
                <span className={`stat-badge ${comparison.same_satellite ? 'good' : 'moderate'}`}>
                  {comparison.same_satellite ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Cloud Change</span>
                <span className="stat-value">
                  {comparison.cloud_cover_change > 0 ? '+' : ''}
                  {comparison.cloud_cover_change.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Image 2 Stats */}
          <div className="stat-card image2-card">
            <div className="card-header">
              <FaCalendarAlt className="card-icon" />
              <h3 style={{color: 'white'}}>After Image</h3>
            </div>
            <div className="card-body">
              <div className="stat-row">
                <span className="stat-label">Requested Date:</span>
                <span className="stat-value">{formatDate(image2.requested_date)}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Actual Date:</span>
                <span className="stat-value highlight">
                  {formatDate(image2.actual_date)}
                  {image2.days_from_requested > 0 && (
                    <span className="date-offset" title={`${image2.days_from_requested} days from requested`}>
                      {' '}±{image2.days_from_requested}d
                    </span>
                  )}
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Cloud Cover:</span>
                <span className={`stat-badge ${getCloudCoverClass(image2.cloud_cover)}`}>
                  {image2.cloud_cover.toFixed(1)}%
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Satellite:</span>
                <span className="stat-value">{image2.satellite_id || 'N/A'}</span>
              </div>
              {/* <div className="stat-row">
                <span className="stat-label">Image ID:</span>
                <span className="stat-value small">{image2.id}</span>
              </div> */}
            </div>
          </div>
        </div>
      </div>

      {/* Additional info */}
      <div className="stats-info">
        <div className="info-badge">
          <FaInfoCircle className="info-icon" />
          <span className="info-text">
            Images are automatically selected based on best quality and proximity to requested dates.
            {(image1.days_from_requested > 0 || image2.days_from_requested > 0) && (
              <> The actual acquisition dates may differ by up to ±7 days from your requested dates.</>
            )}
          </span>
        </div>
        {comparison.date_accuracy && (image1.days_from_requested > 3 || image2.days_from_requested > 3) && (
          <div className="info-badge warning">
            <FaExclamationTriangle className="info-icon" />
            <span className="info-text">
              <strong>Date Accuracy Notice:</strong> One or more images were acquired {' '}
              {Math.max(image1.days_from_requested, image2.days_from_requested)} days from the requested date. 
              This is common when cloud coverage prevents clear imagery on the exact date.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparisonStats;

