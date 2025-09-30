/**
 * USGS Wildfire Prediction Button Component
 * Navigation button for enhanced government wildfire forecasting
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './USGSWildfireButton.css';
import usgsWfpiService from '../../services/usgsWfpiService';

const USGSWildfireButton = () => {
    const navigate = useNavigate();
    const [serviceHealth, setServiceHealth] = useState(null);
    const [loading, setLoading] = useState(false);
    const [availableTimes, setAvailableTimes] = useState([]);

    /**
     * Check service health on component mount
     */
    useEffect(() => {
        checkServiceHealth();
        fetchAvailableTimes();
    }, []);

    /**
     * Check USGS service health
     */
    const checkServiceHealth = async () => {
        try {
            const health = await usgsWfpiService.checkServiceHealth();
            setServiceHealth(health);
        } catch (error) {
            console.warn('USGS service health check failed:', error);
            setServiceHealth({
                status: 'offline',
                message: 'Unable to connect to USGS service'
            });
        }
    };

    /**
     * Fetch available forecast times
     */
    const fetchAvailableTimes = async () => {
        setLoading(true);
        try {
            const times = await usgsWfpiService.fetchAvailableTimes();
            setAvailableTimes(times);
        } catch (error) {
            console.warn('Failed to fetch available times:', error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Navigate to USGS wildfire prediction page
     */
    const handleNavigate = () => {
        navigate('/usgs-wildfire-prediction');
    };

    /**
     * Get status color based on service health
     */
    const getStatusColor = () => {
        if (!serviceHealth) return '#999999';
        switch (serviceHealth.status) {
            case 'online': return '#00ff00';
            case 'degraded': return '#ffff00';
            case 'offline': return '#ff0000';
            default: return '#999999';
        }
    };

    /**
     * Get status icon based on service health
     */
    const getStatusIcon = () => {
        if (loading) return '⏳';
        if (!serviceHealth) return '🏛️';
        switch (serviceHealth.status) {
            case 'online': return '🏛️';
            case 'degraded': return '⚠️';
            case 'offline': return '❌';
            default: return '🏛️';
        }
    };

    /**
     * Get button text based on status
     */
    const getButtonText = () => {
        if (loading) return 'Connecting...';
        if (!serviceHealth) return 'USGS Forecast';
        
        switch (serviceHealth.status) {
            case 'online': 
                return `USGS Forecast (${availableTimes.length} days)`;
            case 'degraded': 
                return 'USGS Forecast (Limited)';
            case 'offline': 
                return 'USGS Forecast (Offline)';
            default: 
                return 'USGS Forecast';
        }
    };

    return (
        <div className="usgs-wildfire-button-container">
            <button
                className={`usgs-wildfire-button ${serviceHealth?.status || 'unknown'}`}
                onClick={handleNavigate}
                disabled={loading}
                title="Enhanced wildfire prediction using USGS government data"
            >
                <div className="button-content">
                    <span className="button-icon">{getStatusIcon()}</span>
                    <span className="button-text">{getButtonText()}</span>
                    {loading && <div className="loading-spinner"></div>}
                </div>
                
                <div 
                    className="status-indicator" 
                    style={{ backgroundColor: getStatusColor() }}
                ></div>
            </button>

            {/* Service Status Info */}
            {serviceHealth && (
                <div className="service-info">
                    <div className="service-status">
                        <span className="status-dot" style={{ backgroundColor: getStatusColor() }}></span>
                        <span className="status-text">
                            USGS Service: {serviceHealth.status}
                        </span>
                    </div>
                    
                    {availableTimes.length > 0 && (
                        <div className="forecast-info">
                            📅 {availableTimes.length} forecast days available
                        </div>
                    )}
                </div>
            )}

            {/* Enhanced Features Badge */}
            <div className="enhanced-badge">
                <span className="badge-icon">⭐</span>
                <span className="badge-text">Enhanced Gov Data</span>
            </div>
        </div>
    );
};

export default USGSWildfireButton;
