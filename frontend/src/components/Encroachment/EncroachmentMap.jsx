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

import React, { useEffect, useRef, useCallback } from 'react';
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
  const performanceStatsRef = useRef({
    renderTime: 0,
    markerCount: 0
  });

  // Clean markers cleanup function
  const clearMarkers = useCallback(() => {
    if (markersLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(markersLayerRef.current);
      markersLayerRef.current = null;
    }
    markerMapRef.current = {};
    spiderfiedSetRef.current = new Set();
  }, []);

  // Texas bounds
  const texasBounds = [
    [25.8371, -106.6456], // Southwest corner
    [36.5007, -93.5083]   // Northeast corner
  ];

  // Confidence level icons
  const confidenceIcons = {
    high: '🔴',
    nominal: '🟡',
    low: '🟢'
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
          <span class="marker-icon" style="font-size: ${iconSize}px;">${confidenceIcons[alert.confidence]}</span>
        </div>
      `,
      iconSize: [pulseSize, pulseSize],
      iconAnchor: [pulseSize / 2, pulseSize / 2],
      popupAnchor: [0, -pulseSize / 2]
    });
  };

  /**
   * Initialize map
   */
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Create map instance
    const map = L.map(mapRef.current, {
      center: [31.9686, -99.9018], // Center of Texas
      zoom: 6,
      zoomControl: true,
      attributionControl: true
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);

    // Set Texas bounds
    map.setMaxBounds(texasBounds);
    map.setMinZoom(5);

    // Add Texas outline
    const texasOutline = L.rectangle(texasBounds, {
      color: '#667eea',
      weight: 3,
      fillColor: 'transparent',
      fillOpacity: 0,
      dashArray: '10, 10'
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      // Set unmounting flag to prevent further operations
      isUnmountingRef.current = true;
      
      // Clear markers
      clearMarkers();
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [clearMarkers]);

  /**
   * High-performance marker rendering with clustering
   */
  useEffect(() => {
    console.log("🔎 Guard check", {
      hasMap: !!mapInstanceRef.current,
      isUnmounting: isUnmountingRef.current,
      alertsCount: alerts?.length || 0
    });

    if (!mapInstanceRef.current || isUnmountingRef.current) {
      console.log("⏭️ Skipping render - map not ready/unmounting");
      return;
    }

    // Clear old markers
    clearMarkers();

    if (!alerts.length) {
      performanceStatsRef.current = { renderTime: 0, markerCount: 0 };
      return;
    }

    const startTime = performance.now();

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

    const batchSize = 500;
    let processed = 0;

    const processBatch = () => {
      const batch = alerts.slice(processed, processed + batchSize);

      batch.forEach((alert, batchIndex) => {
        const globalIndex = processed + batchIndex;
        const key = alert.alert_id || `${alert.latitude}-${alert.longitude}`;

        const marker = L.marker([alert.latitude, alert.longitude], {
          icon: getMarkerIcon(alert, false)
        });

        // Bind tooltip for quick info
        marker.bindTooltip(
          `<span class="tooltip-confidence ${alert.confidence}">${confidenceIcons[alert.confidence]} ${alert.confidence.toUpperCase()}</span><br>${alert.date}`,
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
                ${confidenceIcons[alert.confidence]} ${alert.confidence.toUpperCase()}
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
                📍 Focus
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
          onAlertSelect(marker.alert);
        });

        markersLayer.addLayer(marker);
        markerMapRef.current[key] = marker;
      });

      processed += batchSize;
      if (processed < alerts.length) {
        requestAnimationFrame(processBatch);
      } else {
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
        console.log(`✅ Rendered ${alerts.length} markers in ${time.toFixed(2)}ms`);

        // Global focus function for popup buttons
        window.focusAlert = (index) => {
          if (alerts[index]) {
            onAlertSelect(alerts[index]);
            mapInstanceRef.current.setView([alerts[index].latitude, alerts[index].longitude], 15);
          }
        };

        // Fit map to show all alerts
        setTimeout(() => {
          if (alerts.length > 0 && mapInstanceRef.current && !isUnmountingRef.current) {
            try {
              const lats = alerts.map(alert => alert.latitude);
              const lngs = alerts.map(alert => alert.longitude);
              
              const bounds = L.latLngBounds([
                [Math.min(...lats), Math.min(...lngs)],
                [Math.max(...lats), Math.max(...lngs)]
              ]);
              
              mapInstanceRef.current.fitBounds(bounds.pad(0.1));
            } catch (error) {
              console.warn('Error fitting bounds:', error);
            }
          }
        }, 100);
      }
    };

    processBatch();
  }, [alerts, selectedAlert, onAlertSelect, clearMarkers]);

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
          markersLayerRef.current.zoomToShowLayer(marker);
        }
      }
    }

    prevSelectedRef.current = selectedAlert;
  }, [selectedAlert, alerts]);

  /**
   * Focus on selected alert
   */
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedAlert || isUnmountingRef.current) return;

    try {
      mapInstanceRef.current.setView([selectedAlert.latitude, selectedAlert.longitude], 12);
    } catch (error) {
      console.warn('Error focusing on selected alert:', error);
    }
  }, [selectedAlert]);

  // Always render the map container, but show appropriate message when no alerts
  const hasAlerts = alerts && alerts.length > 0;

  return (
    <div className="encroachment-map-container">
      <div className="map-header">
        <div className="map-title">
          <h3>🗺️ Encroachment Alerts Map</h3>
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
            <span className="legend-icon high">🔴</span>
            <span>High Confidence</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon nominal">🟡</span>
            <span>Nominal Confidence</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon low">🟢</span>
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
              <div className="spinner">🔄</div>
              <p>Loading encroachment data...</p>
            </div>
          </div>
        )}
        
        {/* No data overlay */}
        {!loading && !hasAlerts && (
          <div className="map-overlay no-data-overlay">
            <div className="overlay-content">
              <div className="no-data-icon">🔍</div>
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