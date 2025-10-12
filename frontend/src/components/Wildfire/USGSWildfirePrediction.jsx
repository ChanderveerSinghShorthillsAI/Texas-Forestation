/**
 * USGS Wildfire Prediction Component
 * Enhanced wildfire forecasting using government USGS WFPI WMS data
 * Modern UI with beautiful styling and comprehensive functionality
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents, Pane } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
    FaArrowLeft, 
    FaSync, 
    FaFire, 
    FaCalendarAlt, 
    FaEye, 
    FaEyeSlash,
    FaMapMarkerAlt,
    FaExclamationTriangle,
    FaTimes,
    FaInfoCircle,
    FaBolt,
    FaWind
} from 'react-icons/fa';
import { MdLayers } from 'react-icons/md';
import usgsWfpiService from '../../services/usgsWfpiService';
import './USGSWildfirePrediction.css';
import { FaSpinner } from 'react-icons/fa';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Texas center coordinates and bounds
const texasCenter = [31.0, -99.0];
const texasBounds = [
    [25.8371, -106.6456], // Southwest corner
    [36.5007, -93.5083]   // Northeast corner
];

/**
 * Build a "world-with-hole" feature from the Texas boundary GeoJSON
 * Creates a mask that darkens everything outside Texas
 */
function buildOutsideTexasMask(texasGeojson) {
  // Handle both FeatureCollection and single Feature formats
  let features = [];
  if (texasGeojson?.type === 'FeatureCollection' && texasGeojson?.features?.length) {
    features = texasGeojson.features;
  } else if (texasGeojson?.type === 'Feature' && texasGeojson?.geometry) {
    features = [texasGeojson];
  } else {
    return null;
  }

  // A world-size outer ring (lon, lat) that encloses the whole map
  const worldRing = [
    [-179.9999, -89.9999],
    [-179.9999,  89.9999],
    [ 179.9999,  89.9999],
    [ 179.9999, -89.9999],
    [-179.9999, -89.9999],
  ];

  // Collect all Texas rings (holes). Works for Polygon and MultiPolygon.
  const texasHoles = [];

  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;

    if (g.type === 'Polygon') {
      const outer = g.coordinates?.[0];
      if (outer && outer.length >= 4) texasHoles.push(outer);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates || []) {
        const outer = poly?.[0];
        if (outer && outer.length >= 4) texasHoles.push(outer);
      }
    }
  }

  if (texasHoles.length === 0) {
    return null;
  }

  // One big polygon: outer = world, inners = all Texas outers (as holes)
  const maskFeature = {
    type: 'Feature',
    properties: { role: 'outside-texas-mask' },
    geometry: {
      type: 'Polygon',
      coordinates: [worldRing, ...texasHoles],
    },
  };
  
  return maskFeature;
}

/**
 * Outside Texas Mask Component
 * Darkens everything outside Texas boundaries
 */
const OutsideTexasMask = ({ texasGeojson, opacity = 0.65 }) => {
  const maskFeature = React.useMemo(() => {
    return buildOutsideTexasMask(texasGeojson);
  }, [texasGeojson]);
  
  if (!maskFeature) {
    return null;
  }

  return (
    <Pane name="outside-texas-mask" style={{ zIndex: 350, pointerEvents: 'none' }}>
      <GeoJSON
        data={maskFeature}
        interactive={false}
        style={{
          stroke: false,
          fillColor: '#000000',
          fillOpacity: opacity,
        }}
      />
    </Pane>
  );
};

/**
 * WMS Layer Component
 */
const WMSLayer = ({ timeValue, isVisible, currentLayer, onLayerReady }) => {
    const map = useMap();
    const layerRef = useRef(null);

    useEffect(() => {
        if (!timeValue) return;

        // Remove existing layer
        if (layerRef.current) {
            map.removeLayer(layerRef.current);
        }

        // Create new layer
        if (isVisible) {
            layerRef.current = usgsWfpiService.createFireLayer(timeValue, currentLayer);
            layerRef.current.addTo(map);
            
            if (onLayerReady) {
                onLayerReady(layerRef.current);
            }
        }

        // Cleanup
        return () => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
            }
        };
    }, [map, timeValue, isVisible, currentLayer, onLayerReady]);

    return null;
};

/**
 * Map Click Handler Component
 */
const MapClickHandler = ({ onMapClick, currentTime }) => {
    useMapEvents({
        click: (e) => {
            console.log('Map clicked at:', e.latlng);
            console.log('Current time:', currentTime);
            console.log('onMapClick function:', !!onMapClick);
            
            if (onMapClick && currentTime) {
                console.log('Calling onMapClick handler');
                onMapClick(e.latlng, currentTime);
            } else {
                console.warn('Missing onMapClick or currentTime');
            }
        }
    });
    return null;
};

/**
 * Texas Bounds Handler Component
 */
const TexasBoundsHandler = ({ texasBoundaryData }) => {
    const map = useMap();

    useEffect(() => {
        if (texasBoundaryData) {
            // Use actual GeoJSON bounds for precise fitting
            const texasLayer = L.geoJSON(texasBoundaryData);
            const bounds = texasLayer.getBounds();
            
            map.fitBounds(bounds, {
                padding: [20, 20],
                maxZoom: 8
            });

            // Set max bounds based on actual Texas geometry with some buffer
            const bufferedBounds = bounds.pad(0.1); // 10% buffer
            map.setMaxBounds(bufferedBounds);
        } else {
            // Fallback to predefined bounds
            map.fitBounds(texasBounds, {
                padding: [20, 20],
                maxZoom: 8
            });

            map.setMaxBounds([
                [23.0, -109.0], // Extended southwest
                [38.0, -91.0]   // Extended northeast
            ]);
        }
    }, [map, texasBoundaryData]);

    return null;
};

/**
 * Texas GeoJSON Boundary Component
 */
const TexasGeoJSONBoundary = ({ texasBoundaryData }) => {
    if (!texasBoundaryData) return null;

    const boundaryStyle = {
        fillColor: "transparent",
        color: "#1e3c72",
        weight: 3,
        opacity: 0.8,
        fillOpacity: 0,
        dashArray: "8, 4"
    };

    return (
        <GeoJSON
            data={texasBoundaryData}
            style={boundaryStyle}
            interactive={false}  // Make boundary non-interactive to allow map clicks
        />
    );
};

/**
 * Main USGS Wildfire Prediction Component
 */
const USGSWildfirePrediction = () => {
    const navigate = useNavigate();
    const mapRef = useRef(null);
    
    // State management
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [availableTimes, setAvailableTimes] = useState([]);
    const [currentTime, setCurrentTime] = useState(null);
    const [isLayerVisible, setIsLayerVisible] = useState(true);
    const [legendUrl, setLegendUrl] = useState(null);
    const [serviceHealth, setServiceHealth] = useState(null);
    const [clickInfo, setClickInfo] = useState(null);
    const [isLoadingClick, setIsLoadingClick] = useState(false);
    const [texasBoundaryData, setTexasBoundaryData] = useState(null);
    const [currentLayer, setCurrentLayer] = useState('wfpi');
    const [availableLayers, setAvailableLayers] = useState([]);

    /**
     * Initialize the component with data
     */
    const initializeComponent = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            console.log('Initializing USGS Fire Prediction component...');
            
            // Load available layers
            const layers = usgsWfpiService.getAvailableLayers();
            setAvailableLayers(layers);
            console.log('Available layers loaded:', layers.map(l => l.name));
            
            // Load Texas boundary GeoJSON, available times, and service health in parallel
            const [boundaryResponse, times, health] = await Promise.all([
                fetch('/default_geojsons/texas.geojson'),
                usgsWfpiService.fetchAvailableTimes(currentLayer),
                usgsWfpiService.checkServiceHealth()
            ]);

            // Process Texas boundary data
            if (boundaryResponse.ok) {
                const boundaryData = await boundaryResponse.json();
                setTexasBoundaryData(boundaryData);
                console.log('Texas boundary GeoJSON loaded successfully');
            } else {
                console.warn('Failed to load Texas boundary GeoJSON');
            }

            setAvailableTimes(times);
            setServiceHealth(health);
            
            // Set default time (first available)
            if (times.length > 0) {
                setCurrentTime(times[0]);
            }

            // Set legend URL for current layer
            setLegendUrl(usgsWfpiService.buildLegendUrl(currentLayer));

            console.log(`USGS Fire Prediction initialized with ${times.length} forecast times for ${currentLayer}`);
        } catch (err) {
            console.error('Failed to initialize USGS Fire Prediction:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [currentLayer]);

    /**
     * Initialize component
     */
    useEffect(() => {
        initializeComponent();
    }, [initializeComponent]);

    /**
     * Handle time selection change
     */
    const handleTimeChange = useCallback((event) => {
        const newTime = event.target.value;
        setCurrentTime(newTime);
        setClickInfo(null); // Clear previous click info
        console.log('Time changed to:', newTime);
    }, []);

    /**
     * Handle layer toggle
     */
    const handleLayerToggle = useCallback(() => {
        setIsLayerVisible(prev => !prev);
        setClickInfo(null); // Clear click info when toggling
    }, []);

    /**
     * Handle layer change
     */
    const handleLayerChange = useCallback(async (layerId) => {
        if (layerId === currentLayer) return;
        
        console.log(`Switching from ${currentLayer} to ${layerId}`);
        setLoading(true);
        setClickInfo(null); // Clear previous click info
        
        try {
            // Update service layer
            usgsWfpiService.setCurrentLayer(layerId);
            setCurrentLayer(layerId);
            
            // Fetch times for new layer
            const times = await usgsWfpiService.fetchAvailableTimes(layerId);
            setAvailableTimes(times);
            
            // Set default time
            if (times.length > 0) {
                setCurrentTime(times[0]);
            }
            
            // Update legend
            setLegendUrl(usgsWfpiService.buildLegendUrl(layerId));
            
            console.log(`Switched to ${layerId} layer with ${times.length} times`);
        } catch (err) {
            console.error('Failed to switch layer:', err);
            setError(`Failed to switch to ${layerId} layer: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [currentLayer]);

    /**
     * Check if coordinates are within Texas bounds using simple bounds check
     */
    const isWithinTexas = (latlng) => {
        // Use simple bounds check for now - more reliable than complex polygon check
        const { lat, lng } = latlng;
        const withinBounds = lat >= texasBounds[0][0] && lat <= texasBounds[1][0] && 
                            lng >= texasBounds[0][1] && lng <= texasBounds[1][1];
        
        console.log('Bounds check details:', {
            clickLat: lat,
            clickLng: lng,
            texasBounds: texasBounds,
            withinBounds: withinBounds
        });
        
        return withinBounds;
    };

    /**
     * Handle map click for feature info
     */
    const handleMapClick = useCallback(async (latlng, timeValue) => {
        console.log('handleMapClick called with:', { latlng, timeValue });
        console.log('mapRef.current:', !!mapRef.current);
        
        if (!mapRef.current) {
            console.warn('No map reference available');
            return;
        }

        // Check if click is within Texas bounds
        console.log('Checking if within Texas bounds...');
        const withinTexas = isWithinTexas(latlng);
        console.log('Within Texas:', withinTexas);
        
        if (!withinTexas) {
            console.log('Click outside Texas bounds');
            setClickInfo({
                success: false,
                error: "Please click within Texas boundaries for wildfire risk data",
                coordinates: latlng,
                time: timeValue,
                outsideTexas: true
            });
            return;
        }

        console.log('Click within Texas, fetching USGS data...');
        setIsLoadingClick(true);
        setClickInfo(null);

        try {
            console.log('Calling USGS service...');
            const result = await usgsWfpiService.fetchFeatureInfo(mapRef.current, latlng, timeValue, currentLayer);
            console.log('USGS result:', result);
            setClickInfo(result);
        } catch (error) {
            console.error('Failed to fetch click info:', error);
            setClickInfo({
                success: false,
                error: error.message,
                coordinates: latlng,
                time: timeValue
            });
        } finally {
            setIsLoadingClick(false);
        }
    }, [texasBoundaryData, currentLayer]);

    /**
     * Handle refresh
     */
    const handleRefresh = useCallback(async () => {
        console.log('Refreshing USGS data and clearing cache...');
        usgsWfpiService.clearCache();
        await initializeComponent();
    }, [initializeComponent]);

    /**
     * Navigate back to main map
     */
    const handleBackToMap = useCallback(() => {
        navigate('/home');
    }, [navigate]);

    /**
     * Format date for display
     */
    const formatDateForDisplay = (isoString) => {
        if (!isoString) return '';
        return isoString.slice(0, 10); // YYYY-MM-DD
    };

    /**
     * Get status color based on service health
     */
    const getStatusColor = (status) => {
        switch (status) {
            case 'online': return '#00ff00';
            case 'degraded': return '#ffff00';
            case 'offline': return '#ff0000';
            default: return '#999999';
        }
    };

    return (
        <div 
            className="usgs-wildfire-prediction"
            style={{
                backgroundImage: `url(${process.env.PUBLIC_URL}/images/wildfire-image-4.png)`
            }}
        >
            {/* Header */}
            <div className="usgs-header">
                <div className="header-content">
                    <div className="header-left">
                        <button 
                            className="back-button"
                            onClick={handleBackToMap}
                            title="Back to Main Map"
                        >
                            <FaArrowLeft /> Back to Main
                        </button>
                        <div className="header-info">
                            <h1><FaFire className="header-icon" /> USGS Wildfire Forecast</h1>
                            <p>Enhanced government wildfire prediction using USGS WFPI data</p>
                        </div>
                    </div>
                    
                    <div className="header-right">
                        {/* <div className="service-status">
                            {serviceHealth && (
                                <div className="status-indicator">
                                    <div 
                                        className="status-dot"
                                        style={{ backgroundColor: getStatusColor(serviceHealth.status) }}
                                    ></div>
                                    <span className="status-text">
                                        Service: {serviceHealth.status}
                                    </span>
                                </div>
                            )}
                        </div> */}
                        
                        <button 
                            className="refresh-button"
                            onClick={handleRefresh}
                            disabled={loading}
                            title="Refresh Data"
                        >
                            <FaSync className={loading ? 'spinning' : ''} /> Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="loading-container">
                <FaSpinner className="loading-spinner-icon" />
                <h2 style={{color: "red", fontSize: "2.5rem", fontWeight: "700", margin: "20px 0 10px 0", textShadow: "2px 2px 4px rgba(0, 0, 0, 0.3)"}}>Texas Forestation</h2>
                    <p className="usgs-loading-subtext">Loading wildfire prediction information</p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="error-container">
                    <div className="error-content">
                        <div className="error-icon"><FaExclamationTriangle /></div>
                        <h2>Unable to Load USGS Data</h2>
                        <p>{error}</p>
                        <button onClick={handleRefresh} className="retry-button">
                            <FaSync /> Retry
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {!loading && !error && (
                <div className="main-content">
                    {/* Top Controls Bar */}
                    <div className="top-controls-bar">
                        <div className="control-item">
                            <label htmlFor="fireDate" className="control-label">
                                <FaCalendarAlt /> Forecast Date
                            </label>
                            <select 
                                id="fireDate" 
                                className="date-select"
                                value={currentTime || ''}
                                onChange={handleTimeChange}
                            >
                                {availableTimes.map(time => (
                                    <option key={time} value={time}>
                                        {formatDateForDisplay(time)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Layer Selection */}
                        <div className="control-item layer-selection">
                            <label className="control-label">
                                <MdLayers /> Prediction Layer
                            </label>
                            <div className="layer-toggle-group">
                                {availableLayers.map(layer => {
                                    // Map layer IDs to appropriate icons
                                    let LayerIcon = FaFire;
                                    if (layer.id === 'wfpi') LayerIcon = FaFire;
                                    else if (layer.id === 'wlfp') LayerIcon = FaBolt;
                                    else if (layer.id === 'wfsp') LayerIcon = FaWind;
                                    
                                    return (
                                        <button
                                            key={layer.id}
                                            className={`layer-toggle-button ${currentLayer === layer.id ? 'active' : ''}`}
                                            onClick={() => handleLayerChange(layer.id)}
                                            title={layer.description}
                                            disabled={loading}
                                        >
                                            <LayerIcon />
                                            <span className="layer-name" style={{color: 'white'}}>{layer.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <button 
                            className={`toggle-button ${isLayerVisible ? 'active' : ''}`}
                            onClick={handleLayerToggle}
                            title="Toggle Fire Layer"
                        >
                            {isLayerVisible ? <><FaEyeSlash /> Hide Layer</> : <><FaEye /> Show Layer</>}
                        </button>
                    </div>

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
                            ref={(mapInstance) => {
                                if (mapInstance) {
                                    mapRef.current = mapInstance;
                                    console.log('🗺️ Map reference set:', !!mapRef.current);
                                }
                            }}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            
                            {/* Blackout outside Texas only (no effect inside) */}
                            {texasBoundaryData && (
                                <OutsideTexasMask 
                                    texasGeojson={texasBoundaryData} 
                                    opacity={0.65} 
                                />
                            )}
                            
                            {/* Texas bounds handler */}
                            <TexasBoundsHandler texasBoundaryData={texasBoundaryData} />
                            
                            {/* Texas GeoJSON boundary */}
                            <TexasGeoJSONBoundary texasBoundaryData={texasBoundaryData} />
                            
                            {currentTime && (
                                <WMSLayer
                                    timeValue={currentTime}
                                    isVisible={isLayerVisible}
                                    currentLayer={currentLayer}
                                />
                            )}

                            <MapClickHandler
                                onMapClick={handleMapClick}
                                currentTime={currentTime}
                            />
                        </MapContainer>

                        {/* Click Info Panel */}
                        {(clickInfo || isLoadingClick) && (
                            <div className="click-info-panel">
                                {isLoadingClick ? (
                                    <div className="click-loading">
                                        <div className="mini-spinner"></div>
                                        <span>Getting wildfire data...</span>
                                    </div>
                                ) : clickInfo.success ? (
                                    <div className="click-success">
                                        <h4><FaFire /> Wildfire Risk Analysis</h4>
                                        <div className="info-row">
                                            <span className="info-label" style={{color: "#FFDA03"}}><FaCalendarAlt /> Date:</span>
                                            <span className="info-value" style={{color: "#00A86B"}}>
                                                {formatDateForDisplay(clickInfo.time)}
                                            </span>
                                        </div>
                                        <div className="info-row">
                                            <span className="info-label" style={{color: "#FFDA03"}}><FaMapMarkerAlt /> Location:</span>
                                            <span className="info-value" style={{color: "#00A86B"}}>
                                                {clickInfo.coordinates.lat.toFixed(4)}, {clickInfo.coordinates.lng.toFixed(4)}
                                            </span>
                                        </div>
                                        <div className="info-row">
                                            <span className="info-label" style={{color: "#FFDA03"}}><FaInfoCircle /> WFPI Value:</span>
                                            <span className="info-value" style={{color: "#00A86B"}}>
                                                {clickInfo.value !== null ? clickInfo.value.toFixed(1) : 'No data'}
                                            </span>
                                        </div>
                                        <div className="info-row">
                                            <span className="info-label" style={{color: "#FFDA03"}}><FaExclamationTriangle /> Risk Level:</span>
                                            <span 
                                                className="info-value risk-level"
                                                style={{ 
                                                    color: clickInfo.interpretation.color,
                                                    fontWeight: 'bold',
                                                    color: "#00A86B"
                                                }}
                                            >
                                                {clickInfo.interpretation.label}
                                            </span>
                                        </div>
                                        <button 
                                            className="close-info-button"
                                            onClick={() => setClickInfo(null)}
                                            title="Close"
                                        >
                                            <FaTimes />
                                        </button>
                                    </div>
                                ) : (
                                    <div className={`click-error ${clickInfo.outsideTexas ? 'texas-boundary-error' : ''}`}>
                                        <h4>{clickInfo.outsideTexas ? <><FaMapMarkerAlt /> Outside Texas</> : <><FaExclamationTriangle /> Error</>}</h4>
                                        <p>{clickInfo.error}</p>
                                        {clickInfo.outsideTexas && (
                                            <div className="texas-hint">
                                                <small><FaInfoCircle /> This tool focuses on Texas wildfire data only</small>
                                            </div>
                                        )}
                                        <button 
                                            className="close-info-button"
                                            onClick={() => setClickInfo(null)}
                                            title="Close"
                                        >
                                            <FaTimes />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Legend - Bottom Right */}
                        {legendUrl && isLayerVisible && (
                            <div className="legend-container">
                                <h3 className="legend-title">
                                    <FaFire /> {availableLayers.find(l => l.id === currentLayer)?.name || 'Fire'} Legend
                                </h3>
                                <img 
                                    src={legendUrl} 
                                    alt="WFPI Legend" 
                                    className="legend-image"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        console.warn('Failed to load legend image');
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default USGSWildfirePrediction;
