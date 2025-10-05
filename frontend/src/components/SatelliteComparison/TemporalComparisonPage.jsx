/**
 * Temporal Satellite Image Comparison Page
 * Compare satellite imagery of the same location at different time periods
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ComparisonViewer from './ComparisonViewer';
import LocationSelector from './LocationSelector';
import DateSelector from './DateSelector';
import ComparisonStats from './ComparisonStats';
import satelliteComparisonService from '../../services/satelliteComparisonService';
import sentinelHubService from '../../services/sentinelHubService';
import './TemporalComparisonPage.css';

const TemporalComparisonPage = () => {
  const navigate = useNavigate();

  // State management
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [date1, setDate1] = useState('');
  const [date2, setDate2] = useState('');
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serviceHealth, setServiceHealth] = useState(null);
  const [step, setStep] = useState(1); // Wizard steps: 1=location, 2=dates, 3=results
  const [imageSource, setImageSource] = useState('sentinel'); // 'sentinel' or 'planet'

  /**
   * Check service health on mount
   */
  useEffect(() => {
    checkServiceHealth();
  }, []);

  const checkServiceHealth = async () => {
    try {
      // Check Sentinel Hub first (preferred)
      try {
        const sentinelHealth = await sentinelHubService.checkHealth();
        if (sentinelHealth.authenticated) {
          setServiceHealth(sentinelHealth);
          setImageSource('sentinel');
          console.log('✅ Using Sentinel Hub for high-quality images');
          return;
        }
      } catch (sentinelError) {
        console.log('⚠️ Sentinel Hub not available, falling back to Planet Labs');
      }
      
      // Fallback to Planet Labs
      const planetHealth = await satelliteComparisonService.checkHealth();
      setServiceHealth(planetHealth);
      setImageSource('planet');
      
      if (!planetHealth.authenticated) {
        setError('Satellite service authentication failed. Please check your API keys.');
      }
    } catch (err) {
      console.error('Health check failed:', err);
      setError('Failed to connect to satellite service');
    }
  };

  /**
   * Handle location selection from map
   */
  const handleLocationSelect = useCallback((location) => {
    console.log('📍 Location selected:', location);
    setSelectedLocation(location);
    setError(null);
    setStep(2); // Move to date selection
  }, []);

  /**
   * Handle date selection
   */
  const handleDateSubmit = useCallback((selectedDate1, selectedDate2) => {
    console.log('📅 Dates selected:', selectedDate1, selectedDate2);
    
    // Validate dates
    const validation = satelliteComparisonService.validateDateRange(selectedDate1, selectedDate2);
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }

    setDate1(selectedDate1);
    setDate2(selectedDate2);
    setError(null);
    
    // Start comparison
    performComparison(selectedLocation, selectedDate1, selectedDate2);
  }, [selectedLocation, imageSource]);

  /**
   * Perform the satellite image comparison
   */
  const performComparison = async (location, d1, d2) => {
    try {
      setLoading(true);
      setError(null);
      setStep(3); // Move to results view

      console.log(`🚀 Starting comparison using ${imageSource}...`);

      let result;
      if (imageSource === 'sentinel') {
        // Use Sentinel Hub for high quality
        result = await sentinelHubService.compareImages(
          location.lat,
          location.lng,
          d1,
          d2,
          0.05
        );
      } else {
        // Fallback to Planet Labs
        result = await satelliteComparisonService.compareImages({
          latitude: location.lat,
          longitude: location.lng,
          date1: d1,
          date2: d2,
          bboxSize: 0.05
        });
      }

      console.log('✅ Comparison complete:', result);
      setComparisonData(imageSource === 'sentinel' ? result : result.comparison);

    } catch (err) {
      console.error('❌ Comparison failed:', err);
      setError(err.message || 'Failed to compare images');
      setStep(2); // Go back to date selection on error
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset the comparison
   */
  const handleReset = () => {
    setSelectedLocation(null);
    setDate1('');
    setDate2('');
    setComparisonData(null);
    setError(null);
    setStep(1);
  };

  /**
   * Go back to previous step
   */
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError(null);
    }
  };

  return (
    <div className="temporal-comparison-page">
      {/* Header */}
      <header className="comparison-header">
        <button 
          className="back-button"
          onClick={() => navigate('/')}
          aria-label="Back to home"
        >
          ← Back
        </button>
        <div className="header-content">
          <h1 className="page-title">
            🛰️ Temporal Satellite Comparison
          </h1>
          <p className="page-subtitle">
            Compare satellite imagery of Texas locations across different time periods
          </p>
        </div>
        {serviceHealth && (
          <div className={`health-indicator ${serviceHealth.authenticated ? 'healthy' : 'error'}`}>
            <span className="health-dot"></span>
            {serviceHealth.authenticated ? 'Connected' : 'Disconnected'}
          </div>
        )}
      </header>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button 
            className="error-close"
            onClick={() => setError(null)}
            aria-label="Close error"
          >
            ×
          </button>
        </div>
      )}

      {/* Progress indicator */}
      <div className="progress-steps">
        <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          <div className="step-number">1</div>
          <div className="step-label">Select Location</div>
        </div>
        <div className="step-connector"></div>
        <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Choose Dates</div>
        </div>
        <div className="step-connector"></div>
        <div className={`step ${step >= 3 ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <div className="step-label">View Comparison</div>
        </div>
      </div>

      {/* Main content */}
      <div className="comparison-content">
        
        {/* Step 1: Location Selection */}
        {step === 1 && (
          <div className="step-container fade-in">
            <div className="step-instructions">
              <h2>📍 Step 1: Select a Location</h2>
              <p>Click anywhere on the Texas map to select a location for comparison</p>
            </div>
            <LocationSelector 
              onLocationSelect={handleLocationSelect}
              selectedLocation={selectedLocation}
            />
          </div>
        )}

        {/* Step 2: Date Selection */}
        {step === 2 && selectedLocation && (
          <div className="step-container fade-in">
            <div className="step-instructions">
              <h2>📅 Step 2: Select Two Dates</h2>
              <p>
                Choose two dates to compare imagery at {' '}
                <strong>
                  ({selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)})
                </strong>
              </p>
            </div>
            <DateSelector
              location={selectedLocation}
              onDateSubmit={handleDateSubmit}
              onBack={handleBack}
            />
          </div>
        )}

        {/* Step 3: Comparison Results */}
        {step === 3 && (
          <div className="results-container fade-in">
            {loading ? (
              <div className="loading-overlay">
                <div className="spinner-large"></div>
                <h3>🛰️ Fetching Satellite Imagery...</h3>
                <p>This may take a few moments</p>
              </div>
            ) : comparisonData ? (
              <>
                <div className="results-header">
                  <div className="results-info">
                    <h2>📊 Comparison Results</h2>
                    <p className="location-info">
                      Location: ({comparisonData.location.latitude.toFixed(4)}, {' '}
                      {comparisonData.location.longitude.toFixed(4)})
                    </p>
                  </div>
                  <button 
                    className="reset-button"
                    onClick={handleReset}
                  >
                    🔄 New Comparison
                  </button>
                </div>

                <ComparisonStats data={comparisonData} />

                <ComparisonViewer data={comparisonData} />
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="comparison-footer">
        <div className="footer-content">
          <div className="footer-info">
            <span className="footer-icon">🛰️</span>
            <span>Powered by Planet Labs satellite imagery</span>
          </div>
          <div className="footer-links">
            <a 
              href="https://www.planet.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="footer-link"
            >
              Learn More
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TemporalComparisonPage;

