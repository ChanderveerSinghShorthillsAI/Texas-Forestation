/**
 * Comparison Viewer Component
 * Side-by-side comparison of satellite images
 */

import React from 'react';
import { 
  FaSatellite, 
  FaCalendarAlt, 
  FaCloudSun, 
  FaRuler, 
  FaExclamationTriangle,
  FaLeaf,
  FaInfoCircle 
} from 'react-icons/fa';
import './ComparisonViewer.css';

const ComparisonViewer = ({ data }) => {
  // Early return if no data
  if (!data) return null;

  const { image1, image2 } = data;

  // Render satellite image
  const renderSatelliteImage = (imageData, label) => {
    if (!imageData.preview_base64) {
      // Fallback to placeholder if no image data
      return (
        <div className="image-placeholder">
          <div className="placeholder-content">
            <FaSatellite className="placeholder-icon" />
            <h3>{label}</h3>
            <p className="placeholder-date">{imageData.actual_date}</p>
            <p className="placeholder-id">Image ID: {imageData.id}</p>
            <div className="placeholder-note">
              <FaExclamationTriangle className="note-icon" />
              <span>Image preview not available</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="satellite-image-container">
        <img 
          src={imageData.preview_base64} 
          alt={`Satellite ${label}`}
          className="satellite-preview-image"
        />
      </div>
    );
  };

  return (
    <div className="comparison-viewer">
      <div className="viewer-header">
        <FaLeaf className="viewer-header-icon" />
        <div>
          <h3>Vegetation Change Analysis</h3>
          <p className="viewer-subtitle">
            Side-by-side view tracking landscape transformation over time
          </p>
        </div>
      </div>

      {/* Side by side images */}
      <div className="side-by-side-container">
        {/* Before Image */}
        <div className="image-panel before-panel">
          <div className="panel-header">
            <FaCalendarAlt className="panel-icon" />
            <div>
              <h4>Before</h4>
              <p className="image-date">{new Date(image1.actual_date).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
            </div>
          </div>
          <div className="panel-content">
            {renderSatelliteImage(image1, 'Before')}
          </div>
          <div className="panel-footer">
            <div className="image-info">
              <FaSatellite className="info-icon" />
              <div>
                <span className="info-label">Satellite</span>
                <span className="info-value">{image1.satellite_id}</span>
              </div>
            </div>
            <div className="image-info">
              <FaCloudSun className="info-icon" />
              <div>
                <span className="info-label">Cloud Cover</span>
                <span className="info-value">{image1.cloud_cover}%</span>
              </div>
            </div>
            <div className="image-info">
              <FaRuler className="info-icon" />
              <div>
                <span className="info-label">Resolution</span>
                <span className="info-value">{image1.pixel_resolution}m</span>
              </div>
            </div>
          </div>
        </div>

        {/* After Image */}
        <div className="image-panel after-panel">
          <div className="panel-header">
            <FaCalendarAlt className="panel-icon" />
            <div>
              <h4>After</h4>
              <p className="image-date">{new Date(image2.actual_date).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
            </div>
          </div>
          <div className="panel-content">
            {renderSatelliteImage(image2, 'After')}
          </div>
          <div className="panel-footer">
            <div className="image-info">
              <FaSatellite className="info-icon" />
              <div>
                <span className="info-label">Satellite</span>
                <span className="info-value">{image2.satellite_id}</span>
              </div>
            </div>
            <div className="image-info">
              <FaCloudSun className="info-icon" />
              <div>
                <span className="info-label">Cloud Cover</span>
                <span className="info-value">{image2.cloud_cover}%</span>
              </div>
            </div>
            <div className="image-info">
              <FaRuler className="info-icon" />
              <div>
                <span className="info-label">Resolution</span>
                <span className="info-value">{image2.pixel_resolution}m</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Note about imagery */}
      <div className="viewer-note">
        <FaInfoCircle className="note-icon" />
        <div className="note-content" style={{color: 'black'}}>
          <h4>About the Imagery</h4>
          <p>
            High-resolution satellite imagery revealing vegetation patterns, land use changes, and environmental transformations. 
            These images capture the same location at two different time periods with 3-5m precision, enabling detailed 
            analysis of forest cover, agricultural development, and ecosystem health.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ComparisonViewer;
