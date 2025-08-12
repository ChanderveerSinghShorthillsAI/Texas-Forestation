import React, { useState, useCallback, useEffect } from 'react';
import planGenerationService from '../../services/planGenerationService';
import PlanPreviewModal from './PlanPreviewModal';
import './PlantationPlanGenerator.css';

/**
 * Plantation Plan Generator Component
 * Handles the complete flow of generating 10-year plantation plans
 */
const PlantationPlanGenerator = ({ 
  spatialData, 
  isVisible, 
  onClose, 
  onPlanGenerated 
}) => {
  const [generationState, setGenerationState] = useState('idle'); // idle, validating, generating, completed, error
  const [progress, setProgress] = useState(null);
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Validate spatial data when component mounts or spatial data changes
  useEffect(() => {
    if (spatialData && isVisible) {
      const validation = planGenerationService.validateSpatialData(spatialData);
      setValidationResult(validation);
      
      if (!validation.isValid) {
        setGenerationState('error');
        setError('Insufficient spatial data for plan generation');
      }
    }
  }, [spatialData, isVisible]);

  // Handle plan generation
  const handleGeneratePlan = useCallback(async () => {
    if (!spatialData || generationState === 'generating') return;

    try {
      setGenerationState('generating');
      setError(null);
      setProgress({ stage: 'initializing', message: 'Starting plan generation...' });

      // Generate the plan
      const result = await planGenerationService.generatePlantationPlan(
        spatialData,
        null, // No additional context for now
        (progressUpdate) => {
          setProgress(progressUpdate);
        }
      );

      if (result.success) {
        setGeneratedPlan(result.plan);
        setGenerationState('completed');
        setProgress({ stage: 'completed', message: 'Plan generated successfully!' });
        
        // Show preview modal automatically
        setTimeout(() => {
          setShowPreview(true);
        }, 1000);
        
        // Notify parent component
        if (onPlanGenerated) {
          onPlanGenerated(result.plan);
        }
      } else {
        throw new Error(result.error || 'Plan generation failed');
      }

    } catch (error) {
      console.error('Plan generation error:', error);
      setError(error.message);
      setGenerationState('error');
      setProgress({ stage: 'error', message: error.message, error: true });
    }
  }, [spatialData, generationState, onPlanGenerated]);

  // Handle showing preview modal
  const handleShowPreview = useCallback(() => {
    setShowPreview(true);
  }, []);

  // Handle closing preview modal
  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
  }, []);

  // Handle PDF download
  const handleDownloadPDF = useCallback(async (planId) => {
    // Show success message briefly
    setProgress({ stage: 'downloaded', message: 'PDF downloaded successfully!' });
    setTimeout(() => {
      if (generationState === 'completed') {
        setProgress(null);
      }
    }, 3000);
  }, [generationState]);

  // Handle cancellation
  const handleCancel = useCallback(() => {
    planGenerationService.cancelGeneration();
    setGenerationState('idle');
    setProgress(null);
    setError(null);
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    if (generationState === 'generating') {
      handleCancel();
    }
    
    setGenerationState('idle');
    setProgress(null);
    setError(null);
    setGeneratedPlan(null);
    setShowPreview(false);
    
    if (onClose) {
      onClose();
    }
  }, [generationState, handleCancel, onClose]);

  // Format spatial data summary
  const spatialSummary = spatialData ? planGenerationService.formatSpatialDataSummary(spatialData) : null;

  if (!isVisible) return null;

  return (
    <>
    <div className="plantation-plan-overlay">
      <div className="plantation-plan-modal">
        {/* Header */}
        <div className="plan-header">
          <h2>🌱 Generate 10-Year Plantation Plan</h2>
          <button className="close-button" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="plan-content">
          {/* Location Summary */}
          {spatialSummary && (
            <div className="location-summary">
              <h3>📍 Location Information</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="label">Coordinates:</span>
                  <span className="value">{spatialSummary.location}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Coverage Layers:</span>
                  <span className="value">{spatialSummary.coverageLayers}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Nearby Features:</span>
                  <span className="value">{spatialSummary.nearbyFeatures}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Data Quality:</span>
                  <span className={`value quality-${spatialSummary.dataQuality}`}>
                    {spatialSummary.dataQuality.charAt(0).toUpperCase() + spatialSummary.dataQuality.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Validation Warnings */}
          {validationResult && (validationResult.warnings.length > 0 || validationResult.recommendations.length > 0) && (
            <div className="validation-section">
              {validationResult.warnings.length > 0 && (
                <div className="warnings">
                  <h4>⚠️ Warnings:</h4>
                  <ul>
                    {validationResult.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {validationResult.recommendations.length > 0 && (
                <div className="recommendations">
                  <h4>💡 Recommendations:</h4>
                  <ul>
                    {validationResult.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Plan Features */}
          <div className="plan-features">
            <h3>📋 What Your Plan Will Include:</h3>
            <div className="features-grid">
              <div className="feature-item">
                <span className="icon">🌳</span>
                <span>Species-specific plantation recommendations</span>
              </div>
              <div className="feature-item">
                <span className="icon">📅</span>
                <span>Year-by-year implementation timeline</span>
              </div>
              <div className="feature-item">
                <span className="icon">💰</span>
                <span>Economic analysis and ROI projections</span>
              </div>
              <div className="feature-item">
                <span className="icon">👥</span>
                <span>Employment generation estimates</span>
              </div>
              <div className="feature-item">
                <span className="icon">🦅</span>
                <span>Wildlife and ecosystem impact assessment</span>
              </div>
              <div className="feature-item">
                <span className="icon">📊</span>
                <span>Visual charts and projections</span>
              </div>
              <div className="feature-item">
                <span className="icon">📄</span>
                <span>Professional PDF report (25+ pages)</span>
              </div>
              <div className="feature-item">
                <span className="icon">🎯</span>
                <span>Risk management strategies</span>
              </div>
            </div>
          </div>

          {/* Progress Section */}
          {progress && (
            <div className={`progress-section ${progress.error ? 'error' : ''}`}>
              <div className="progress-content">
                <div className="progress-icon">
                  {progress.stage === 'initializing' && '🔄'}
                  {progress.stage === 'processing' && '🤖'}
                  {progress.stage === 'completed' && '✅'}
                  {progress.stage === 'downloaded' && '📄'}
                  {progress.stage === 'error' && '❌'}
                </div>
                <div className="progress-text">
                  <div className="progress-stage">
                    {progress.stage.charAt(0).toUpperCase() + progress.stage.slice(1)}
                  </div>
                  <div className="progress-message">{progress.message}</div>
                </div>
              </div>
              
              {generationState === 'generating' && progress.stage !== 'error' && (
                <div className="progress-bar">
                  <div className="progress-bar-fill"></div>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && generationState === 'error' && (
            <div className="error-section">
              <h4>❌ Generation Failed</h4>
              <p>{error}</p>
              <p className="error-suggestion">
                Please try clicking on a different location with more available data layers.
              </p>
            </div>
          )}

          {/* Generated Plan Summary */}
          {generatedPlan && generationState === 'completed' && (
            <div className="generated-plan-summary">
              <h3>✅ Plan Generated Successfully!</h3>
              <div className="plan-details">
                <div className="plan-detail">
                  <span className="label">Title:</span>
                  <span className="value">{generatedPlan.title}</span>
                </div>
                <div className="plan-detail">
                  <span className="label">Content Length:</span>
                  <span className="value">{(generatedPlan.content?.length || 0).toLocaleString()} characters</span>
                </div>
                <div className="plan-detail">
                  <span className="label">Generated:</span>
                  <span className="value">
                    {new Date(generatedPlan.generated_at).toLocaleString()}
                  </span>
                </div>
                <div className="plan-detail">
                  <span className="label">Plan ID:</span>
                  <span className="value plan-id">{generatedPlan.plan_id}</span>
                </div>
              </div>
              <div className="preview-hint">
                <p>📋 Your plan is ready! Click "View Plan Preview" to review the content before downloading the PDF.</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="plan-actions">
          {generationState === 'idle' && validationResult?.isValid && (
            <button 
              className="generate-button primary"
              onClick={handleGeneratePlan}
              disabled={!spatialData}
            >
              🌱 Generate 10-Year Plan
            </button>
          )}

          {generationState === 'generating' && (
            <button 
              className="cancel-button secondary"
              onClick={handleCancel}
            >
              ⏹️ Cancel Generation
            </button>
          )}

          {generationState === 'completed' && generatedPlan && (
            <div className="completed-actions">
              <button 
                className="preview-button primary"
                onClick={handleShowPreview}
              >
                👁️ View Plan Preview
              </button>
              <button 
                className="regenerate-button secondary"
                onClick={() => {
                  setGenerationState('idle');
                  setGeneratedPlan(null);
                  setProgress(null);
                  setShowPreview(false);
                }}
              >
                🔄 Generate New Plan
              </button>
            </div>
          )}

          {generationState === 'error' && (
            <button 
              className="retry-button secondary"
              onClick={() => {
                setGenerationState('idle');
                setError(null);
                setProgress(null);
              }}
            >
              🔄 Try Again
            </button>
          )}

          <button 
            className="close-button-bottom secondary"
            onClick={handleClose}
          >
            ✕ Close
          </button>
        </div>

        {/* Disclaimer */}
        <div className="plan-disclaimer">
          <p>
            <small>
              ℹ️ This AI-generated plan is based on available spatial data and Texas agricultural knowledge. 
              Please consult with local agricultural experts before implementation.
            </small>
          </p>
        </div>
      </div>
    </div>

    {/* Preview Modal */}
    <PlanPreviewModal
      planId={generatedPlan?.plan_id}
      isVisible={showPreview}
      onClose={handleClosePreview}
      onDownload={handleDownloadPDF}
    />
    </>
  );
};

export default PlantationPlanGenerator; 