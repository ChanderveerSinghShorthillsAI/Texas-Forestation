/**
 * Map utility functions
 */

/**
 * Calculate the bounds of a GeoJSON feature collection
 * @param {Object} geoJsonData - GeoJSON FeatureCollection
 * @returns {Array} - Bounds array [[south, west], [north, east]]
 */
export const calculateBounds = (geoJsonData) => {
  if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) {
    return null;
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  const processCoordinates = (coords) => {
    if (typeof coords[0] === 'number') {
      // Single coordinate pair [lng, lat]
      const [lng, lat] = coords;
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    } else {
      // Array of coordinates
      coords.forEach(processCoordinates);
    }
  };

  geoJsonData.features.forEach(feature => {
    if (feature.geometry && feature.geometry.coordinates) {
      processCoordinates(feature.geometry.coordinates);
    }
  });

  if (minLat === Infinity) {
    return null;
  }

  return [[minLat, minLng], [maxLat, maxLng]];
};

/**
 * Property name mappings for better user understanding
 */
const PROPERTY_MAPPINGS = {
  // County data
  'GEOID10': 'County ID',
  'NAME': 'County Name',
  'POP_2010': 'Population (2010)',
  'POP2010': 'Population (2010)',
  'AGE_5_UNDR': 'Age Under 5',
  'AGE_5_9': 'Age 5-9',
  'AGE_10_14': 'Age 10-14',
  'AGE_15_19': 'Age 15-19',
  'AGE_20_24': 'Age 20-24',
  'AGE_25_29': 'Age 25-29',
  'AGE_30_34': 'Age 30-34',
  'AGE_35_39': 'Age 35-39',
  'AGE_40_44': 'Age 40-44',
  'AGE_45_49': 'Age 45-49',
  'AGE_50_54': 'Age 50-54',
  'AGE_55_59': 'Age 55-59',
  'AGE_60_64': 'Age 60-64',
  'AGE_65_PLUS': 'Age 65+',
  
  // General properties
  'name': 'Name',
  'NAME': 'Name',
  'city': 'City',
  'CITY': 'City',
  'county': 'County',
  'COUNTY': 'County',
  'state': 'State',
  'STATE': 'State',
  'type': 'Type',
  'TYPE': 'Type',
  'area': 'Area',
  'AREA': 'Area',
  'length': 'Length',
  'LENGTH': 'Length',
  'elevation': 'Elevation',
  'ELEVATION': 'Elevation',
  
  // Infrastructure
  'airport_name': 'Airport Name',
  'AIRPORT_NAME': 'Airport Name',
  'runway_length': 'Runway Length',
  'RUNWAY_LENGTH': 'Runway Length',
  
  // Energy
  'capacity': 'Capacity',
  'CAPACITY': 'Capacity',
  'turbine_type': 'Turbine Type',
  'TURBINE_TYPE': 'Turbine Type',
  
  // Parks
  'park_name': 'Park Name',
  'PARK_NAME': 'Park Name',
  'acres': 'Area (Acres)',
  'ACRES': 'Area (Acres)',
  
  // Education
  'region_name': 'Region Name',
  'REGION_NAME': 'Region Name',
  'district': 'District',
  'DISTRICT': 'District',
  
  // Water features
  'river_name': 'River Name',
  'RIVER_NAME': 'River Name',
  'basin_name': 'Basin Name',
  'BASIN_NAME': 'Basin Name',
  'watershed': 'Watershed',
  'WATERSHED': 'Watershed'
};

/**
 * Properties to exclude from popups (technical or redundant data)
 */
const EXCLUDED_PROPERTIES = [
  'OBJECTID', 'objectid', 'FID', 'fid', 'SHAPE_LENG', 'SHAPE_AREA', 
  'Shape_Leng', 'Shape_Area', 'geometry', 'GEOMETRY',
  'GlobalID', 'globalid', 'created_user', 'created_date', 
  'last_edited_user', 'last_edited_date'
];

/**
 * Format property names for display
 * @param {string} key - Property key
 * @returns {string} - Formatted key
 */
export const formatPropertyKey = (key) => {
  // Use mapping if available
  if (PROPERTY_MAPPINGS[key]) {
    return PROPERTY_MAPPINGS[key];
  }
  
  // Otherwise format the key
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/Id/g, 'ID')
    .replace(/Url/g, 'URL')
    .replace(/Api/g, 'API');
};

/**
 * Format property values for display
 * @param {*} value - Property value
 * @param {string} key - Property key for context
 * @returns {string} - Formatted value
 */
export const formatPropertyValue = (value, key) => {
  if (value === null || value === undefined || value === '') {
    return 'Not Available';
  }

  if (typeof value === 'number') {
    // Population and age data
    if (key.toLowerCase().includes('pop') || key.toLowerCase().includes('age')) {
      return value.toLocaleString() + (key.toLowerCase().includes('pop') ? ' people' : ' people');
    }
    
    // Area measurements
    if (key.toLowerCase().includes('area') || key.toLowerCase().includes('acres')) {
      return value.toLocaleString() + ' acres';
    }
    
    // Length measurements
    if (key.toLowerCase().includes('length') || key.toLowerCase().includes('runway')) {
      return value.toLocaleString() + ' ft';
    }
    
    // Elevation
    if (key.toLowerCase().includes('elevation')) {
      return value.toLocaleString() + ' ft above sea level';
    }
    
    // Capacity
    if (key.toLowerCase().includes('capacity')) {
      return value.toLocaleString() + ' MW';
    }
    
    // Format large numbers with commas
    if (value > 999) {
      return value.toLocaleString();
    }
    return value.toString();
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'string') {
    // Truncate very long strings
    if (value.length > 150) {
      return value.substring(0, 147) + '...';
    }
    return value;
  }

  return String(value);
};

/**
 * Create meaningful popup content from feature properties
 * @param {Object} properties - Feature properties
 * @param {string} layerType - Type of layer (for context)
 * @returns {string} - HTML content for popup
 */
export const createMeaningfulPopup = (properties, layerType = '') => {
  if (!properties || Object.keys(properties).length === 0) {
    return '<div class="popup-content"><p class="no-data">No information available for this feature.</p></div>';
  }

  // Filter out excluded properties and empty values
  const relevantEntries = Object.entries(properties)
    .filter(([key, value]) => 
      !EXCLUDED_PROPERTIES.includes(key) &&
      value !== null && 
      value !== undefined && 
      value !== ''
    );

  if (relevantEntries.length === 0) {
    return '<div class="popup-content"><p class="no-data">No detailed information available.</p></div>';
  }

  // Sort entries to show most important info first
  const sortedEntries = relevantEntries.sort(([keyA], [keyB]) => {
    const priorityOrder = ['NAME', 'name', 'COUNTY', 'county', 'POP2010', 'POP_2010'];
    const priorityA = priorityOrder.indexOf(keyA);
    const priorityB = priorityOrder.indexOf(keyB);
    
    if (priorityA !== -1 && priorityB !== -1) return priorityA - priorityB;
    if (priorityA !== -1) return -1;
    if (priorityB !== -1) return 1;
    return keyA.localeCompare(keyB);
  });

  // Create header if we have a name
  const nameEntry = sortedEntries.find(([key]) => 
    key.toLowerCase() === 'name' || key === 'NAME'
  );

  let content = '<div class="popup-content">';
  
  if (nameEntry) {
    content += `<h3 class="popup-title">${nameEntry[1]}</h3>`;
  }

  // Group demographics data
  const demographics = sortedEntries.filter(([key]) => 
    key.toLowerCase().includes('age') || key.toLowerCase().includes('pop')
  );
  
  const otherData = sortedEntries.filter(([key]) => 
    !key.toLowerCase().includes('age') && 
    !key.toLowerCase().includes('pop') &&
    key.toLowerCase() !== 'name'
  );

  // Display main information first
  if (otherData.length > 0) {
    content += '<div class="popup-section">';
    otherData.slice(0, 6).forEach(([key, value]) => {
      const formattedKey = formatPropertyKey(key);
      const formattedValue = formatPropertyValue(value, key);
      content += `<div class="popup-item">
        <span class="popup-label">${formattedKey}:</span> 
        <span class="popup-value">${formattedValue}</span>
      </div>`;
    });
    content += '</div>';
  }

  // Display demographics if available
  if (demographics.length > 0) {
    content += '<div class="popup-section demographics">';
    content += '<h5 class="section-title">Demographics</h5>';
    demographics.slice(0, 8).forEach(([key, value]) => {
      const formattedKey = formatPropertyKey(key);
      const formattedValue = formatPropertyValue(value, key);
      content += `<div class="popup-item">
        <span class="popup-label">${formattedKey}:</span> 
        <span class="popup-value">${formattedValue}</span>
      </div>`;
    });
    content += '</div>';
  }

  content += '</div>';
  return content;
};

/**
 * Get color based on feature type or property
 * @param {Object} feature - GeoJSON feature
 * @param {Object} layerConfig - Layer configuration
 * @returns {string} - Color hex code
 */
export const getFeatureColor = (feature, layerConfig) => {
  // Use layer-defined color as default
  let color = layerConfig.color || '#3b82f6';

  // You can add logic here to color features based on properties
  // For example, different colors for different counties, etc.
  
  return color;
};

/**
 * Check if a coordinate is within Texas bounds (rough)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} - Whether coordinate is in Texas
 */
export const isWithinTexas = (lat, lng) => {
  // Rough bounding box for Texas
  const texasBounds = {
    north: 36.5,
    south: 25.5,
    east: -93.5,
    west: -106.5
  };

  return lat >= texasBounds.south && 
         lat <= texasBounds.north && 
         lng >= texasBounds.west && 
         lng <= texasBounds.east;
};

/**
 * Debounce function for performance optimization
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}; 