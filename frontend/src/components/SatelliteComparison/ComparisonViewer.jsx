/**
 * Comparison Viewer Component
 * Side-by-side comparison of satellite images
 */

import React from 'react';
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
            <div className="placeholder-icon">🛰️</div>
            <h3>{label}</h3>
            <p className="placeholder-date">{imageData.actual_date}</p>
            <p className="placeholder-id">Image ID: {imageData.id}</p>
            <div className="placeholder-note">
              <span className="note-icon">⚠️</span>
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
        <h3>🔍 Satellite Image Comparison</h3>
        <p className="viewer-subtitle">
          Side-by-side view of the same location at two different dates
        </p>
      </div>

      {/* Side by side images */}
      <div className="side-by-side-container">
        {/* Before Image */}
        <div className="image-panel">
          <div className="panel-header">
            <h4>📅 Before</h4>
            <p className="image-date">{new Date(image1.actual_date).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>
          <div className="panel-content">
            {renderSatelliteImage(image1, 'Before')}
          </div>
          <div className="panel-footer">
            <div className="image-info">
              <span className="info-label">Satellite:</span>
              <span className="info-value">{image1.satellite_id}</span>
            </div>
            <div className="image-info">
              <span className="info-label">Cloud Cover:</span>
              <span className="info-value">{image1.cloud_cover}%</span>
            </div>
            <div className="image-info">
              <span className="info-label">Resolution:</span>
              <span className="info-value">{image1.pixel_resolution}m</span>
            </div>
          </div>
        </div>

        {/* After Image */}
        <div className="image-panel">
          <div className="panel-header">
            <h4>📅 After</h4>
            <p className="image-date">{new Date(image2.actual_date).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>
          <div className="panel-content">
            {renderSatelliteImage(image2, 'After')}
          </div>
          <div className="panel-footer">
            <div className="image-info">
              <span className="info-label">Satellite:</span>
              <span className="info-value">{image2.satellite_id}</span>
            </div>
            <div className="image-info">
              <span className="info-label">Cloud Cover:</span>
              <span className="info-value">{image2.cloud_cover}%</span>
            </div>
            <div className="image-info">
              <span className="info-label">Resolution:</span>
              <span className="info-value">{image2.pixel_resolution}m</span>
            </div>
          </div>
        </div>
      </div>

      {/* Note about imagery */}
      <div className="viewer-note">
        <div className="note-icon">🛰️</div>
        <div className="note-content">
          <h4>About the Imagery</h4>
          <p>
            Displaying actual satellite imagery from Planet Labs' PlanetScope constellation with 3-5m resolution. 
            These images show the selected location at two different time periods, allowing you to observe 
            changes in land use, vegetation, development, and environmental conditions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ComparisonViewer;
