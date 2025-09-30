/**
 * Wildfire Prediction Button Component
 * Toggle button for wildfire risk visualization on the map
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './WildfireButton.css';
import wildfireService from '../../services/wildfireService';

const WildfireButton = ({ onToggle, isActive, onDataLoad }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [forecastData, setForecastData] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [isGridSystemEnabled, setIsGridSystemEnabled] = useState(true);
    
    // Full Texas processing states
    const [isFullTexasProcessing, setIsFullTexasProcessing] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(null);
    const [progressInterval, setProgressInterval] = useState(null);

    /**
     * Start progress polling for full Texas processing
     */
    const startProgressPolling = () => {
        if (progressInterval) {
            clearInterval(progressInterval);
        }

        const interval = setInterval(async () => {
            try {
                const progress = await wildfireService.getUpdateProgress();
                setProcessingProgress(progress);
                
                // Check if we've reached full coverage
                if (progress.current_coverage.coverage_percentage >= 100) {
                    clearInterval(interval);
                    setProgressInterval(null);
                    setIsFullTexasProcessing(false);
                    
                    // Reload wildfire data after completion
                    await loadWildfireData();
                }
            } catch (error) {
                console.error('Error polling progress:', error);
                // If backend is down or has server errors, simulate progress for demo purposes
                if (error.message.includes('Failed to fetch') || 
                    error.message.includes('CONNECTION_REFUSED') ||
                    error.message.includes('500') ||
                    error.message.includes('Internal Server Error')) {
                    console.warn('🔥 Backend error detected, switching to demo mode');
                    simulateProgress();
                }
            }
        }, 2000); // Poll every 2 seconds

        setProgressInterval(interval);
    };

    /**
     * Simulate progress when backend is offline (for demo purposes)
     */
    const simulateProgress = () => {
        // Clear any existing intervals
        if (progressInterval) {
            clearInterval(progressInterval);
            setProgressInterval(null);
        }
        
        let currentProgress = 0; // Start from 0 for regional approach
        const totalRegionalCells = 300; // ~300 regional representatives
        
        const progressTimer = setInterval(() => {
            currentProgress += Math.random() * 8 + 2; // Increase by 2-10% each interval (faster for fewer API calls)
            
            if (currentProgress >= 100) {
                currentProgress = 100;
                clearInterval(progressTimer);
                setIsFullTexasProcessing(false);
                
                // Set final progress state
                setProcessingProgress({
                    current_coverage: {
                        cached_predictions: totalRegionalCells,
                        total_grid_cells: totalRegionalCells,
                        coverage_percentage: 100,
                        last_update: new Date().toISOString()
                    },
                    system_status: "completed_simulation",
                    timestamp: new Date().toISOString(),
                    message: "Complete Texas coverage achieved with regional representatives (demo)"
                });
                
                // Load demo data
                loadDemoWildfireData();
                return;
            }
            
            // Update progress
            const cells = Math.floor((currentProgress / 100) * totalRegionalCells);
            setProcessingProgress({
                current_coverage: {
                    cached_predictions: cells,
                    total_grid_cells: totalRegionalCells,
                    coverage_percentage: currentProgress,
                    last_update: new Date().toISOString()
                },
                system_status: "simulating",
                timestamp: new Date().toISOString(),
                message: "Processing regional representatives for complete Texas coverage (demo)"
            });
        }, 1000); // Update every 1 second for faster demo with fewer API calls
    };

    /**
     * Load demo wildfire data when backend is offline
     */
    const loadDemoWildfireData = () => {
        const demoData = {
            success: true,
            statistics: {
                max_risk: 89.2,
                avg_risk: 45.7,
                locations_monitored: 300, // Regional representatives
                high_risk_locations: 85,  // Proportional to regional approach
                forecast_period_days: 7,
                generated_at: new Date().toISOString()
            },
            high_risk_locations: Array.from({length: 50}, (_, i) => ({
                name: `Texas Grid Cell ${1000 + i}`,
                lat: 31.0 + (Math.random() - 0.5) * 8,
                lon: -100.0 + (Math.random() - 0.5) * 12,
                max_risk: 60 + Math.random() * 30,
                avg_risk: 40 + Math.random() * 25
            })),
            metadata: {
                data_source: "Demo Mode - Regional Representatives (Backend Offline)",
                grid_based: true,
                total_grid_cells: 300,
                approach: "regional_representatives",
                api_efficiency: "99% reduction in API calls while maintaining full Texas coverage"
            }
        };

        setForecastData(demoData);
        setLastUpdate(new Date());

        // Process data for map visualization
        const mapData = wildfireService.processForMapVisualization(demoData);
        
        // Notify parent component
        if (onDataLoad) {
            onDataLoad({
                rawData: demoData,
                mapData: mapData,
                statistics: demoData.statistics,
                highRiskLocations: demoData.high_risk_locations
            });
        }
    };

    /**
     * Stop progress polling
     */
    const stopProgressPolling = () => {
        if (progressInterval) {
            clearInterval(progressInterval);
            setProgressInterval(null);
        }
        setIsFullTexasProcessing(false);
    };

    /**
     * Load wildfire forecast data with full Texas coverage
     */
    const loadWildfireData = async (forecastDays = 7) => {
        setLoading(true);
        setError(null);

        try {
            console.log('🔥 Loading Texas wildfire forecast...');
            const data = await wildfireService.getTexasForecast(forecastDays);
            
            if (data.success) {
                setForecastData(data);
                setLastUpdate(new Date());
                
                // Process data for map visualization
                const mapData = wildfireService.processForMapVisualization(data);
                
                // Notify parent component with the processed data
                if (onDataLoad) {
                    onDataLoad({
                        rawData: data,
                        mapData: mapData,
                        statistics: data.statistics,
                        highRiskLocations: data.high_risk_locations
                    });
                }
                
                console.log(`✅ Loaded wildfire data: ${data.high_risk_locations.length} high-risk locations`);
            } else {
                throw new Error('Invalid response from wildfire service');
            }
        } catch (err) {
            console.error('❌ Error loading wildfire data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handle button toggle - now triggers full Texas processing
     */
    const handleToggle = async () => {
        const newActiveState = !isActive;
        
        if (newActiveState) {
            // Start full Texas processing
            await startFullTexasProcessing();
        } else {
            // Stop any ongoing processing
            stopProgressPolling();
        }
        
        if (onToggle) {
            onToggle(newActiveState);
        }
    };

    /**
     * Start full Texas processing with progress tracking
     */
    const startFullTexasProcessing = async () => {
        try {
            setIsFullTexasProcessing(true);
            setError(null);
            
            console.log('🔥 Starting FULL Texas wildfire processing...');
            
            // Check if backend is reachable first
            try {
                const result = await wildfireService.triggerFullTexasUpdate();
                console.log('🔥 Full Texas update started:', result);
                
                // Start progress polling
                startProgressPolling();
            } catch (backendError) {
                console.warn('🔥 Backend error detected, starting demo mode:', backendError.message);
                
                // Show appropriate error message based on error type
                if (backendError.message.includes('500') || backendError.message.includes('Internal Server Error')) {
                    setError("Backend server error - Running demo simulation");
                } else {
                    setError("Backend offline - Running demo simulation");
                }
                
                // Start simulation immediately
                simulateProgress();
            }
            
        } catch (err) {
            console.error('🔥 Error starting full Texas processing:', err);
            setError(err.message);
            setIsFullTexasProcessing(false);
        }
    };

    /**
     * Refresh data
     */
    const handleRefresh = async () => {
        if (!loading) {
            await loadWildfireData();
        }
    };

    /**
     * Navigate to dedicated wildfire prediction page
     */
    const handleViewDetails = () => {
        navigate('/wildfire-prediction');
    };

    /**
     * Get status info for display
     */
    const getStatusInfo = () => {
        if (loading || isFullTexasProcessing) {
            if (isFullTexasProcessing && processingProgress) {
                const percentage = processingProgress.current_coverage?.coverage_percentage || 0;
                const { cached_predictions, total_grid_cells } = processingProgress.current_coverage;
                const isRegionalApproach = total_grid_cells <= 500; // Regional approach uses ~300 cells
                const isDemo = processingProgress.system_status === "simulating" || 
                              processingProgress.system_status === "completed_simulation" ||
                              processingProgress.system_status === "fallback_mode";
                
                return { 
                    text: isRegionalApproach 
                        ? `Regional TX ${percentage.toFixed(1)}%`
                        : `Loading ${percentage.toFixed(1)}%`, 
                    icon: '⏳', 
                    color: '#ffa500' 
                };
            }
            return { text: 'Loading...', icon: '⏳', color: '#ffa500' };
        }
        
        if (error) {
            return { text: 'Error', icon: '❌', color: '#ff4444' };
        }
        
        if (forecastData && isActive) {
            const highRiskCount = forecastData.high_risk_locations?.length || 0;
            const isGridBased = forecastData.metadata?.grid_based;
            const totalCells = forecastData.metadata?.total_grid_cells || processingProgress?.current_coverage?.total_grid_cells || 26824;
            const currentCells = processingProgress?.current_coverage?.cached_predictions || highRiskCount;
            const isDemoMode = forecastData.metadata?.data_source?.includes('Demo Mode');
            const isRegionalApproach = totalCells <= 500; // Regional approach uses ~300 cells
            
            return { 
                text: isRegionalApproach 
                    ? `${currentCells}/${totalCells} Regions (Full TX)${isDemoMode ? ' [Demo]' : ''}`
                    : `${currentCells}/${totalCells} Cells${isGridBased ? ' (Full TX)' : ''}${isDemoMode ? ' [Demo]' : ''}`, 
                icon: '🔥', 
                color: highRiskCount > 0 ? '#ff4444' : '#44ff44' 
            };
        }
        
        return { text: 'Full Texas Risk', icon: '🔥', color: '#666666' };
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopProgressPolling();
        };
    }, []);

    const status = getStatusInfo();

    return (
        <div className="wildfire-button-container">
            <button
                className={`wildfire-button ${isActive ? 'active' : ''} ${(loading || isFullTexasProcessing) ? 'loading' : ''}`}
                onClick={handleToggle}
                disabled={loading || isFullTexasProcessing}
                title="Full Texas wildfire risk prediction (100% coverage)"
            >
                <div className="button-content">
                    <span className="button-icon">{status.icon}</span>
                    <span className="button-text">{status.text}</span>
                    {(loading || isFullTexasProcessing) && <div className="loading-spinner"></div>}
                </div>
                
                {/* Progress Bar for Full Texas Processing */}
                {isFullTexasProcessing && processingProgress && (
                    <div className="progress-bar-container">
                        <div 
                            className="progress-bar"
                            style={{ 
                                width: `${Math.min(100, Math.max(0, processingProgress.current_coverage?.coverage_percentage || 0))}%`,
                                backgroundColor: status.color
                            }}
                        ></div>
                    </div>
                )}
                
                <div 
                    className="status-indicator" 
                    style={{ backgroundColor: status.color }}
                ></div>
            </button>

            {/* Action buttons when active */}
            {isActive && !loading && !isFullTexasProcessing && (
                <div className="action-buttons">
                    <button
                        className="refresh-button"
                        onClick={handleRefresh}
                        title="Refresh wildfire data"
                    >
                        🔄
                    </button>
                    <button
                        className="details-button"
                        onClick={handleViewDetails}
                        title="View detailed wildfire analysis"
                    >
                        📊
                    </button>
                </div>
            )}

            {/* Processing Status when running full Texas analysis */}
            {isFullTexasProcessing && processingProgress && (
                <div className="processing-status">
                    <div className="processing-text">
                        {(() => {
                            const { total_grid_cells } = processingProgress.current_coverage;
                            const isRegionalApproach = total_grid_cells <= 500; // Regional approach uses ~300 cells
                            const percentage = processingProgress.current_coverage?.coverage_percentage?.toFixed(1) || 0;
                            
                            return isRegionalApproach 
                                ? `Processing Texas Regions: ${percentage}%`
                                : `Processing Full Texas: ${percentage}%`;
                        })()}
                    </div>
                    <div className="processing-details">
                        {(() => {
                            const { cached_predictions, total_grid_cells } = processingProgress.current_coverage;
                            const isRegionalApproach = total_grid_cells <= 500;
                            
                            return isRegionalApproach
                                ? `${cached_predictions || 0} / ${total_grid_cells || 300} regional representatives`
                                : `${cached_predictions || 0} / ${total_grid_cells || 26824} cells`;
                        })()}
                    </div>
                </div>
            )}

            {/* Last update info */}
            {lastUpdate && isActive && (
                <div className="last-update">
                    Updated: {lastUpdate.toLocaleTimeString()}
                </div>
            )}

            {/* Error display */}
            {error && (
                <div className="error-message" title={error}>
                    ⚠️ {error.length > 30 ? error.substring(0, 30) + '...' : error}
                </div>
            )}

            {/* Statistics when active */}
            {forecastData && isActive && !loading && (
                <div className="wildfire-stats">
                    <div className="stat-item">
                        <span className="stat-label">Max Risk:</span>
                        <span 
                            className="stat-value"
                            style={{ color: wildfireService.getRiskColor(forecastData.statistics.max_risk) }}
                        >
                            {forecastData.statistics.max_risk}%
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Locations:</span>
                        <span className="stat-value">
                            {forecastData.statistics.locations_monitored}
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">High Risk:</span>
                        <span className="stat-value risk-count">
                            {forecastData.statistics.high_risk_locations}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WildfireButton;
