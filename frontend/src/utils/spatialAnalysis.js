import * as turf from '@turf/turf';

/**
 * Spatial Analysis Utilities for Texas GeoSpatial Explorer
 * Uses Turf.js for robust spatial operations
 */

/**
 * Categorize layers into polygon and point types for different query strategies
 */
export const LAYER_TYPES = {
  POLYGON_LAYERS: [
    'texas-boundary', 'counties', 'counties-2010', 'boundary-with-counties',
    'boundary-counties-subdivisions', 'boundary-data', 'military-lands',
    'populated-areas', 'voting-districts', 'regional-authorities',
    'river-basins', 'major-river-basins', 'river-boundaries', 'watersheds',
    'existing-reservoirs', 'regional-water-planning', 'groundwater-management',
    'groundwater-management-detail', 'groundwater-conservation', 'groundwater',
    'major-aquifers', 'minor-aquifers', 'priority-groundwater', 'flood-planning-groups',
    'hydraulic-unit-code', 'wind-power-potential', 'oil-gas-basins',
    'oil-production', 'natural-gas-production', 'coal-production', 'coal-deposits',
    'geothermal-potential', 'solar-power-potential', 'biomass-crop-residue',
    'biomass-woodmill-residue', 'PCFA-regions', 'education-regions',
    'school-regions', 'school-districts', 'tea-regions', 'state-parks-polygon',
    'state-parks-texas', 'wildlife-management', 'wildlife-refuges', 'wetlands',
    'surface-geology', 'soil-map', 'ecological-provinces', 'ecological-sections',
    'precipitation', 'census-tracts', 'census-block-groups', 'tracts-2010',
    'race-population', 'tx-1degree'
  ],
  POINT_LAYERS: [
    'cities', 'county-seats', 'populated-places', 'airports', 'wind-turbines',
    'plugging-report', 'well-locations', 'school-locations', 'schools-2012',
    'state-parks-points', 'cemeteries'
  ],
  LINE_LAYERS: [
    'railroads', 'roads', 'major-rivers', 'rivers', 'rivers-by-watersheds'
  ]
};

/**
 * Check if a point is inside any polygon features of a layer
 * @param {Array} clickPoint - [lng, lat] coordinates
 * @param {Object} layerData - GeoJSON layer data
 * @returns {Array} Array of features that contain the point
 */
export const findPolygonsContainingPoint = (clickPoint, layerData) => {
  if (!layerData || !layerData.data || !layerData.data.features) {
    return [];
  }

  const point = turf.point(clickPoint);
  const containingFeatures = [];

  layerData.data.features.forEach((feature, index) => {
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      try {
        const isInside = turf.booleanPointInPolygon(point, feature);
        if (isInside) {
          containingFeatures.push({
            ...feature,
            layerId: layerData.id,
            layerName: layerData.name,
            featureIndex: index
          });
        }
      } catch (error) {
        console.warn(`Error checking point in polygon for layer ${layerData.id}:`, error);
      }
    }
  });

  return containingFeatures;
};

/**
 * Find the nearest point features to a clicked location
 * @param {Array} clickPoint - [lng, lat] coordinates
 * @param {Object} layerData - GeoJSON layer data
 * @param {number} maxResults - Maximum number of results to return
 * @param {number} maxDistanceKm - Maximum distance in kilometers
 * @returns {Array} Array of nearest features with distances
 */
export const findNearestPointFeatures = (clickPoint, layerData, maxResults = 5, maxDistanceKm = 50) => {
  if (!layerData || !layerData.data || !layerData.data.features) {
    return [];
  }

  const targetPoint = turf.point(clickPoint);
  const nearbyFeatures = [];

  layerData.data.features.forEach((feature, index) => {
    if (feature.geometry.type === 'Point') {
      try {
        const distance = turf.distance(targetPoint, feature, { units: 'kilometers' });
        
        if (distance <= maxDistanceKm) {
          nearbyFeatures.push({
            ...feature,
            layerId: layerData.id,
            layerName: layerData.name,
            featureIndex: index,
            distance: distance,
            distanceFormatted: `${distance.toFixed(2)} km`
          });
        }
      } catch (error) {
        console.warn(`Error calculating distance for layer ${layerData.id}:`, error);
      }
    }
  });

  // Sort by distance and return top results
  return nearbyFeatures
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxResults);
};

/**
 * Perform comprehensive spatial query for a clicked point
 * @param {Array} clickPoint - [lng, lat] coordinates
 * @param {Map} allLayersData - Map of all loaded layer data
 * @param {Set} activeLayerIds - Set of currently active layer IDs
 * @returns {Object} Query results organized by type
 */
export const performSpatialQuery = (clickPoint, allLayersData, activeLayerIds) => {
  const results = {
    clickCoordinates: {
      lng: clickPoint[0],
      lat: clickPoint[1],
      formatted: `${clickPoint[1].toFixed(6)}, ${clickPoint[0].toFixed(6)}`
    },
    polygonData: [],
    nearestPoints: [],
    queryTimestamp: new Date().toISOString()
  };

  // Only query active layers
  const activeLayersToQuery = Array.from(activeLayerIds)
    .filter(layerId => allLayersData.has(layerId))
    .map(layerId => allLayersData.get(layerId));

  // Query polygon layers for coverage data
  activeLayersToQuery.forEach(layerData => {
    if (LAYER_TYPES.POLYGON_LAYERS.includes(layerData.id)) {
      const polygonMatches = findPolygonsContainingPoint(clickPoint, layerData);
      results.polygonData.push(...polygonMatches);
    }
  });

  // Query point layers for nearest features
  activeLayersToQuery.forEach(layerData => {
    if (LAYER_TYPES.POINT_LAYERS.includes(layerData.id)) {
      const nearestPoints = findNearestPointFeatures(clickPoint, layerData, 3, 50);
      results.nearestPoints.push(...nearestPoints);
    }
  });

  // Sort nearest points by distance across all layers
  results.nearestPoints.sort((a, b) => a.distance - b.distance);
  
  // Keep only top 10 nearest across all layers
  results.nearestPoints = results.nearestPoints.slice(0, 10);

  return results;
};

/**
 * Extract meaningful properties from a feature for display
 * @param {Object} feature - GeoJSON feature
 * @returns {Object} Cleaned properties object
 */
export const extractFeatureProperties = (feature) => {
  if (!feature.properties) return {};

  const excludedKeys = [
    'OBJECTID', 'objectid', 'FID', 'fid', 'SHAPE_LENG', 'SHAPE_AREA',
    'Shape_Leng', 'Shape_Area', 'geometry', 'GEOMETRY', 'GlobalID',
    'globalid', 'created_user', 'created_date', 'last_edited_user',
    'last_edited_date', 'layerId', 'layerName', 'featureIndex', 'distance',
    'distanceFormatted'
  ];

  const cleanedProperties = {};
  
  Object.entries(feature.properties).forEach(([key, value]) => {
    if (!excludedKeys.includes(key) && value !== null && value !== undefined && value !== '') {
      // Format the key for better display
      const formattedKey = key
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      cleanedProperties[formattedKey] = value;
    }
  });

  return cleanedProperties;
};

/**
 * Group polygon results by layer category for organized display
 * @param {Array} polygonData - Array of polygon features
 * @returns {Object} Grouped polygon data by category
 */
export const groupPolygonDataByCategory = (polygonData) => {
  const grouped = {};
  
  polygonData.forEach(feature => {
    const layerName = feature.layerName || 'Unknown Layer';
    if (!grouped[layerName]) {
      grouped[layerName] = [];
    }
    grouped[layerName].push({
      properties: extractFeatureProperties(feature),
      layerId: feature.layerId
    });
  });

  return grouped;
};

/**
 * Group nearest points by layer for organized display
 * @param {Array} nearestPoints - Array of point features with distances
 * @returns {Object} Grouped point data by layer
 */
export const groupNearestPointsByLayer = (nearestPoints) => {
  const grouped = {};
  
  nearestPoints.forEach(feature => {
    const layerName = feature.layerName || 'Unknown Layer';
    if (!grouped[layerName]) {
      grouped[layerName] = [];
    }
    grouped[layerName].push({
      properties: extractFeatureProperties(feature),
      distance: feature.distance,
      distanceFormatted: feature.distanceFormatted,
      layerId: feature.layerId
    });
  });

  return grouped;
}; 