/**
 * USGS WFPI WMS Service
 * Handles integration with USGS Wildfire Potential Index (WFPI) WMS service
 * Government API for enhanced wildfire forecasting in Texas
 */

import L from 'leaflet';

// ===== CONFIG =====
const DEFAULT_VIEW = [31.0, -99.0]; // center on Texas
const DEFAULT_ZOOM = 6;

// Multiple USGS Fire Danger Layers
const FIRE_LAYERS = {
    WFPI: {
        id: 'wfpi',
        name: 'Wildfire Potential Index',
        description: 'Overall wildfire potential assessment',
        wmsBase: "https://dmsdata.cr.usgs.gov/geoserver/firedanger_wfpi-forecast-1_conus_day_data/wms",
        layerName: "wfpi-forecast-1_conus_day_data",
        color: '#ff6b35',
        icon: '🔥'
    },
    WLFP: {
        id: 'wlfp',
        name: 'Large Fire Probability',
        description: 'Probability of large fire occurrence',
        wmsBase: "https://dmsdata.cr.usgs.gov/geoserver/firedanger_wlfp-forecast-1_conus_day_data/wms",
        layerName: "wlfp-forecast-1_conus_day_data",
        color: '#ff8c00',
        icon: '🔥'
    },
    WFSP: {
        id: 'wfsp',
        name: 'Fire Spread Probability',
        description: 'Probability of fire spread conditions',
        wmsBase: "https://dmsdata.cr.usgs.gov/geoserver/firedanger_wfsp-forecast-1_conus_day_data/wms",
        layerName: "wfsp-forecast-1_conus_day_data",
        color: '#dc143c',
        icon: '🔥'
    }
};

class USGSWfpiService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes cache for WMS data
        this.currentLayer = 'wfpi'; // Default layer
    }

    /**
     * Get available fire layers
     */
    getAvailableLayers() {
        return Object.values(FIRE_LAYERS);
    }

    /**
     * Get current active layer
     */
    getCurrentLayer() {
        return FIRE_LAYERS[this.currentLayer.toUpperCase()];
    }

    /**
     * Set active layer
     */
    setCurrentLayer(layerId) {
        const upperLayerId = layerId.toUpperCase();
        if (FIRE_LAYERS[upperLayerId]) {
            this.currentLayer = layerId.toLowerCase();
            console.log(`🔥 Switched to layer: ${FIRE_LAYERS[upperLayerId].name}`);
            return true;
        }
        return false;
    }

    /**
     * Get layer configuration by ID
     */
    getLayerConfig(layerId = null) {
        const targetLayer = layerId ? layerId.toUpperCase() : this.currentLayer.toUpperCase();
        return FIRE_LAYERS[targetLayer] || FIRE_LAYERS.WFPI;
    }

    /**
     * Create WMS layer for Leaflet
     */
    createFireLayer(timeValue, layerId = null) {
        const layerConfig = this.getLayerConfig(layerId);
        
        // Use version 1.1.1 here to simplify GetFeatureInfo usage (x,y parameters).
        return L.tileLayer.wms(layerConfig.wmsBase, {
            layers: layerConfig.layerName,
            format: 'image/png',
            transparent: true,
            version: '1.1.1',
            time: timeValue,          // ISO datetime string, e.g. "2025-09-30T00:00:00Z"
            attribution: `USGS EROS ${layerConfig.name}`,
            opacity: 0.7
        });
    }

    /**
     * Build legend URL
     */
    buildLegendUrl(layerId = null) {
        const layerConfig = this.getLayerConfig(layerId);
        
        // GeoServer GetLegendGraphic standard call
        const params = new URLSearchParams({
            REQUEST: 'GetLegendGraphic',
            VERSION: '1.0.0',
            FORMAT: 'image/png',
            LAYER: layerConfig.layerName,
            // optional: STYLE: 'someStyle'
        });
        return layerConfig.wmsBase + "?" + params.toString();
    }

    /**
     * Parse time dimension from GetCapabilities XML
     */
    parseTimeDimensionFromGetCaps(xmlText, layerId = null) {
        const layerConfig = this.getLayerConfig(layerId);
        console.log(`🔍 Parsing GetCapabilities XML for ${layerConfig.name}...`);
        
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, "application/xml");

        // find the <Layer> element whose <Name> equals the target layer name
        const layerEls = Array.from(xml.getElementsByTagName('Layer'));
        console.log(`🔍 Found ${layerEls.length} layers in GetCapabilities`);
        
        let targetLayer = null;
        for (const l of layerEls) {
            const nameEl = l.getElementsByTagName('Name')[0];
            if (nameEl) {
                const layerName = nameEl.textContent.trim();
                console.log(`🔍 Checking layer: ${layerName}`);
                if (layerName === layerConfig.layerName) {
                    targetLayer = l;
                    console.log(`✅ Found target layer: ${layerConfig.layerName}`);
                    break;
                }
            }
        }
        if (!targetLayer) {
            console.warn(`❌ Target layer "${layerConfig.layerName}" not found in GetCapabilities`);
            return null;
        }

        // Try Dimension first, then Extent
        let dim = Array.from(targetLayer.getElementsByTagName('Dimension')).find(d => d.getAttribute('name') === 'time');
        if (!dim) dim = Array.from(targetLayer.getElementsByTagName('Extent')).find(e => e.getAttribute('name') === 'time');

        if (!dim) {
            console.warn('❌ No time dimension found in target layer');
            return null;
        }
        
        const raw = dim.textContent.trim();
        console.log('🕒 Raw time dimension data:', raw);

        // If raw contains '/', it's start/stop/period; otherwise comma-separated list.
        if (raw.includes('/')) {
            // e.g. start/stop/period style. We'll extract start & end and build daily array.
            // Example: 2025-01-01T00:00:00Z/2025-12-31T00:00:00Z/P1D
            try {
                const [start, end, period] = raw.split('/');
                // If period is P1D -> daily; implement simple daily iterator (UTC)
                if (period && period.toUpperCase().includes('P1D')) {
                    const dates = [];
                    let cur = new Date(start);
                    const endDate = new Date(end);
                    while (cur <= endDate) {
                        // format to ISO date-time: yyyy-mm-ddT00:00:00Z
                        const iso = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate())).toISOString();
                        dates.push(iso);
                        cur.setUTCDate(cur.getUTCDate() + 1);
                    }
                    return dates;
                }
            } catch (e) { /* fallback below */ }
        }

        // else: comma-separated
        return raw.split(',').map(s => s.trim()).filter(Boolean);
    }

    /**
     * Build GetFeatureInfo URL
     */
    getFeatureInfoUrl(map, latlng, timeValue, layerId = null) {
        const layerConfig = this.getLayerConfig(layerId);
        
        // Build a WMS GetFeatureInfo URL using WMS 1.1.1 (x,y)
        const size = map.getSize();
        const bounds = map.getBounds();
        // BBOX order for 1.1.1 with SRS=EPSG:4326 is lon,lat
        const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

        const point = map.latLngToContainerPoint(latlng);
        const params = {
            REQUEST: 'GetFeatureInfo',
            SERVICE: 'WMS',
            VERSION: '1.1.1',       // using 1.1.1 => use X,Y (lon-lat bbox)
            SRS: 'EPSG:4326',
            BBOX: bbox,
            WIDTH: size.x,
            HEIGHT: size.y,
            LAYERS: layerConfig.layerName,
            QUERY_LAYERS: layerConfig.layerName,
            INFO_FORMAT: 'application/json',
            X: Math.round(point.x),
            Y: Math.round(point.y)
        };
        if (timeValue) params['time'] = timeValue;
        return layerConfig.wmsBase + "?" + new URLSearchParams(params).toString();
    }

    /**
     * Interpret WFPI value to human-readable label
     */
    interpretValueToLabel(val) {
        // WFPI values typically range from 0-100
        if (val === null || val === undefined || isNaN(val)) return { label: "No data", class: "nodata", color: "#999999" };
        const v = Number(val);
        if (v <= 20) return { label: "Low", class: "low", color: "#00ff00" };
        if (v <= 40) return { label: "Moderate", class: "moderate", color: "#ffff00" };
        if (v <= 60) return { label: "High", class: "high", color: "#ff8000" };
        if (v <= 80) return { label: "Very High", class: "very-high", color: "#ff0000" };
        return { label: "Extreme", class: "extreme", color: "#8b0000" };
    }

    /**
     * Fetch GetCapabilities and parse available times
     */
    async fetchAvailableTimes(layerId = null) {
        const layerConfig = this.getLayerConfig(layerId);
        const cacheKey = `getcapabilities_${layerConfig.id}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            console.log(`🔥 Using cached GetCapabilities data for ${layerConfig.name}`);
            return cached.data;
        }

        try {
            console.log(`🔥 Fetching USGS ${layerConfig.name} GetCapabilities...`);
            const getcapsUrl = layerConfig.wmsBase + "?service=WMS&version=1.3.0&request=GetCapabilities";
            const response = await fetch(getcapsUrl);
            const capabilitiesText = await response.text();
            
            const times = this.parseTimeDimensionFromGetCaps(capabilitiesText, layerId);
            let timeOptions = [];
            
            if (times && times.length) {
                console.log('🕒 Times from USGS GetCapabilities:', times);
                
                // Filter out old dates and only use recent/future dates
                const now = new Date();
                const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                
                const recentTimes = times.filter(time => {
                    const timeDate = new Date(time);
                    return timeDate >= oneYearAgo;
                });
                
                console.log('🕒 Filtered recent times:', recentTimes);
                
                if (recentTimes.length > 0) {
                    // Sort times in descending order (newest first)
                    timeOptions = recentTimes.sort((a, b) => new Date(b) - new Date(a));
                    console.log('✅ Using recent USGS times (newest first):', timeOptions);
                } else {
                    console.warn('⚠️ No recent times found in USGS data, using current dates');
                    timeOptions = this.generateCurrentDates();
                }
            } else {
                console.warn('⚠️ No times from GetCapabilities, using current dates');
                timeOptions = this.generateCurrentDates();
            }

            // Cache the result
            this.cache.set(cacheKey, {
                data: timeOptions,
                timestamp: Date.now()
            });

            console.log(`🔥 Found ${timeOptions.length} available forecast times for ${layerConfig.name}:`, timeOptions);
            return timeOptions;
        } catch (error) {
            console.error('🔥 Failed to fetch GetCapabilities:', error);
            // Return current dates as fallback
            return this.generateCurrentDates();
        }
    }

    /**
     * Generate current and future dates for wildfire forecasting
     */
    generateCurrentDates() {
        const d0 = new Date();
        const currentDates = [];
        
        // Generate today and next 6 days
        for (let i = 0; i < 7; i++) {
            const d = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate() + i));
            currentDates.push(d.toISOString());
        }
        
        console.log('📅 Generated current dates:', currentDates);
        return currentDates;
    }

    /**
     * Fetch feature info for a clicked location
     */
    async fetchFeatureInfo(map, latlng, timeValue, layerId = null) {
        const layerConfig = this.getLayerConfig(layerId);
        
        try {
            const url = this.getFeatureInfoUrl(map, latlng, timeValue, layerId);
            console.log(`🔥 Fetching ${layerConfig.name} feature info from URL:`, url);
            
            const response = await fetch(url);
            console.log('📡 Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ GetFeatureInfo failed:', response.status, errorText);
                throw new Error(`GetFeatureInfo failed: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            console.log('📊 Raw response data:', data);
            
            // Extract value from response
            let value = null;
            if (data && data.features && data.features.length > 0) {
                console.log('✅ Found features in response:', data.features.length);
                const props = data.features[0].properties;
                console.log('🔍 Feature properties:', props);
                
                // get first numeric property
                for (const k in props) {
                    const v = props[k];
                    if (v !== null && !isNaN(Number(v))) { 
                        value = Number(v);
                        console.log(`✅ Found numeric value: ${k} = ${value}`);
                        break; 
                    }
                }
            } else if (data && data.bands) {
                // some raster responses
                value = data.bands[0].stats?.min ?? null;
                console.log('✅ Found raster value:', value);
            } else {
                console.warn('⚠️ No features or bands found in response');
            }

            const interpreted = this.interpretValueToLabel(value);
            console.log('🎯 Interpreted result:', { value, interpretation: interpreted });
            
            return {
                success: true,
                value: value,
                interpretation: interpreted,
                coordinates: latlng,
                time: timeValue
            };
        } catch (error) {
            console.error('🔥 GetFeatureInfo error:', error);
            return {
                success: false,
                error: error.message,
                coordinates: latlng,
                time: timeValue
            };
        }
    }

    /**
     * Get service health status
     */
    async checkServiceHealth() {
        try {
            const layerConfig = this.getCurrentLayer();
            const response = await fetch(layerConfig.wmsBase + "?service=WMS&version=1.3.0&request=GetCapabilities", {
                method: 'HEAD'
            });
            return {
                status: response.ok ? 'online' : 'degraded',
                responseTime: Date.now(),
                message: response.ok ? `USGS ${layerConfig.name} service is operational` : 'Service may be experiencing issues'
            };
        } catch (error) {
            return {
                status: 'offline',
                responseTime: Date.now(),
                message: 'Unable to connect to USGS service',
                error: error.message
            };
        }
    }

    /**
     * Get default configuration
     */
    getDefaultConfig() {
        const layerConfig = this.getCurrentLayer();
        return {
            center: DEFAULT_VIEW,
            zoom: DEFAULT_ZOOM,
            wmsBase: layerConfig.wmsBase,
            layerName: layerConfig.layerName,
            currentLayer: layerConfig
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🔥 USGS WFPI service cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            timeout: this.cacheTimeout
        };
    }
}

// Create and export singleton instance
const usgsWfpiService = new USGSWfpiService();
export default usgsWfpiService;
