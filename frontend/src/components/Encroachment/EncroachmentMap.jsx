// import React, { useEffect, useRef, useState, useCallback } from 'react';
// import L from 'leaflet';
// import 'leaflet/dist/leaflet.css';
// import './EncroachmentMap.css';

// // Fix for default markers in Leaflet
// delete L.Icon.Default.prototype._getIconUrl;
// L.Icon.Default.mergeOptions({
//   iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
//   iconUrl: require('leaflet/dist/images/marker-icon.png'),
//   shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
// });

// const EncroachmentMap = ({ 
//   alerts = [], 
//   selectedAlert, 
//   onAlertSelect, 
//   loading = false 
// }) => {
//   const mapRef = useRef(null);
//   const mapInstanceRef = useRef(null);
//   const markersLayerRef = useRef(null);
//   const isUnmountingRef = useRef(false);
//   const [performanceStats, setPerformanceStats] = useState({
//     renderTime: 0,
//     markerCount: 0
//   });

//   // Clean markers cleanup function
//   const clearMarkers = useCallback(() => {
//     if (markersLayerRef.current && mapInstanceRef.current) {
//       mapInstanceRef.current.removeLayer(markersLayerRef.current);
//       markersLayerRef.current = null;
//     }
//   }, []);

//   // Texas bounds
//   const texasBounds = [
//     [25.8371, -106.6456], // Southwest corner
//     [36.5007, -93.5083]   // Northeast corner
//   ];

//   // Confidence level icons
//   const confidenceIcons = {
//     high: '🔴',
//     nominal: '🟡',
//     low: '🟢'
//   };


//   /**
//    * Initialize map for canvas rendering
//    */
//   useEffect(() => {
//     if (!mapRef.current || mapInstanceRef.current) return;

//     // Create map instance
//     const map = L.map(mapRef.current, {
//       center: [31.9686, -99.9018], // Center of Texas
//       zoom: 6,
//       zoomControl: true,
//       attributionControl: true
//     });

//     // Add tile layer
//     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//       attribution: '© OpenStreetMap contributors',
//       maxZoom: 18
//     }).addTo(map);

//     // Set Texas bounds
//     map.setMaxBounds(texasBounds);
//     map.setMinZoom(5);

//     // Add Texas outline
//     const texasOutline = L.rectangle(texasBounds, {
//       color: '#667eea',
//       weight: 3,
//       fillColor: 'transparent',
//       fillOpacity: 0,
//       dashArray: '10, 10'
//     }).addTo(map);

//     mapInstanceRef.current = map;

//     return () => {
//       // Set unmounting flag to prevent further operations
//       isUnmountingRef.current = true;
      
//       // Clear markers
//       clearMarkers();
      
//       if (mapInstanceRef.current) {
//         mapInstanceRef.current.remove();
//         mapInstanceRef.current = null;
//       }
//     };
//   }, [clearMarkers]);

//   /**
//    * High-performance canvas marker rendering
//    */
//   useEffect(() => {
//     console.log("🔎 Guard check", {
//       hasMap: !!mapInstanceRef.current,
//       isUnmounting: isUnmountingRef.current,
//       alertsCount: alerts?.length || 0
//     });

//     if (!mapInstanceRef.current || isUnmountingRef.current) {
//       console.log("⏭️ Skipping render - map not ready/unmounting");
//       return;
//     }

//     // Clear old markers
//     clearMarkers();

//     if (!alerts.length) {
//       setPerformanceStats({ renderTime: 0, markerCount: 0 });
//       return;
//     }

//     const startTime = performance.now();
//     const markersLayer = L.layerGroup();

//     const batchSize = 500;
//     let processed = 0;

//     const processBatch = () => {
//       const batch = alerts.slice(processed, processed + batchSize);

//       batch.forEach((alert, batchIndex) => {
//         const globalIndex = processed + batchIndex;
//         const isSelected = selectedAlert && 
//           selectedAlert.latitude === alert.latitude && 
//           selectedAlert.longitude === alert.longitude;

//         const marker = L.circleMarker([alert.latitude, alert.longitude], {
//           radius: isSelected ? 8 : 5,
//           fillColor: isSelected ? '#ffffff' : 
//             alert.confidence === 'high' ? '#dc3545' : 
//             alert.confidence === 'nominal' ? '#ffc107' : '#28a745',
//           color: isSelected ? '#000000' : '#ffffff',
//           weight: isSelected ? 2 : 1,
//           opacity: 1,
//           fillOpacity: 0.8
//         });

//         // Add popup with alert details
//         marker.bindPopup(`
//           <div class="encroachment-popup">
//             <div class="popup-header">
//               <span class="confidence-badge ${alert.confidence}">
//                 ${confidenceIcons[alert.confidence]} ${alert.confidence.toUpperCase()}
//               </span>
//             </div>
//             <div class="popup-content">
//               <div class="popup-field">
//                 <strong>Date:</strong> ${alert.date}
//               </div>
//               <div class="popup-field">
//                 <strong>Location:</strong> ${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}
//               </div>
//               <div class="popup-field">
//                 <strong>Alert ID:</strong> ${alert.alert_id || 'N/A'}
//               </div>
//             </div>
//             <div class="popup-actions">
//               <button class="popup-button" onclick="window.focusAlert(${globalIndex})">
//                 📍 Focus
//               </button>
//             </div>
//           </div>
//         `, {
//           maxWidth: 300,
//           className: 'encroachment-popup-container'
//         });

//         // Add click handler for alert selection
//         marker.on('click', () => {
//           onAlertSelect(alert);
//         });

//         markersLayer.addLayer(marker);
//       });

//       processed += batchSize;
//       if (processed < alerts.length) {
//         requestAnimationFrame(processBatch);
//       } else {
//         markersLayer.addTo(mapInstanceRef.current);
//         markersLayerRef.current = markersLayer;

//         const time = performance.now() - startTime;
//         setPerformanceStats({ renderTime: time, markerCount: alerts.length });
//         console.log(`✅ Rendered ${alerts.length} markers in ${time.toFixed(2)}ms`);

//         // Global focus function for popup buttons
//         window.focusAlert = (index) => {
//           if (alerts[index]) {
//             onAlertSelect(alerts[index]);
//             mapInstanceRef.current.setView([alerts[index].latitude, alerts[index].longitude], 15);
//           }
//         };

//         // Fit map to show all alerts
//         setTimeout(() => {
//           if (alerts.length > 0 && mapInstanceRef.current && !isUnmountingRef.current) {
//             try {
//               const lats = alerts.map(alert => alert.latitude);
//               const lngs = alerts.map(alert => alert.longitude);
              
//               const bounds = L.latLngBounds([
//                 [Math.min(...lats), Math.min(...lngs)],
//                 [Math.max(...lats), Math.max(...lngs)]
//               ]);
              
//               mapInstanceRef.current.fitBounds(bounds.pad(0.1));
//             } catch (error) {
//               console.warn('Error fitting bounds:', error);
//             }
//           }
//         }, 100);
//       }
//     };

//     processBatch();
//   }, [alerts, selectedAlert, onAlertSelect, clearMarkers]);

//   /**
//    * Focus on selected alert
//    */
//   useEffect(() => {
//     if (!mapInstanceRef.current || !selectedAlert || isUnmountingRef.current) return;

//     try {
//       mapInstanceRef.current.setView([selectedAlert.latitude, selectedAlert.longitude], 12);
//     } catch (error) {
//       console.warn('Error focusing on selected alert:', error);
//     }
//   }, [selectedAlert]);

//   // Always render the map container, but show appropriate message when no alerts
//   const hasAlerts = alerts && alerts.length > 0;

//   return (
//     <div className="encroachment-map-container">
//       <div className="map-header">
//         <div className="map-title">
//           <h3>🗺️ Encroachment Alerts Map</h3>
//           <p>
//             {loading ? 'Loading alerts...' : 
//              hasAlerts ? `${alerts.length} alerts displayed with high-performance canvas rendering` : 
//              'No alerts found for the selected criteria'}
//           </p>
//           {hasAlerts && performanceStats.renderTime > 0 && (
//             <small style={{ color: '#6c757d', fontSize: '0.8rem' }}>
//               Rendered in {performanceStats.renderTime.toFixed(0)}ms • 
//               Click any marker for details
//             </small>
//           )}
//         </div>
//         <div className="map-legend">
//           <div className="legend-item">
//             <span className="legend-icon high">🔴</span>
//             <span>High Confidence</span>
//           </div>
//           <div className="legend-item">
//             <span className="legend-icon nominal">🟡</span>
//             <span>Nominal Confidence</span>
//           </div>
//           <div className="legend-item">
//             <span className="legend-icon low">🟢</span>
//             <span>Low Confidence</span>
//           </div>
//         </div>
//       </div>
      
//       <div className="map-content">
//         <div ref={mapRef} className="encroachment-map" />
        
//         {/* Loading overlay */}
//         {loading && (
//           <div className="map-overlay loading-overlay">
//             <div className="overlay-content">
//               <div className="spinner">🔄</div>
//               <p>Loading encroachment data...</p>
//             </div>
//           </div>
//         )}
        
//         {/* No data overlay */}
//         {!loading && !hasAlerts && (
//           <div className="map-overlay no-data-overlay">
//             <div className="overlay-content">
//               <div className="no-data-icon">🔍</div>
//               <h4>No Encroachment Alerts Found</h4>
//               <p>Try adjusting your date range or confidence level filters.</p>
//               <p>The map shows the Texas region where alerts would appear.</p>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default EncroachmentMap;

// import React, { useEffect, useRef, useCallback } from 'react';
// import L from 'leaflet';
// import 'leaflet/dist/leaflet.css';
// import 'leaflet.markercluster/dist/leaflet.markercluster';
// import 'leaflet.markercluster/dist/MarkerCluster.css';
// import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
// import './EncroachmentMap.css';

// // Fix for default markers in Leaflet
// delete L.Icon.Default.prototype._getIconUrl;
// L.Icon.Default.mergeOptions({
//   iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
//   iconUrl: require('leaflet/dist/images/marker-icon.png'),
//   shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
// });

// const EncroachmentMap = ({ 
//   alerts = [], 
//   selectedAlert, 
//   onAlertSelect, 
//   loading = false 
// }) => {
//   const mapRef = useRef(null);
//   const mapInstanceRef = useRef(null);
//   const markersLayerRef = useRef(null);
//   const markerMapRef = useRef({});
//   const prevSelectedRef = useRef(null);
//   const isUnmountingRef = useRef(false);
//   const performanceStatsRef = useRef({
//     renderTime: 0,
//     markerCount: 0
//   });

//   // Clean markers cleanup function
//   const clearMarkers = useCallback(() => {
//     if (markersLayerRef.current && mapInstanceRef.current) {
//       mapInstanceRef.current.removeLayer(markersLayerRef.current);
//       markersLayerRef.current = null;
//     }
//     markerMapRef.current = {};
//   }, []);

//   // Texas bounds
//   const texasBounds = [
//     [25.8371, -106.6456], // Southwest corner
//     [36.5007, -93.5083]   // Northeast corner
//   ];

//   // Confidence level icons
//   const confidenceIcons = {
//     high: '🔴',
//     nominal: '🟡',
//     low: '🟢'
//   };

//   const getFillColor = (confidence, isSelected) => {
//     if (isSelected) return '#ffffff';
//     return confidence === 'high' ? '#dc3545' : 
//            confidence === 'nominal' ? '#ffc107' : '#28a745';
//   };

//   const getStrokeColor = (isSelected) => {
//     return isSelected ? '#000000' : '#ffffff';
//   };

//   const getWeight = (isSelected) => {
//     return isSelected ? 2 : 1;
//   };

//   const getRadius = (isSelected) => {
//     return isSelected ? 8 : 5;
//   };

//   const getMarkerIcon = (alert, isSelected) => {
//     const radius = getRadius(isSelected);
//     const fill = getFillColor(alert.confidence, isSelected);
//     const stroke = getStrokeColor(isSelected);
//     const weight = getWeight(isSelected);
//     return L.divIcon({
//       className: 'custom-encroachment-marker',
//       html: `<div class="marker-container ${alert.confidence} ${isSelected ? 'selected' : ''}">
//                <div class="marker-pulse"></div>
//              </div>`,
//       iconSize: [radius * 2, radius * 2],
//       iconAnchor: [radius, radius],
//       popupAnchor: [0, -radius]
//     });
//   };

//   /**
//    * Initialize map
//    */
//   useEffect(() => {
//     if (!mapRef.current || mapInstanceRef.current) return;

//     // Create map instance
//     const map = L.map(mapRef.current, {
//       center: [31.9686, -99.9018], // Center of Texas
//       zoom: 6,
//       zoomControl: true,
//       attributionControl: true
//     });

//     // Add tile layer
//     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//       attribution: '© OpenStreetMap contributors',
//       maxZoom: 18
//     }).addTo(map);

//     // Set Texas bounds
//     map.setMaxBounds(texasBounds);
//     map.setMinZoom(5);

//     // Add Texas outline
//     const texasOutline = L.rectangle(texasBounds, {
//       color: '#667eea',
//       weight: 3,
//       fillColor: 'transparent',
//       fillOpacity: 0,
//       dashArray: '10, 10'
//     }).addTo(map);

//     mapInstanceRef.current = map;

//     return () => {
//       // Set unmounting flag to prevent further operations
//       isUnmountingRef.current = true;
      
//       // Clear markers
//       clearMarkers();
      
//       if (mapInstanceRef.current) {
//         mapInstanceRef.current.remove();
//         mapInstanceRef.current = null;
//       }
//     };
//   }, [clearMarkers]);

//   /**
//    * High-performance marker rendering with clustering
//    */
//   useEffect(() => {
//     console.log("🔎 Guard check", {
//       hasMap: !!mapInstanceRef.current,
//       isUnmounting: isUnmountingRef.current,
//       alertsCount: alerts?.length || 0
//     });

//     if (!mapInstanceRef.current || isUnmountingRef.current) {
//       console.log("⏭️ Skipping render - map not ready/unmounting");
//       return;
//     }

//     // Clear old markers
//     clearMarkers();

//     if (!alerts.length) {
//       performanceStatsRef.current = { renderTime: 0, markerCount: 0 };
//       return;
//     }

//     const startTime = performance.now();

//     // Create cluster group
//     const markersLayer = L.markerClusterGroup({
//       chunkedLoading: true,
//       chunkInterval: 50,
//       chunkDelay: 50,
//       showCoverageOnHover: false,
//       maxClusterRadius: 60,
//       iconCreateFunction: function(cluster) {
//         const childCount = cluster.getChildCount();
//         let size = childCount < 10 ? 'small' : childCount < 100 ? 'medium' : 'large';
//         return new L.DivIcon({
//           html: `<div><span>${childCount}</span></div>`,
//           className: `marker-cluster marker-cluster-${size}`,
//           iconSize: new L.Point(40, 40)
//         });
//       }
//     });

//     const batchSize = 500;
//     let processed = 0;

//     const processBatch = () => {
//       const batch = alerts.slice(processed, processed + batchSize);

//       batch.forEach((alert, batchIndex) => {
//         const globalIndex = processed + batchIndex;
//         const key = alert.alert_id || `${alert.latitude}-${alert.longitude}`;

//         const marker = L.marker([alert.latitude, alert.longitude], {
//           icon: getMarkerIcon(alert, false)
//         });

//         // Add popup with alert details
//         marker.bindPopup(`
//           <div class="encroachment-popup">
//             <div class="popup-header">
//               <span class="confidence-badge ${alert.confidence}">
//                 ${confidenceIcons[alert.confidence]} ${alert.confidence.toUpperCase()}
//               </span>
//             </div>
//             <div class="popup-content">
//               <div class="popup-field">
//                 <strong>Date:</strong> ${alert.date}
//               </div>
//               <div class="popup-field">
//                 <strong>Location:</strong> ${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}
//               </div>
//               <div class="popup-field">
//                 <strong>Alert ID:</strong> ${alert.alert_id || 'N/A'}
//               </div>
//             </div>
//             <div class="popup-actions">
//               <button class="popup-button" onclick="window.focusAlert(${globalIndex})">
//                 📍 Focus
//               </button>
//             </div>
//           </div>
//         `, {
//           maxWidth: 300,
//           className: 'encroachment-popup-container'
//         });

//         // Attach alert to marker for reference
//         marker.alert = alert;

//         // Add click handler for alert selection
//         marker.on('click', () => {
//           onAlertSelect(marker.alert);
//         });

//         markersLayer.addLayer(marker);
//         markerMapRef.current[key] = marker;
//       });

//       processed += batchSize;
//       if (processed < alerts.length) {
//         requestAnimationFrame(processBatch);
//       } else {
//         mapInstanceRef.current.addLayer(markersLayer);
//         markersLayerRef.current = markersLayer;

//         const time = performance.now() - startTime;
//         performanceStatsRef.current = { renderTime: time, markerCount: alerts.length };
//         console.log(`✅ Rendered ${alerts.length} markers in ${time.toFixed(2)}ms`);

//         // Global focus function for popup buttons
//         window.focusAlert = (index) => {
//           if (alerts[index]) {
//             onAlertSelect(alerts[index]);
//             mapInstanceRef.current.setView([alerts[index].latitude, alerts[index].longitude], 15);
//           }
//         };

//         // Fit map to show all alerts
//         setTimeout(() => {
//           if (alerts.length > 0 && mapInstanceRef.current && !isUnmountingRef.current) {
//             try {
//               const lats = alerts.map(alert => alert.latitude);
//               const lngs = alerts.map(alert => alert.longitude);
              
//               const bounds = L.latLngBounds([
//                 [Math.min(...lats), Math.min(...lngs)],
//                 [Math.max(...lats), Math.max(...lngs)]
//               ]);
              
//               mapInstanceRef.current.fitBounds(bounds.pad(0.1));
//             } catch (error) {
//               console.warn('Error fitting bounds:', error);
//             }
//           }
//         }, 100);
//       }
//     };

//     processBatch();
//   }, [alerts, onAlertSelect, clearMarkers]);

//   /**
//    * Update marker icons when selectedAlert changes
//    */
//   useEffect(() => {
//     if (!mapInstanceRef.current || isUnmountingRef.current) return;

//     const prevSelected = prevSelectedRef.current;

//     if (prevSelected) {
//       const prevKey = prevSelected.alert_id || `${prevSelected.latitude}-${prevSelected.longitude}`;
//       const prevMarker = markerMapRef.current[prevKey];
//       if (prevMarker) {
//         prevMarker.setIcon(getMarkerIcon(prevSelected, false));
//       }
//     }

//     if (selectedAlert) {
//       const key = selectedAlert.alert_id || `${selectedAlert.latitude}-${selectedAlert.longitude}`;
//       const marker = markerMapRef.current[key];
//       if (marker) {
//         marker.setIcon(getMarkerIcon(selectedAlert, true));
//         // Bring to front if needed
//         if (markersLayerRef.current) {
//           markersLayerRef.current.zoomToShowLayer(marker);
//         }
//       }
//     }

//     prevSelectedRef.current = selectedAlert;
//   }, [selectedAlert]);

//   /**
//    * Focus on selected alert
//    */
//   useEffect(() => {
//     if (!mapInstanceRef.current || !selectedAlert || isUnmountingRef.current) return;

//     try {
//       mapInstanceRef.current.setView([selectedAlert.latitude, selectedAlert.longitude], 12);
//     } catch (error) {
//       console.warn('Error focusing on selected alert:', error);
//     }
//   }, [selectedAlert]);

//   // Always render the map container, but show appropriate message when no alerts
//   const hasAlerts = alerts && alerts.length > 0;

//   return (
//     <div className="encroachment-map-container">
//       <div className="map-header">
//         <div className="map-title">
//           <h3>🗺️ Encroachment Alerts Map</h3>
//           <p>
//             {loading ? 'Loading alerts...' : 
//              hasAlerts ? `${alerts.length} alerts displayed with clustered rendering` : 
//              'No alerts found for the selected criteria'}
//           </p>
//           {hasAlerts && performanceStatsRef.current.renderTime > 0 && (
//             <small style={{ color: '#6c757d', fontSize: '0.8rem' }}>
//               Rendered in {performanceStatsRef.current.renderTime.toFixed(0)}ms • 
//               Click any marker for details • Zoom to decluster
//             </small>
//           )}
//         </div>
//         <div className="map-legend">
//           <div className="legend-item">
//             <span className="legend-icon high">🔴</span>
//             <span>High Confidence</span>
//           </div>
//           <div className="legend-item">
//             <span className="legend-icon nominal">🟡</span>
//             <span>Nominal Confidence</span>
//           </div>
//           <div className="legend-item">
//             <span className="legend-icon low">🟢</span>
//             <span>Low Confidence</span>
//           </div>
//         </div>
//       </div>
      
//       <div className="map-content">
//         <div ref={mapRef} className="encroachment-map" />
        
//         {/* Loading overlay */}
//         {loading && (
//           <div className="map-overlay loading-overlay">
//             <div className="overlay-content">
//               <div className="spinner">🔄</div>
//               <p>Loading encroachment data...</p>
//             </div>
//           </div>
//         )}
        
//         {/* No data overlay */}
//         {!loading && !hasAlerts && (
//           <div className="map-overlay no-data-overlay">
//             <div className="overlay-content">
//               <div className="no-data-icon">🔍</div>
//               <h4>No Encroachment Alerts Found</h4>
//               <p>Try adjusting your date range or confidence level filters.</p>
//               <p>The map shows the Texas region where alerts would appear.</p>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default EncroachmentMap;

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { FaMapMarkedAlt, FaSpinner, FaSearch, FaCircle, FaMapMarkerAlt } from 'react-icons/fa';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './EncroachmentMap.css';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

/**
 * Build a "world-with-hole" feature from the Texas boundary GeoJSON
 * Creates a mask that darkens everything outside Texas
 */
function buildOutsideTexasMask(texasGeojson) {
  if (!texasGeojson) return null;
  
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
  return {
    type: 'Feature',
    properties: { role: 'outside-texas-mask' },
    geometry: {
      type: 'Polygon',
      coordinates: [worldRing, ...texasHoles],
    },
  };
}

const EncroachmentMap = ({ 
  alerts = [], 
  selectedAlert, 
  onAlertSelect, 
  loading = false 
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markerMapRef = useRef({});
  const spiderfiedSetRef = useRef(new Set());
  const prevSelectedRef = useRef(null);
  const isUnmountingRef = useRef(false);
  const isProcessingRef = useRef(false); // Prevent concurrent marker processing
  const currentRenderIdRef = useRef(0); // Track render cycles
  const onAlertSelectRef = useRef(onAlertSelect); // Stable ref for callback
  const texasBoundaryLayerRef = useRef(null);
  const outsideTexasMaskLayerRef = useRef(null); // Add ref for mask layer
  const [texasBoundaryData, setTexasBoundaryData] = useState(null);
  const performanceStatsRef = useRef({
    renderTime: 0,
    markerCount: 0
  });

  // Keep the ref updated with latest callback
  useEffect(() => {
    onAlertSelectRef.current = onAlertSelect;
  }, [onAlertSelect]);

  // Clean markers cleanup function
  const clearMarkers = useCallback(() => {
    try {
      if (markersLayerRef.current) {
        console.log('🧹 Clearing markers from map...', {
          layerCount: markersLayerRef.current.getLayers ? markersLayerRef.current.getLayers().length : 'unknown',
          hasMap: !!mapInstanceRef.current
        });
        
        // Clear all layers from the cluster group first
        if (markersLayerRef.current.clearLayers) {
          markersLayerRef.current.clearLayers();
        }
        
        // Then remove the cluster group from the map
        if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(markersLayerRef.current)) {
          mapInstanceRef.current.removeLayer(markersLayerRef.current);
        }
        
        markersLayerRef.current = null;
        console.log('✅ Markers cleared successfully');
      }
      
      // Clear all marker references
      markerMapRef.current = {};
      spiderfiedSetRef.current = new Set();
    } catch (error) {
      console.error('❌ Error clearing markers:', error);
      // Force reset even on error
      markersLayerRef.current = null;
      markerMapRef.current = {};
      spiderfiedSetRef.current = new Set();
    }
  }, []);

  // Texas bounds
  const texasBounds = [
    [25.8371, -106.6456], // Southwest corner
    [36.5007, -93.5083]   // Northeast corner
  ];

  // Confidence level icons - using React Icons
  const getConfidenceIconHTML = (level) => {
    const colors = {
      high: '#dc3545',
      nominal: '#ffc107',
      low: '#28a745'
    };
    return `<span style="color: ${colors[level]}; font-size: 1rem;">●</span>`;
  };

  const getFillColor = (confidence, isSelected) => {
    if (isSelected) return '#ffffff';
    return confidence === 'high' ? '#dc3545' : 
           confidence === 'nominal' ? '#ffc107' : '#28a745';
  };

  const getStrokeColor = (isSelected) => {
    return isSelected ? '#000000' : '#ffffff';
  };

  const getWeight = (isSelected) => {
    return isSelected ? 2 : 1;
  };

  const getRadius = (isSelected) => {
    return isSelected ? 8 : 5;
  };

  const getMarkerIcon = (alert, isSelected, isSpiderfied = false) => {
    let scale = isSpiderfied ? 1.5 : 1;
    if (isSelected) scale *= 1.2; // Additional scale for selected

    const containerSize = 16 * scale;
    const pulseSize = 20 * scale;
    const iconSize = 12 * scale;

    return L.divIcon({
      className: 'custom-encroachment-marker',
      html: `
        <div class="marker-container ${alert.confidence} ${isSelected ? 'selected' : ''}" style="width: ${containerSize}px; height: ${containerSize}px;">
          <div class="marker-pulse" style="width: ${pulseSize}px; height: ${pulseSize}px;"></div>
          <span class="marker-icon" style="font-size: ${iconSize}px;">${getConfidenceIconHTML(alert.confidence)}</span>
        </div>
      `,
      iconSize: [pulseSize, pulseSize],
      iconAnchor: [pulseSize / 2, pulseSize / 2],
      popupAnchor: [0, -pulseSize / 2]
    });
  };

  /**
   * Load Texas GeoJSON boundary data
   */
  useEffect(() => {
    const loadTexasBoundary = async () => {
      try {
        const response = await fetch('/Texas_Geojsons/Texas_Geojsons/texas.geojson');
        if (response.ok) {
          const data = await response.json();
          setTexasBoundaryData(data);
          console.log('✅ Texas boundary GeoJSON loaded for Encroachment Map');
        } else {
          console.warn('⚠️ Failed to load Texas boundary GeoJSON');
        }
      } catch (error) {
        console.error('❌ Error loading Texas boundary:', error);
      }
    };

    loadTexasBoundary();
  }, []);

  /**
   * Initialize map
   */
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Reset unmounting flag when map is being created
    isUnmountingRef.current = false;

    // Create map instance - better center for Texas
    const map = L.map(mapRef.current, {
      center: [31.0, -99.0], // Better center of Texas
      zoom: 6,
      zoomControl: true,
      attributionControl: true,
      minZoom: 5,
      maxZoom: 18
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);

    // Set Texas bounds with proper fitting
    if (texasBoundaryData) {
      try {
        const texasLayer = L.geoJSON(texasBoundaryData);
        const bounds = texasLayer.getBounds();
        map.fitBounds(bounds, {
          padding: [20, 20],
          maxZoom: 7
        });
        map.setMaxBounds(bounds.pad(0.1));
      } catch (error) {
        console.error('Error setting Texas bounds:', error);
        map.setMaxBounds(texasBounds);
      }
    } else {
      map.setMaxBounds(texasBounds);
    }

    mapInstanceRef.current = map;

    // Add outside Texas mask if boundary is loaded
    if (texasBoundaryData && !outsideTexasMaskLayerRef.current) {
      try {
        const maskFeature = buildOutsideTexasMask(texasBoundaryData);
        if (maskFeature) {
          const maskLayer = L.geoJSON(maskFeature, {
            style: {
              stroke: false,
              fillColor: '#000000',
              fillOpacity: 0.65
            },
            interactive: false,
            pane: 'tilePane' // Add to tile pane so it's above tiles but below markers
          });
          maskLayer.addTo(map);
          outsideTexasMaskLayerRef.current = maskLayer;
          console.log('✅ Outside Texas mask added during map initialization');
        }
      } catch (error) {
        console.error('❌ Error adding outside Texas mask:', error);
      }
    }

    // Add boundary if already loaded
    if (texasBoundaryData && !texasBoundaryLayerRef.current) {
      const boundaryStyle = {
        fillColor: 'rgba(30, 60, 114, 0.05)',
        color: '#1e3c72',
        weight: 3,
        opacity: 0.9,
        fillOpacity: 0.05,
        dashArray: '8, 4'
      };

      try {
        const texasBoundaryLayer = L.geoJSON(texasBoundaryData, {
          style: boundaryStyle,
          interactive: false
        });
        texasBoundaryLayer.addTo(map);
        texasBoundaryLayerRef.current = texasBoundaryLayer;
        console.log('✅ Texas boundary added during map initialization');
      } catch (error) {
        console.error('❌ Error adding boundary during init:', error);
      }
    }

    return () => {
      // Set unmounting flag to prevent further operations
      isUnmountingRef.current = true;
      
      // Clear markers
      clearMarkers();
      
      // Clear outside Texas mask layer
      if (outsideTexasMaskLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(outsideTexasMaskLayerRef.current);
        outsideTexasMaskLayerRef.current = null;
      }
      
      // Clear Texas boundary layer
      if (texasBoundaryLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(texasBoundaryLayerRef.current);
        texasBoundaryLayerRef.current = null;
      }
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [clearMarkers]);

  /**
   * Add Texas GeoJSON boundary and mask to map when data is loaded
   */
  useEffect(() => {
    if (!mapInstanceRef.current || !texasBoundaryData || isUnmountingRef.current) return;
    
    // Add outside Texas mask first (if not already added)
    if (!outsideTexasMaskLayerRef.current) {
      try {
        const maskFeature = buildOutsideTexasMask(texasBoundaryData);
        if (maskFeature) {
          const maskLayer = L.geoJSON(maskFeature, {
            style: {
              stroke: false,
              fillColor: '#000000',
              fillOpacity: 0.65
            },
            interactive: false,
            pane: 'tilePane'
          });
          maskLayer.addTo(mapInstanceRef.current);
          outsideTexasMaskLayerRef.current = maskLayer;
          console.log('✅ Outside Texas mask added dynamically');
        }
      } catch (error) {
        console.error('❌ Error adding outside Texas mask dynamically:', error);
      }
    }
    
    // Skip if boundary already added
    if (texasBoundaryLayerRef.current) {
      console.log('🗺️ Texas boundary already added, skipping');
      return;
    }

    console.log('🗺️ Adding Texas boundary to map...', {
      hasMap: !!mapInstanceRef.current,
      hasBoundary: !!texasBoundaryData,
      boundaryType: texasBoundaryData?.type
    });

    // Add Texas GeoJSON boundary with darker styling
    const boundaryStyle = {
      fillColor: 'rgba(30, 60, 114, 0.05)', // Slight dark blue fill
      color: '#1e3c72', // Dark blue border
      weight: 3,
      opacity: 0.9,
      fillOpacity: 0.05,
      dashArray: '8, 4'
    };

    try {
      const texasBoundaryLayer = L.geoJSON(texasBoundaryData, {
        style: boundaryStyle,
        interactive: false // Make boundary non-interactive
      });

      texasBoundaryLayer.addTo(mapInstanceRef.current);
      texasBoundaryLayerRef.current = texasBoundaryLayer;
      
      // Bring boundary to back so markers appear on top
      if (texasBoundaryLayer.bringToBack) {
        texasBoundaryLayer.bringToBack();
      }

      console.log('✅ Texas GeoJSON boundary added to Encroachment Map');
    } catch (error) {
      console.error('❌ Error adding Texas boundary:', error);
    }
  }, [texasBoundaryData]);

  /**
   * High-performance marker rendering with clustering
   */
  useEffect(() => {
    console.log("🔎 Marker Render Guard Check", {
      hasMap: !!mapInstanceRef.current,
      isUnmounting: isUnmountingRef.current,
      isProcessing: isProcessingRef.current,
      alertsCount: alerts?.length || 0,
      hasExistingMarkers: !!markersLayerRef.current
    });

    if (!mapInstanceRef.current || isUnmountingRef.current) {
      console.log("⏭️ Skipping render - map not ready/unmounting");
      return;
    }

    // Prevent concurrent processing
    if (isProcessingRef.current) {
      console.log("⚠️ Already processing markers, skipping...");
      return;
    }

    // Increment render ID to invalidate any ongoing batch processing
    currentRenderIdRef.current += 1;
    const thisRenderId = currentRenderIdRef.current;
    console.log(`🔄 Starting marker update #${thisRenderId} for`, alerts?.length || 0, 'alerts');

    // Clear old markers FIRST before adding new ones
    clearMarkers();

    // Mark as processing
    isProcessingRef.current = true;

    if (!alerts.length) {
      console.log('📭 No alerts to display');
      performanceStatsRef.current = { renderTime: 0, markerCount: 0 };
      isProcessingRef.current = false;
      return;
    }

    const startTime = performance.now();
    console.log('🎨 Creating new marker cluster group...');

    // Create cluster group with custom options
    const markersLayer = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 50,
      chunkDelay: 50,
      showCoverageOnHover: false,
      maxClusterRadius: 60,
      spiderfyDistanceMultiplier: 1.2,
      spiderLegPolylineOptions: {
        weight: 2,
        color: '#333',
        opacity: 0.7,
        dashArray: '5, 5'
      },
      iconCreateFunction: function(cluster) {
        const childMarkers = cluster.getAllChildMarkers();
        let maxConf = 'low';
        childMarkers.forEach((m) => {
          const conf = m.alert.confidence;
          if (conf === 'high') {
            maxConf = 'high';
          } else if (conf === 'nominal' && maxConf !== 'high') {
            maxConf = 'nominal';
          }
        });

        const childCount = cluster.getChildCount();
        let size = childCount < 10 ? 'small' : childCount < 100 ? 'medium' : 'large';
        return new L.DivIcon({
          html: `<div><span>${childCount}</span></div>`,
          className: `marker-cluster marker-cluster-${size} cluster-${maxConf}`,
          iconSize: new L.Point(40, 40)
        });
      }
    });

    const batchSize = 100; // Smaller batches for better responsiveness
    let processed = 0;

    const processBatch = () => {
      // Check if this render has been superseded by a newer one
      if (currentRenderIdRef.current !== thisRenderId) {
        console.log(`⚠️ Aborting render #${thisRenderId} - superseded by #${currentRenderIdRef.current}`);
        isProcessingRef.current = false;
        return;
      }

      // Check if we should stop processing
      if (isUnmountingRef.current || !mapInstanceRef.current) {
        console.log('⚠️ Stopping batch processing - component unmounting or map removed');
        isProcessingRef.current = false;
        return;
      }

      const batch = alerts.slice(processed, processed + batchSize);

      batch.forEach((alert, batchIndex) => {
        const globalIndex = processed + batchIndex;
        const key = alert.alert_id || `${alert.latitude}-${alert.longitude}`;

        const marker = L.marker([alert.latitude, alert.longitude], {
          icon: getMarkerIcon(alert, false)
        });

        // Bind tooltip for quick info
        marker.bindTooltip(
          `<span class="tooltip-confidence ${alert.confidence}">${getConfidenceIconHTML(alert.confidence)} ${alert.confidence.toUpperCase()}</span><br>${alert.date}`,
          {
            direction: 'top',
            offset: L.point(0, -20),
            className: 'encroachment-tooltip',
            sticky: true
          }
        );

        // Add popup with alert details
        marker.bindPopup(`
          <div class="encroachment-popup">
            <div class="popup-header">
              <span class="confidence-badge ${alert.confidence}">
                ${getConfidenceIconHTML(alert.confidence)} ${alert.confidence.toUpperCase()}
              </span>
            </div>
            <div class="popup-content">
              <div class="popup-field">
                <strong>Date:</strong> ${alert.date}
              </div>
              <div class="popup-field">
                <strong>Location:</strong> ${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}
              </div>
              <div class="popup-field">
                <strong>Alert ID:</strong> ${alert.alert_id || 'N/A'}
              </div>
            </div>
            <div class="popup-actions">
              <button class="popup-button" onclick="window.focusAlert(${globalIndex})">
                <span style="margin-right: 4px;">📍</span> Focus
              </button>
            </div>
          </div>
        `, {
          maxWidth: 300,
          className: 'encroachment-popup-container'
        });

        // Attach alert to marker for reference
        marker.alert = alert;

        // Add click handler for alert selection
        marker.on('click', () => {
          onAlertSelectRef.current(marker.alert);
        });

        markersLayer.addLayer(marker);
        markerMapRef.current[key] = marker;
      });

      processed += batchSize;
      
      if (processed < alerts.length && !isUnmountingRef.current) {
        // Use setTimeout for better performance than requestAnimationFrame
        setTimeout(processBatch, 0);
      } else {
        // All batches processed - final check before adding to map
        if (currentRenderIdRef.current !== thisRenderId) {
          console.log(`⚠️ Discarding completed render #${thisRenderId} - superseded by #${currentRenderIdRef.current}`);
          isProcessingRef.current = false;
          return;
        }

        if (!mapInstanceRef.current || isUnmountingRef.current) {
          console.log('⚠️ Map removed before adding markers layer');
          isProcessingRef.current = false;
          return;
        }
        
        console.log(`📍 Adding render #${thisRenderId} markers to map...`);
        mapInstanceRef.current.addLayer(markersLayer);
        markersLayerRef.current = markersLayer;

        // Add spiderfy event listeners
        markersLayer.on('spiderfied', (e) => {
          if (isUnmountingRef.current) return;
          e.markers.forEach((marker) => {
            spiderfiedSetRef.current.add(marker);
            const key = marker.alert.alert_id || `${marker.alert.latitude}-${marker.alert.longitude}`;
            const isSelected = selectedAlert && key === (selectedAlert.alert_id || `${selectedAlert.latitude}-${selectedAlert.longitude}`);
            marker.setIcon(getMarkerIcon(marker.alert, isSelected, true));
          });
        });

        markersLayer.on('unspiderfied', (e) => {
          if (isUnmountingRef.current) return;
          e.markers.forEach((marker) => {
            spiderfiedSetRef.current.delete(marker);
            const key = marker.alert.alert_id || `${marker.alert.latitude}-${marker.alert.longitude}`;
            const isSelected = selectedAlert && key === (selectedAlert.alert_id || `${selectedAlert.latitude}-${selectedAlert.longitude}`);
            marker.setIcon(getMarkerIcon(marker.alert, isSelected, false));
          });
        });

        const time = performance.now() - startTime;
        performanceStatsRef.current = { renderTime: time, markerCount: alerts.length };
        isProcessingRef.current = false; // Reset processing flag
        console.log(`✅ Render #${thisRenderId} completed: ${alerts.length} markers in ${time.toFixed(2)}ms`);
        console.log(`📍 Total markers on map: ${markersLayerRef.current.getLayers().length}`);

        // Global focus function for popup buttons
        window.focusAlert = (index) => {
          if (alerts[index]) {
            onAlertSelectRef.current(alerts[index]);
            mapInstanceRef.current.setView([alerts[index].latitude, alerts[index].longitude], 15);
          }
        };

        // Fit map to show all alerts, but maintain Texas center
        setTimeout(() => {
          if (alerts.length > 0 && mapInstanceRef.current && !isUnmountingRef.current) {
            try {
              const lats = alerts.map(alert => alert.latitude);
              const lngs = alerts.map(alert => alert.longitude);
              
              // Only fit bounds if alerts span a large area
              // Otherwise keep the default Texas center view
              const latSpan = Math.max(...lats) - Math.min(...lats);
              const lngSpan = Math.max(...lngs) - Math.min(...lngs);
              
              // Only auto-fit if alerts cover more than 30% of Texas
              if (latSpan > 3.0 || lngSpan > 4.0) {
                const bounds = L.latLngBounds([
                  [Math.min(...lats), Math.min(...lngs)],
                  [Math.max(...lats), Math.max(...lngs)]
                ]);
                
                mapInstanceRef.current.fitBounds(bounds.pad(0.15), {
                  maxZoom: 7 // Don't zoom in too much
                });
              } else {
                // Keep Texas centered for localized alerts
                mapInstanceRef.current.setView([31.0, -99.0], 6);
              }
            } catch (error) {
              console.warn('Error fitting bounds:', error);
            }
          }
        }, 100);
      }
    };

    processBatch();

    // Cleanup function to ensure markers are cleared when effect re-runs or component unmounts
    return () => {
      console.log('🧼 Cleanup: Marker render effect is being cleaned up');
      isProcessingRef.current = false; // Reset processing flag on cleanup
      // Note: We don't call clearMarkers here because it would interfere with the next render
      // The clearMarkers call at the start of the effect handles the cleanup
    };
  }, [alerts]);

  /**
   * Update marker icons when selectedAlert changes
   */
  useEffect(() => {
    if (!mapInstanceRef.current || isUnmountingRef.current) return;

    const prevSelected = prevSelectedRef.current;

    if (prevSelected) {
      const prevKey = prevSelected.alert_id || `${prevSelected.latitude}-${prevSelected.longitude}`;
      const prevMarker = markerMapRef.current[prevKey];
      if (prevMarker) {
        const isSpiderfied = spiderfiedSetRef.current.has(prevMarker);
        prevMarker.setIcon(getMarkerIcon(prevSelected, false, isSpiderfied));
      }
    }

    if (selectedAlert) {
      const key = selectedAlert.alert_id || `${selectedAlert.latitude}-${selectedAlert.longitude}`;
      const marker = markerMapRef.current[key];
      if (marker) {
        const isSpiderfied = spiderfiedSetRef.current.has(marker);
        marker.setIcon(getMarkerIcon(selectedAlert, true, isSpiderfied));
        // Bring to front if needed
        if (markersLayerRef.current) {
          markersLayerRef.current.zoomToShowLayer(marker, () => {
            // After zooming to show layer, pan and zoom to the alert
            console.log('🎯 Zooming to show layer for selected alert:', selectedAlert);
            try {
              mapInstanceRef.current.setView([selectedAlert.latitude, selectedAlert.longitude], 12, {
                animate: true,
                duration: 0.5
              });
            } catch (error) {
              console.warn('Error focusing on selected alert after zoom:', error);
            }
          });
        }
      }
    }

    prevSelectedRef.current = selectedAlert;
  }, [selectedAlert]);

  /**
   * Focus on selected alert (separate effect for reliability)
   */
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedAlert || isUnmountingRef.current) return;

    console.log('🎯 Focus effect triggered for alert:', selectedAlert);

    // Add a small delay to ensure markers are rendered
    const focusTimeout = setTimeout(() => {
      if (!mapInstanceRef.current || isUnmountingRef.current) return;
      
      try {
        const key = selectedAlert.alert_id || `${selectedAlert.latitude}-${selectedAlert.longitude}`;
        const marker = markerMapRef.current[key];
        
        if (marker && markersLayerRef.current) {
          console.log('🎯 Found marker for selected alert, zooming to show layer');
          // Use zoomToShowLayer which handles clusters properly
          markersLayerRef.current.zoomToShowLayer(marker, () => {
            console.log('🎯 Layer shown, now setting view to alert location');
            if (mapInstanceRef.current && !isUnmountingRef.current) {
              mapInstanceRef.current.setView(
                [selectedAlert.latitude, selectedAlert.longitude], 
                14, // Zoom level 14 for detailed view
                { animate: true, duration: 0.5 }
              );
            }
          });
        } else {
          console.log('🎯 Marker not found in cluster, setting view directly');
          // If marker not found (might not be rendered yet), just pan to coordinates
          mapInstanceRef.current.setView(
            [selectedAlert.latitude, selectedAlert.longitude], 
            14,
            { animate: true, duration: 0.5 }
          );
        }
      } catch (error) {
        console.error('❌ Error focusing on selected alert:', error);
      }
    }, 100); // 100ms delay to ensure markers are ready

    return () => clearTimeout(focusTimeout);
  }, [selectedAlert]);

  // Always render the map container, but show appropriate message when no alerts
  const hasAlerts = alerts && alerts.length > 0;

  return (
    <div className="encroachment-map-container">
      <div className="map-header">
        <div className="map-title">
          <h3><FaMapMarkedAlt /> Encroachment Alerts Map</h3>
          <p>
            {loading ? 'Loading alerts...' : 
             hasAlerts ? `${alerts.length} alerts displayed with clustered rendering` : 
             'No alerts found for the selected criteria'}
          </p>
          {hasAlerts && performanceStatsRef.current.renderTime > 0 && (
            <small style={{ color: '#6c757d', fontSize: '0.8rem' }}>
              Rendered in {performanceStatsRef.current.renderTime.toFixed(0)}ms • 
              Click any marker for details • Zoom to decluster
            </small>
          )}
        </div>
        <div className="map-legend">
          <div className="legend-item">
            <FaCircle className="legend-icon high" />
            <span>High Confidence</span>
          </div>
          <div className="legend-item">
            <FaCircle className="legend-icon nominal" />
            <span>Nominal Confidence</span>
          </div>
          <div className="legend-item">
            <FaCircle className="legend-icon low" />
            <span>Low Confidence</span>
          </div>
        </div>
      </div>
      
      <div className="map-content">
        <div ref={mapRef} className="encroachment-map" />
        
        {/* Loading overlay */}
        {loading && (
          <div className="map-overlay loading-overlay">
            <div className="overlay-content">
              <FaSpinner className="spinner" />
              <p>Loading encroachment data...</p>
            </div>
          </div>
        )}
        
        {/* No data overlay */}
        {!loading && !hasAlerts && (
          <div className="map-overlay no-data-overlay">
            <div className="overlay-content">
              <FaSearch className="no-data-icon" />
              <h4>No Encroachment Alerts Found</h4>
              <p>Try adjusting your date range or confidence level filters.</p>
              <p>The map shows the Texas region where alerts would appear.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EncroachmentMap;