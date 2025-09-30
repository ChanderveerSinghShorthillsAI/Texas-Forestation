/**
 * Wildfire Control Panel Component
 * Advanced controls and visualization for wildfire risk assessment
 */
import React, { useState, useEffect, useCallback } from 'react';
import './WildfireControlPanel.css';
import wildfireService from '../../services/wildfireService';

const WildfireControlPanel = ({ 
    isVisible, 
    onClose, 
    selectedPoint, 
    onLocationSelect,
    mapData 
}) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [forecastDays, setForecastDays] = useState(7);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [texasForecast, setTexasForecast] = useState(null);
    const [pointRisk, setPointRisk] = useState(null);
    const [riskCategories, setRiskCategories] = useState(null);
    const [monitoringLocations, setMonitoringLocations] = useState(null);

    /**
     * Load initial data when panel opens
     */
    useEffect(() => {
        if (isVisible) {
            loadInitialData();
        }
    }, [isVisible]);

    /**
     * Load point-specific data when a point is selected
     */
    useEffect(() => {
        if (selectedPoint && isVisible) {
            console.log('🔥 WildfireControlPanel: Loading point risk for:', selectedPoint);
            loadPointRisk(selectedPoint.lat, selectedPoint.lon);
            // Automatically switch to point analysis tab when a point is selected
            setActiveTab('point-analysis');
        }
    }, [selectedPoint, isVisible, forecastDays]);

    /**
     * Load all initial data
     */
    const loadInitialData = async () => {
        setLoading(true);
        setError(null);

        try {
            const [forecastData, categoriesData, locationsData] = await Promise.all([
                wildfireService.getTexasForecast(forecastDays),
                wildfireService.getRiskCategories(),
                wildfireService.getTexasLocations()
            ]);

            setTexasForecast(forecastData);
            setRiskCategories(categoriesData);
            setMonitoringLocations(locationsData);
        } catch (err) {
            console.error('Error loading wildfire data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Load risk data for a specific point
     */
    const loadPointRisk = async (lat, lon) => {
        console.log('🔥 Loading point risk for coordinates:', lat, lon);
        setPointRisk(null); // Clear previous data
        setError(null); // Clear previous errors
        
        try {
            const riskData = await wildfireService.getPointRisk(lat, lon, forecastDays);
            console.log('🔥 Received point risk data:', riskData);
            
            if (riskData && riskData.success) {
                const formattedData = wildfireService.formatRiskData(riskData);
                console.log('🔥 Formatted point risk data:', formattedData);
                setPointRisk(formattedData);
            } else {
                throw new Error(riskData?.error || 'Invalid response format');
            }
        } catch (err) {
            console.error('🔥 Error loading point risk:', err);
            setError(`Failed to load risk data for selected location: ${err.message}`);
        }
    };

    /**
     * Handle forecast days change
     */
    const handleForecastDaysChange = useCallback(async (days) => {
        setForecastDays(days);
        setLoading(true);
        
        try {
            const forecastData = await wildfireService.getTexasForecast(days);
            setTexasForecast(forecastData);
            
            if (selectedPoint) {
                await loadPointRisk(selectedPoint.lat, selectedPoint.lon);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedPoint]);

    /**
     * Handle location selection from monitoring locations
     */
    const handleLocationClick = (location) => {
        if (onLocationSelect) {
            onLocationSelect({
                lat: location.latitude,
                lon: location.longitude,
                name: location.name
            });
        }
    };

    /**
     * Render overview tab
     */
    const renderOverviewTab = () => (
        <div className="tab-content overview-tab">
            <div className="section">
                <h3>🔥 Texas Wildfire Risk Overview</h3>
                
                {texasForecast && texasForecast.statistics && (
                    <div className="overview-stats">
                        <div className="stat-grid">
                            <div className="stat-card max-risk">
                                <div className="stat-header">
                                    <span className="stat-icon">🌡️</span>
                                    <span className="stat-title">Maximum Risk</span>
                                </div>
                                <div className="stat-value">
                                    {texasForecast.statistics.max_risk || 0}%
                                </div>
                                <div className="stat-subtitle">
                                    {wildfireService.getRiskLevel(texasForecast.statistics.max_risk || 0)}
                                </div>
                            </div>
                            
                            <div className="stat-card avg-risk">
                                <div className="stat-header">
                                    <span className="stat-icon">📊</span>
                                    <span className="stat-title">Average Risk</span>
                                </div>
                                <div className="stat-value">
                                    {texasForecast.statistics.avg_risk || 0}%
                                </div>
                                <div className="stat-subtitle">
                                    {wildfireService.getRiskLevel(texasForecast.statistics.avg_risk || 0)}
                                </div>
                            </div>
                            
                            <div className="stat-card high-risk-count">
                                <div className="stat-header">
                                    <span className="stat-icon">⚠️</span>
                                    <span className="stat-title">High Risk Areas</span>
                                </div>
                                <div className="stat-value">
                                    {texasForecast.statistics.high_risk_locations || 0}
                                </div>
                                <div className="stat-subtitle">
                                    of {texasForecast.statistics.locations_monitored || 0} monitored
                                </div>
                            </div>
                            
                            <div className="stat-card forecast-period">
                                <div className="stat-header">
                                    <span className="stat-icon">📅</span>
                                    <span className="stat-title">Forecast Period</span>
                                </div>
                                <div className="stat-value">
                                    {texasForecast.statistics.forecast_period_days || 7}
                                </div>
                                <div className="stat-subtitle">days ahead</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Forecast Days Selector */}
                <div className="forecast-controls">
                    <label htmlFor="forecast-days">Forecast Period:</label>
                    <select
                        id="forecast-days"
                        value={forecastDays}
                        onChange={(e) => handleForecastDaysChange(parseInt(e.target.value))}
                        disabled={loading}
                    >
                        <option value={3}>3 days</option>
                        <option value={5}>5 days</option>
                        <option value={7}>7 days</option>
                        <option value={10}>10 days</option>
                        <option value={14}>14 days</option>
                        <option value={16}>16 days</option>
                    </select>
                </div>
            </div>
        </div>
    );

    /**
     * Render high risk locations tab
     */
    const renderHighRiskTab = () => (
        <div className="tab-content high-risk-tab">
            <div className="section">
                <h3>⚠️ High Risk Locations</h3>
                
                {texasForecast?.high_risk_locations && texasForecast.high_risk_locations.length > 0 ? (
                    <div className="risk-locations-list">
                        {texasForecast.high_risk_locations.map((location, index) => (
                            <div 
                                key={index}
                                className="risk-location-item"
                                onClick={() => handleLocationClick(location)}
                            >
                                <div className="location-header">
                                    <h4>{location.name}</h4>
                                    <div 
                                        className="risk-badge"
                                        style={{ 
                                            backgroundColor: wildfireService.getRiskColor(location.max_risk),
                                            color: location.max_risk > 60 ? 'white' : 'black'
                                        }}
                                    >
                                        {location.max_risk}%
                                    </div>
                                </div>
                                
                                <div className="location-details">
                                    <div className="detail-item">
                                        <span>Max Risk:</span>
                                        <span>{location.max_risk}% ({wildfireService.getRiskLevel(location.max_risk)})</span>
                                    </div>
                                    <div className="detail-item">
                                        <span>Avg Risk:</span>
                                        <span>{location.avg_risk}%</span>
                                    </div>
                                    <div className="detail-item">
                                        <span>Coordinates:</span>
                                        <span>{location.lat.toFixed(4)}, {location.lon.toFixed(4)}</span>
                                    </div>
                                </div>
                                
                                <div className="location-description">
                                    {wildfireService.getRiskDescription(location.max_risk)}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-high-risk">
                        <div className="no-risk-icon">✅</div>
                        <p>No high-risk locations detected in the current forecast period.</p>
                        <p>All monitored areas are showing low to moderate fire risk.</p>
                    </div>
                )}
            </div>
        </div>
    );

    /**
     * Render point analysis tab
     */
    const renderPointAnalysisTab = () => (
        <div className="tab-content point-analysis-tab">
            <div className="section">
                <h3>📍 Point Analysis</h3>
                
                {selectedPoint ? (
                    <div className="point-analysis">
                        <div className="point-header">
                            <h4>🎯 Selected Location</h4>
                            <div className="coordinates">
                                📍 {selectedPoint.lat.toFixed(6)}, {selectedPoint.lon.toFixed(6)}
                            </div>
                            {selectedPoint.name && (
                                <div className="location-name">🏙️ {selectedPoint.name}</div>
                            )}
                            <div className="selection-status">
                                ✅ Location selected - analyzing risk...
                            </div>
                        </div>

                        {pointRisk ? (
                            <div className="point-risk-analysis">
                                <div className="risk-summary">
                                    <div 
                                        className="risk-score"
                                        style={{ 
                                            backgroundColor: pointRisk.color,
                                            color: pointRisk.maxRisk > 60 ? 'white' : 'black'
                                        }}
                                    >
                                        {pointRisk.maxRisk}%
                                    </div>
                                    <div className="risk-category">{pointRisk.category}</div>
                                </div>

                                <div className="risk-details">
                                    <div className="detail-row">
                                        <span>Average Risk:</span>
                                        <span>{pointRisk.avgRisk}%</span>
                                    </div>
                                    <div className="detail-row">
                                        <span>Forecast Period:</span>
                                        <span>{pointRisk.forecastDays} days</span>
                                    </div>
                                    <div className="detail-row">
                                        <span>Total Hours:</span>
                                        <span>{pointRisk.totalHours}</span>
                                    </div>
                                </div>

                                <div className="risk-description">
                                    {wildfireService.getRiskDescription(pointRisk.maxRisk)}
                                </div>

                                {/* Peak Risk Periods */}
                                {pointRisk.peakPeriods && pointRisk.peakPeriods.length > 0 && (
                                    <div className="peak-periods">
                                        <h5>🔥 Peak Risk Periods</h5>
                                        <div className="periods-list">
                                            {pointRisk.peakPeriods.slice(0, 3).map((period, index) => (
                                                <div key={index} className="period-item">
                                                    <div className="period-time">
                                                        {new Date(period.time).toLocaleString()}
                                                    </div>
                                                    <div className="period-details">
                                                        <span className="risk-value">{period.risk_score}%</span>
                                                        <span className="temp-value">{period.temperature}°C</span>
                                                        <span className="wind-value">{period.wind_speed} km/h</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Category Distribution */}
                                {pointRisk.categoryDistribution && (
                                    <div className="category-distribution">
                                        <h5>📊 Risk Distribution</h5>
                                        <div className="distribution-chart">
                                            {Object.entries(pointRisk.categoryDistribution).map(([category, count]) => (
                                                <div key={category} className="distribution-item">
                                                    <span className="category-name">{category}</span>
                                                    <div className="category-bar">
                                                        <div 
                                                            className="bar-fill"
                                                            style={{ 
                                                                width: `${(count / pointRisk.totalHours) * 100}%`,
                                                                backgroundColor: wildfireService.getRiskColor(
                                                                    category === 'Low' ? 10 :
                                                                    category === 'Moderate' ? 30 :
                                                                    category === 'High' ? 50 :
                                                                    category === 'Very High' ? 70 : 90
                                                                )
                                                            }}
                                                        ></div>
                                                    </div>
                                                    <span className="category-count">{count}h</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="loading-point-data">
                                <div className="loading-spinner"></div>
                                <p>Loading risk analysis for selected point...</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="no-point-selected">
                        <div className="no-point-icon">🎯</div>
                        <p>Click on the map to analyze wildfire risk for a specific location.</p>
                        <p>You can also select from the monitoring locations in the other tabs.</p>
                    </div>
                )}
            </div>
        </div>
    );

    /**
     * Render monitoring locations tab
     */
    const renderLocationsTab = () => (
        <div className="tab-content locations-tab">
            <div className="section">
                <h3>📍 Monitoring Locations</h3>
                
                {monitoringLocations && (
                    <div className="locations-info">
                        <p>
                            Monitoring {monitoringLocations.total_locations} locations across Texas 
                            for comprehensive wildfire risk assessment.
                        </p>
                        
                        <div className="locations-grid">
                            {monitoringLocations.locations.map((location, index) => (
                                <div 
                                    key={index}
                                    className="location-card"
                                    onClick={() => handleLocationClick(location)}
                                >
                                    <div className="location-name">{location.name}</div>
                                    <div className="location-coords">
                                        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    if (!isVisible) return null;

    return (
        <div className="wildfire-control-panel">
            <div className="panel-header">
                <h2>🔥 Wildfire Risk Assessment</h2>
                <button className="close-button" onClick={onClose}>✕</button>
            </div>

            {loading && (
                <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                    <p>Loading wildfire data...</p>
                </div>
            )}

            {error && (
                <div className="error-banner">
                    <span className="error-icon">⚠️</span>
                    <span className="error-text">{error}</span>
                    <button onClick={() => setError(null)}>✕</button>
                </div>
            )}

            <div className="panel-tabs">
                <button 
                    className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    📊 Overview
                </button>
                <button 
                    className={`tab-button ${activeTab === 'high-risk' ? 'active' : ''}`}
                    onClick={() => setActiveTab('high-risk')}
                >
                    ⚠️ High Risk
                </button>
                <button 
                    className={`tab-button ${activeTab === 'point-analysis' ? 'active' : ''}`}
                    onClick={() => setActiveTab('point-analysis')}
                >
                    📍 Point Analysis
                </button>
                <button 
                    className={`tab-button ${activeTab === 'locations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('locations')}
                >
                    🗺️ Locations
                </button>
            </div>

            <div className="panel-content">
                {activeTab === 'overview' && renderOverviewTab()}
                {activeTab === 'high-risk' && renderHighRiskTab()}
                {activeTab === 'point-analysis' && renderPointAnalysisTab()}
                {activeTab === 'locations' && renderLocationsTab()}
            </div>
        </div>
    );
};

export default WildfireControlPanel;
