/**
 * Wildfire Layer Component
 * Renders wildfire risk data on the map
 */
import React, { useEffect, useState, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const WildfireLayer = ({ 
    wildfireData, 
    isVisible, 
    onLocationClick,
    opacity = 0.8 
}) => {
    const map = useMap();
    const layerGroupRef = useRef(null);
    const [currentData, setCurrentData] = useState(null);

    /**
     * Create custom wildfire risk icon
     */
    const createWildfireIcon = (riskScore, size = 'medium') => {
        const sizeConfig = {
            small: { iconSize: [20, 20], fontSize: '10px' },
            medium: { iconSize: [30, 30], fontSize: '12px' },
            large: { iconSize: [40, 40], fontSize: '14px' }
        };

        const config = sizeConfig[size] || sizeConfig.medium;
        const color = getWildfireColor(riskScore);
        const textColor = riskScore > 60 ? 'white' : 'black';

        return L.divIcon({
            className: 'wildfire-risk-marker',
            html: `
                <div style="
                    width: ${config.iconSize[0]}px;
                    height: ${config.iconSize[1]}px;
                    background: ${color};
                    border: 2px solid rgba(255, 255, 255, 0.8);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: ${config.fontSize};
                    font-weight: bold;
                    color: ${textColor};
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                    animation: wildfirePulse 2s infinite;
                ">
                    ${Math.round(riskScore)}%
                </div>
                <style>
                    @keyframes wildfirePulse {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.1); opacity: 0.8; }
                    }
                </style>
            `,
            iconSize: config.iconSize,
            iconAnchor: [config.iconSize[0] / 2, config.iconSize[1] / 2],
            popupAnchor: [0, -config.iconSize[1] / 2]
        });
    };

    /**
     * Get wildfire risk color based on score
     */
    const getWildfireColor = (score) => {
        if (score < 20) return '#00ff00';
        if (score < 40) return '#ffff00';
        if (score < 60) return '#ff8000';
        if (score < 80) return '#ff0000';
        return '#8b0000';
    };

    /**
     * Get risk level text
     */
    const getRiskLevel = (score) => {
        if (score < 20) return 'Low';
        if (score < 40) return 'Moderate';
        if (score < 60) return 'High';
        if (score < 80) return 'Very High';
        return 'Extreme';
    };

    /**
     * Get risk description
     */
    const getRiskDescription = (score) => {
        const level = getRiskLevel(score);
        const descriptions = {
            'Low': 'Minimal fire danger. Normal precautions apply.',
            'Moderate': 'Some fire danger. Be cautious with outdoor activities.',
            'High': 'High fire danger. Avoid outdoor burning and use extreme caution.',
            'Very High': 'Very high fire danger. No outdoor burning. Consider evacuation planning.',
            'Extreme': 'Extreme fire danger. Emergency protocols. Be prepared for immediate evacuation.'
        };
        return descriptions[level] || 'Unknown risk level';
    };

    /**
     * Create popup content for wildfire location
     */
    const createPopupContent = (location) => {
        const riskLevel = getRiskLevel(location.properties.max_risk);
        const riskColor = getWildfireColor(location.properties.max_risk);
        const description = getRiskDescription(location.properties.max_risk);

        return `
            <div class="wildfire-popup">
                <div class="popup-header" style="
                    background: linear-gradient(135deg, ${riskColor}aa, ${riskColor}cc);
                    color: ${location.properties.max_risk > 60 ? 'white' : 'black'};
                    padding: 12px;
                    margin: -12px -16px 12px -16px;
                    border-radius: 8px 8px 0 0;
                    text-align: center;
                ">
                    <h3 style="margin: 0; font-size: 18px;">🔥 ${location.name}</h3>
                    <div style="
                        display: inline-block;
                        background: rgba(255, 255, 255, 0.2);
                        padding: 4px 12px;
                        border-radius: 20px;
                        margin-top: 8px;
                        font-weight: bold;
                        font-size: 14px;
                    ">
                        ${location.properties.max_risk}% - ${riskLevel}
                    </div>
                </div>
                
                <div class="popup-content" style="padding: 8px 0;">
                    <div class="risk-details" style="
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        margin-bottom: 12px;
                    ">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #666;">Maximum Risk:</span>
                            <span style="font-weight: bold; color: ${riskColor};">
                                ${location.properties.max_risk}%
                            </span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #666;">Average Risk:</span>
                            <span style="font-weight: bold;">
                                ${location.properties.avg_risk}%
                            </span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #666;">Risk Level:</span>
                            <span style="font-weight: bold; color: ${riskColor};">
                                ${riskLevel}
                            </span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #666;">Coordinates:</span>
                            <span style="font-family: monospace; font-size: 12px;">
                                ${location.coordinates[1].toFixed(4)}, ${location.coordinates[0].toFixed(4)}
                            </span>
                        </div>
                    </div>
                    
                    <div class="risk-description" style="
                        background: #f5f5f5;
                        padding: 10px;
                        border-radius: 6px;
                        border-left: 4px solid ${riskColor};
                        font-size: 13px;
                        line-height: 1.4;
                        color: #333;
                    ">
                        <strong>⚠️ ${riskLevel} Risk:</strong><br>
                        ${description}
                    </div>
                    
                    <div class="popup-actions" style="
                        margin-top: 12px;
                        display: flex;
                        gap: 8px;
                    ">
                        <button 
                            onclick="wildfireLayerAnalyzePoint(${location.coordinates[1]}, ${location.coordinates[0]}, '${location.name}')"
                            style="
                                background: linear-gradient(135deg, #ff6b35, #ff8a65);
                                color: white;
                                border: none;
                                padding: 8px 12px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 12px;
                                font-weight: 500;
                                flex: 1;
                            "
                            onmouseover="this.style.background='linear-gradient(135deg, #ff8a65, #ffab91)'"
                            onmouseout="this.style.background='linear-gradient(135deg, #ff6b35, #ff8a65)'"
                        >
                            📊 Detailed Analysis
                        </button>
                    </div>
                </div>
            </div>
            
            <style>
                .wildfire-popup {
                    min-width: 280px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .wildfire-popup .leaflet-popup-content-wrapper {
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                }
            </style>
        `;
    };

    /**
     * Create heat map style visualization for broader areas
     */
    const createHeatMapLayer = (data) => {
        if (!data || data.length === 0) return null;

        const heatPoints = data.map(location => [
            location.coordinates[1], // lat
            location.coordinates[0], // lon
            location.properties.max_risk / 100 // intensity (0-1)
        ]);

        // Create a simple heat map using circles
        const heatLayer = L.layerGroup();

        data.forEach(location => {
            const circle = L.circle(
                [location.coordinates[1], location.coordinates[0]],
                {
                    radius: Math.max(5000, location.properties.max_risk * 500), // Radius based on risk
                    fillColor: getWildfireColor(location.properties.max_risk),
                    color: getWildfireColor(location.properties.max_risk),
                    weight: 1,
                    opacity: 0.3,
                    fillOpacity: 0.2
                }
            );

            circle.addTo(heatLayer);
        });

        return heatLayer;
    };

    /**
     * Add wildfire data to map
     */
    useEffect(() => {
        if (!map || !wildfireData || !isVisible) {
            if (layerGroupRef.current) {
                map.removeLayer(layerGroupRef.current);
                layerGroupRef.current = null;
            }
            return;
        }

        // Remove existing layer
        if (layerGroupRef.current) {
            map.removeLayer(layerGroupRef.current);
        }

        // Create new layer group
        const layerGroup = L.layerGroup();
        
        // Add heat map layer first (background)
        const heatLayer = createHeatMapLayer(wildfireData);
        if (heatLayer) {
            layerGroup.addLayer(heatLayer);
        }

        // Add individual markers
        wildfireData.forEach(location => {
            const marker = L.marker(
                [location.coordinates[1], location.coordinates[0]],
                {
                    icon: createWildfireIcon(
                        location.properties.max_risk,
                        location.properties.max_risk > 70 ? 'large' : 'medium'
                    ),
                    opacity: opacity
                }
            );

            // Add popup
            const popupContent = createPopupContent(location);
            marker.bindPopup(popupContent, {
                maxWidth: 320,
                className: 'wildfire-popup-container'
            });

            // Add click handler
            marker.on('click', (e) => {
                if (onLocationClick) {
                    onLocationClick({
                        lat: location.coordinates[1],
                        lon: location.coordinates[0],
                        name: location.name,
                        risk: location.properties.max_risk,
                        properties: location.properties
                    });
                }
            });

            layerGroup.addLayer(marker);
        });

        // Add layer to map
        layerGroup.addTo(map);
        layerGroupRef.current = layerGroup;
        setCurrentData(wildfireData);

        // Make analyze function globally available for popup buttons
        window.wildfireLayerAnalyzePoint = (lat, lon, name) => {
            if (onLocationClick) {
                onLocationClick({
                    lat: lat,
                    lon: lon,
                    name: name,
                    fromPopup: true
                });
            }
        };

        return () => {
            if (layerGroupRef.current) {
                map.removeLayer(layerGroupRef.current);
            }
            // Clean up global function
            if (window.wildfireLayerAnalyzePoint) {
                delete window.wildfireLayerAnalyzePoint;
            }
        };
    }, [map, wildfireData, isVisible, opacity, onLocationClick]);

    /**
     * Handle opacity changes
     */
    useEffect(() => {
        if (layerGroupRef.current && currentData) {
            layerGroupRef.current.eachLayer(layer => {
                if (layer.setOpacity) {
                    layer.setOpacity(opacity);
                }
                if (layer.setStyle) {
                    layer.setStyle({ opacity: opacity * 0.3, fillOpacity: opacity * 0.2 });
                }
            });
        }
    }, [opacity, currentData]);

    /**
     * Fit map bounds to wildfire data
     */
    useEffect(() => {
        if (map && wildfireData && wildfireData.length > 0 && isVisible) {
            const bounds = L.latLngBounds(
                wildfireData.map(location => [
                    location.coordinates[1],
                    location.coordinates[0]
                ])
            );
            
            // Only fit bounds if there are multiple points or if requested
            if (wildfireData.length > 1) {
                map.fitBounds(bounds, { 
                    padding: [20, 20],
                    maxZoom: 8 
                });
            }
        }
    }, [map, wildfireData, isVisible]);

    // This component doesn't render anything directly
    return null;
};

export default WildfireLayer;
