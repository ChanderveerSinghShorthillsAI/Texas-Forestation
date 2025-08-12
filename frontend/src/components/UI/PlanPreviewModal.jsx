import React, { useState, useEffect } from 'react';
import planGenerationService from '../../services/planGenerationService';
import './PlanPreviewModal.css';

/**
 * Plan Preview Modal Component
 * Shows the generated plan content with preview and download options
 */
const PlanPreviewModal = ({ 
  planId, 
  isVisible, 
  onClose, 
  onDownload 
}) => {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // Load preview data when modal becomes visible
  useEffect(() => {
    if (isVisible && planId && !previewData) {
      loadPreviewData();
    }
  }, [isVisible, planId, previewData]);

  const loadPreviewData = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await planGenerationService.getPlantationPlanPreview(planId);
      
      if (result.success) {
        setPreviewData(result.preview);
      } else {
        throw new Error(result.error || 'Failed to load preview');
      }
    } catch (err) {
      console.error('Preview load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!planId) return;

    setDownloading(true);
    try {
      const result = await planGenerationService.downloadPlanPDF(planId);
      
      if (result.success) {
        if (onDownload) {
          onDownload(planId);
        }
      } else {
        throw new Error(result.error || 'Download failed');
      }
    } catch (err) {
      console.error('Download error:', err);
      setError(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleClose = () => {
    setPreviewData(null);
    setError(null);
    if (onClose) {
      onClose();
    }
  };

  // Format content for display
  const formatContentForDisplay = (content) => {
    if (!content) return '';
    
    return planGenerationService.formatPlanContentForPreview(content);
  };

  if (!isVisible) return null;

  return (
    <div className="plan-preview-overlay">
      <div className="plan-preview-modal">
        {/* Header */}
        <div className="preview-header">
          <div className="header-content">
            <h2>📋 Plan Preview</h2>
            {previewData && (
              <div className="plan-meta">
                <span className="plan-title">{previewData.title}</span>
                <span className="plan-generated">
                  Generated: {new Date(previewData.generated_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
          <button className="close-button" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="preview-content">
          {loading && (
            <div className="loading-section">
              <div className="loading-spinner"></div>
              <p>Loading plan preview...</p>
            </div>
          )}

          {error && (
            <div className="error-section">
              <h4>❌ Preview Error</h4>
              <p>{error}</p>
              <button className="retry-button" onClick={loadPreviewData}>
                🔄 Retry
              </button>
            </div>
          )}

          {previewData && !loading && (
            <>
              {/* Plan Summary */}
              <div className="plan-summary">
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="label">Location:</span>
                    <span className="value">{previewData.spatial_data_summary?.location || 'Unknown'}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Coverage Layers:</span>
                    <span className="value">{previewData.spatial_data_summary?.coverage_layers || 0}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Nearby Features:</span>
                    <span className="value">{previewData.spatial_data_summary?.nearby_features || 0}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Knowledge Sources:</span>
                    <span className="value">{previewData.knowledge_chunks_used || 0}</span>
                  </div>
                </div>
              </div>

              {/* Plan Content Preview */}
              <div className="content-preview">
                <h3>📄 Plan Content</h3>
                <div className="content-scroll">
                  <div 
                    className="formatted-content"
                    dangerouslySetInnerHTML={{
                      __html: formatContentForDisplay(previewData.content)
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="preview-actions">
          {previewData && (
            <>
              <button 
                className="download-button primary"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <>
                    <span className="loading-spinner-small"></span>
                    Generating PDF...
                  </>
                ) : (
                  <>📄 Download PDF Plan</>
                )}
              </button>
              
              <div className="plan-info">
                <small>
                  📊 This plan contains detailed analysis, charts, and visualizations.
                  <br />
                  💾 PDF includes additional charts and formatted tables.
                </small>
              </div>
            </>
          )}
          
          <button 
            className="close-button-bottom secondary"
            onClick={handleClose}
          >
            ✕ Close Preview
          </button>
        </div>

        {/* Footer */}
        <div className="preview-footer">
          <p>
            <small>
              ℹ️ This preview shows the main content. The PDF includes additional charts, 
              formatted tables, and professional styling.
            </small>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlanPreviewModal; 