/**
 * Wildfire Prediction Page
 * Dedicated page for comprehensive wildfire risk analysis and forecasting
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import WildfireLayer from '../Map/WildfireLayer';
import WildfireControlPanel from '../UI/WildfireControlPanel';
import wildfireService from '../../services/wildfireService';
import './WildfirePredictionPage.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Texas center coordinates
const texasCenter = [31.0, -99.0];

const WildfirePredictionPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [forecastData, setForecastData] = useState(null);
    const [mapData, setMapData] = useState(null);
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [showControlPanel, setShowControlPanel] = useState(true);
    const [healthStatus, setHealthStatus] = useState(null);

    /**
     * Load initial wildfire data
     */
    useEffect(() => {
        loadWildfireData();
        checkServiceHealth();
    }, []);

    /**
     * Load wildfire forecast data
     */
    const loadWildfireData = async () => {
        setLoading(true);
        setError(null);

        try {
            console.log('🔥 Loading Texas wildfire forecast...');
            const data = await wildfireService.getTexasForecast(7);
            
            if (data.success) {
                setForecastData(data);
                const processedMapData = wildfireService.processForMapVisualization(data);
                setMapData(processedMapData);
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
     * Check service health
     */
    const checkServiceHealth = async () => {
        try {
            const health = await wildfireService.checkHealth();
            setHealthStatus(health);
        } catch (err) {
            console.warn('Service health check failed:', err);
        }
    };

    /**
     * Handle location selection
     */
    const handleLocationSelect = (location) => {
        setSelectedPoint(location);
    };

    /**
     * Handle refresh
     */
    const handleRefresh = async () => {
        await loadWildfireData();
    };

    /**
     * Navigate back to main map
     */
    const handleBackToMap = () => {
        navigate('/texas-forestation-planner');
    };

    return (
        <div className="wildfire-prediction-page">
            {/* Header */}
            <div className="page-header">
                <div className="header-content">
                    <div className="header-left">
                        <button 
                            className="back-button"
                            onClick={handleBackToMap}
                            title="Back to Main Map"
                        >
                            ← Back to Map
                        </button>
                        <div className="header-info">
                            <h1>🔥 Texas Wildfire Risk Prediction</h1>
                            <p>Real-time wildfire risk assessment and 7-day forecasting</p>
                        </div>
                    </div>
                    
                    <div className="header-right">
                        <div className="header-stats">
                            {forecastData && (
                                <>
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
                                        <span className="stat-label">High Risk Areas:</span>
                                        <span className="stat-value">
                                            {forecastData.statistics.high_risk_locations}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                        
                        <button 
                            className="refresh-button"
                            onClick={handleRefresh}
                            disabled={loading}
                            title="Refresh Data"
                        >
                            {loading ? '⏳' : '🔄'} Refresh
                        </button>
                        
                        <button 
                            className="panel-toggle-button"
                            onClick={() => setShowControlPanel(!showControlPanel)}
                            title="Toggle Control Panel"
                        >
                            {showControlPanel ? '📊 Hide Panel' : '📊 Show Panel'}
                        </button>
                    </div>
                </div>
                
                {/* Status Bar */}
                <div className="status-bar">
                    {healthStatus && (
                        <div className="status-item">
                            <span className="status-icon">🟢</span>
                            <span>Service: {healthStatus.status}</span>
                        </div>
                    )}
                    {forecastData && (
                        <div className="status-item">
                            <span className="status-icon">📡</span>
                            <span>Monitoring: {forecastData.statistics.locations_monitored} locations</span>
                        </div>
                    )}
                    {forecastData && (
                        <div className="status-item">
                            <span className="status-icon">📅</span>
                            <span>Forecast: {forecastData.statistics.forecast_period_days} days</span>
                        </div>
                    )}
                    <div className="status-item">
                        <span className="status-icon">🕒</span>
                        <span>Updated: {new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="loading-overlay">
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <h2>Loading Wildfire Data</h2>
                        <p>Fetching real-time risk assessments from 20 Texas locations...</p>
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="error-container">
                    <div className="error-content">
                        <div className="error-icon">⚠️</div>
                        <h2>Unable to Load Wildfire Data</h2>
                        <p>{error}</p>
                        <button onClick={handleRefresh} className="retry-button">
                            🔄 Retry
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {!loading && !error && (
                <div className="page-content">
                    {/* Map Container */}
                    <div className="map-container">
                        <MapContainer
                            center={texasCenter}
                            zoom={6}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={true}
                            scrollWheelZoom={true}
                            doubleClickZoom={true}
                            dragging={true}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            
                            {mapData && (
                                <WildfireLayer
                                    wildfireData={mapData}
                                    isVisible={true}
                                    onLocationClick={handleLocationSelect}
                                    opacity={0.9}
                                />
                            )}
                        </MapContainer>

                        {/* Map Overlay Info */}
                        <div className="map-overlay">
                            <div className="legend">
                                <h3>🔥 Risk Levels</h3>
                                <div className="legend-items">
                                    <div className="legend-item">
                                        <div className="legend-color" style={{ backgroundColor: '#00ff00' }}></div>
                                        <span>Low (0-19%)</span>
                                    </div>
                                    <div className="legend-item">
                                        <div className="legend-color" style={{ backgroundColor: '#ffff00' }}></div>
                                        <span>Moderate (20-39%)</span>
                                    </div>
                                    <div className="legend-item">
                                        <div className="legend-color" style={{ backgroundColor: '#ff8000' }}></div>
                                        <span>High (40-59%)</span>
                                    </div>
                                    <div className="legend-item">
                                        <div className="legend-color" style={{ backgroundColor: '#ff0000' }}></div>
                                        <span>Very High (60-79%)</span>
                                    </div>
                                    <div className="legend-item">
                                        <div className="legend-color" style={{ backgroundColor: '#8b0000' }}></div>
                                        <span>Extreme (80-100%)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Control Panel */}
                    <WildfireControlPanel
                        isVisible={showControlPanel}
                        onClose={() => setShowControlPanel(false)}
                        selectedPoint={selectedPoint}
                        onLocationSelect={handleLocationSelect}
                        mapData={mapData}
                    />
                </div>
            )}
        </div>
    );
};

export default WildfirePredictionPage;
