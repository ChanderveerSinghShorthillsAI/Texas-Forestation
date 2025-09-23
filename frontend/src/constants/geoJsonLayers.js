// GeoJSON layer definitions for Texas map visualization
// Organized by category and size for optimal performance

export const LAYER_CATEGORIES = {
  BOUNDARIES: 'boundaries',
  INFRASTRUCTURE: 'infrastructure',
  NATURAL_FEATURES: 'natural_features',
  ENERGY: 'energy',
  EDUCATION: 'education',
  ADMINISTRATION: 'administration',
  WATER_RESOURCES: 'water_resources',
  DEMOGRAPHICS: 'demographics',
  TRANSPORTATION: 'transportation',
  ENVIRONMENTAL: 'environmental',
  RECREATION: 'recreation',
  AGRICULTURE: 'agriculture'
};

export const GEOJSON_LAYERS = [
  // ===== BOUNDARIES =====
  {
    id: 'texas-boundary',
    name: 'Texas State Boundary',
    file: 'texas.geojson',
    category: LAYER_CATEGORIES.BOUNDARIES,
    type: 'polygon',
    color: '#2563eb',
    fillColor: '#3b82f6',
    fillOpacity: 0.1,
    weight: 3,
    description: 'Texas state boundary outline'
  },
  {
    id: 'counties',
    name: 'Texas Counties',
    file: 'Texas_Counties.geojson',
    category: LAYER_CATEGORIES.BOUNDARIES,
    type: 'polygon',
    color: '#1f2937',
    fillColor: 'transparent',
    fillOpacity: 0,
    weight: 3,
    opacity: 0.9,
    showLabels: false,
    showLabelsOnHover: true,
    isDefault: true,
    description: 'County boundaries across Texas'
  },
  {
    id: 'counties-2010',
    name: 'Counties (2010)',
    file: 'counties_2010.geojson',
    category: LAYER_CATEGORIES.BOUNDARIES,
    type: 'polygon',
    color: '#dc2626',
    fillColor: '#ef4444',
    fillOpacity: 0.15,
    weight: 1.5,
    description: 'County boundaries from 2010 census'
  },
  {
    id: 'boundary-with-counties',
    name: 'Texas Boundary with Counties',
    file: 'Texas_Boundary_data_with_counties.geojson',
    category: LAYER_CATEGORIES.BOUNDARIES,
    type: 'polygon',
    color: '#1e40af',
    fillColor: '#3b82f6',
    fillOpacity: 0.1,
    weight: 2,
    description: 'Texas boundary with county subdivisions'
  },
  {
    id: 'boundary-counties-subdivisions',
    name: 'Boundary with Subdivisions',
    file: 'Texas_boundary_with_counties_with_subdivisions.geojson',
    category: LAYER_CATEGORIES.BOUNDARIES,
    type: 'polygon',
    color: '#1e40af',
    fillColor: '#3b82f6',
    fillOpacity: 0.1,
    weight: 2,
    description: 'Texas boundary with detailed subdivisions'
  },
  {
    id: 'boundary-data',
    name: 'Texas Boundary Data',
    file: 'Texas_Boundary_data.geojson',
    category: LAYER_CATEGORIES.BOUNDARIES,
    type: 'polygon',
    color: '#1e40af',
    fillColor: '#3b82f6',
    fillOpacity: 0.1,
    weight: 2,
    description: 'Detailed Texas boundary data'
  },

  // ===== ADMINISTRATION =====
  {
    id: 'cities',
    name: 'Major Cities',
    file: 'Texas_cities.geojson',
    category: LAYER_CATEGORIES.ADMINISTRATION,
    type: 'point',
    color: '#ffffff',
    fillColor: '#7c3aed',
    radius: 12,
    weight: 3,
    fillOpacity: 0.9,
    description: 'Major cities in Texas'
  },
  {
    id: 'county-seats',
    name: 'County Seats',
    file: 'Texas_county_seats.geojson',
    category: LAYER_CATEGORIES.ADMINISTRATION,
    type: 'point',
    color: '#ffffff',
    fillColor: '#059669',
    radius: 10,
    weight: 2,
    fillOpacity: 0.9,
    description: 'County seat locations'
  },
  {
    id: 'military-lands',
    name: 'Military Lands',
    file: 'Texas_military_lands.geojson',
    category: LAYER_CATEGORIES.ADMINISTRATION,
    type: 'polygon',
    color: '#991b1b',
    fillColor: '#dc2626',
    fillOpacity: 0.3,
    weight: 2,
    description: 'Military installation boundaries'
  },
  {
    id: 'populated-places',
    name: 'Populated Places',
    file: 'Texas_populated_places.geojson',
    category: LAYER_CATEGORIES.ADMINISTRATION,
    type: 'point',
    color: '#ffffff',
    fillColor: '#7c3aed',
    radius: 8,
    weight: 2,
    fillOpacity: 0.8,
    description: 'All populated places in Texas'
  },
  {
    id: 'populated-areas',
    name: 'Populated Areas',
    file: 'Texas_Populated_areas.geojson',
    category: LAYER_CATEGORIES.ADMINISTRATION,
    type: 'polygon',
    color: '#7c3aed',
    fillColor: '#a855f7',
    fillOpacity: 0.2,
    weight: 1,
    description: 'Populated area boundaries'
  },
  {
    id: 'voting-districts',
    name: 'Voting Districts',
    file: 'Texas_votinga_districts.geojson',
    category: LAYER_CATEGORIES.ADMINISTRATION,
    type: 'polygon',
    color: '#7c2d12',
    fillColor: '#ea580c',
    fillOpacity: 0.2,
    weight: 1,
    description: 'Voting district boundaries'
  },
  {
    id: 'regional-authorities',
    name: 'Regional Authorities',
    file: 'Texas_regional_authorities_and_special_laws_districts.geojson',
    category: LAYER_CATEGORIES.ADMINISTRATION,
    type: 'polygon',
    color: '#7c2d12',
    fillColor: '#ea580c',
    fillOpacity: 0.2,
    weight: 1,
    description: 'Regional authorities and special law districts'
  },

  // ===== INFRASTRUCTURE =====
  {
    id: 'airports',
    name: 'Airports',
    file: 'Texas_airports.geojson',
    category: LAYER_CATEGORIES.INFRASTRUCTURE,
    type: 'point',
    color: '#0891b2',
    radius: 5,
    fillOpacity: 0.8,
    description: 'Airport locations across Texas'
  },
  {
    id: 'railroads',
    name: 'Railroads',
    file: 'Texas_railroads.geojson',
    category: LAYER_CATEGORIES.TRANSPORTATION,
    type: 'line',
    color: '#7c2d12',
    weight: 2,
    description: 'Railroad lines across Texas'
  },
  {
    id: 'roads',
    name: 'Roads',
    file: 'Texas_roads.geojson',
    category: LAYER_CATEGORIES.TRANSPORTATION,
    type: 'line',
    color: '#6b7280',
    weight: 1,
    description: 'Road network across Texas'
  },

  // ===== WATER RESOURCES =====
  {
    id: 'major-rivers',
    name: 'Major Rivers',
    file: 'Texas_major_rivers.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'line',
    color: '#0ea5e9',
    weight: 3,
    description: 'Major river systems in Texas'
  },
  {
    id: 'rivers',
    name: 'All Rivers',
    file: 'Texas_rivers.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'line',
    color: '#0ea5e9',
    weight: 2,
    description: 'Complete river network in Texas'
  },
  {
    id: 'river-basins',
    name: 'River Basins',
    file: 'Texas_river_basins.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#0284c7',
    fillColor: '#0ea5e9',
    fillOpacity: 0.15,
    weight: 2,
    description: 'River basin boundaries'
  },
  {
    id: 'major-river-basins',
    name: 'Major River Basins',
    file: 'Texas_major_river_basins.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#0284c7',
    fillColor: '#0ea5e9',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Major river basin boundaries'
  },
  {
    id: 'river-boundaries',
    name: 'River Boundaries',
    file: 'Texas_river_boundaries.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#0284c7',
    fillColor: '#0ea5e9',
    fillOpacity: 0.15,
    weight: 1,
    description: 'River boundary areas'
  },
  {
    id: 'rivers-by-watersheds',
    name: 'Rivers by Watersheds',
    file: 'Texas_rivers_by_watersheds.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'line',
    color: '#0ea5e9',
    weight: 2,
    description: 'Rivers organized by watershed'
  },
  {
    id: 'watersheds',
    name: 'Watersheds',
    file: 'Texas_watersheds.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#0284c7',
    fillColor: '#0ea5e9',
    fillOpacity: 0.15,
    weight: 1,
    description: 'Watershed boundaries'
  },
  {
    id: 'existing-reservoirs',
    name: 'Existing Reservoirs',
    file: 'Texas_existing_reservoirs.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#0ea5e9',
    fillColor: '#0ea5e9',
    fillOpacity: 0.3,
    weight: 2,
    description: 'Existing reservoir locations'
  },
  {
    id: 'regional-water-planning',
    name: 'Regional Water Planning Areas',
    file: 'Texas_Regional_water_planning_areas.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#0ea5e9',
    fillColor: '#0ea5e9',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Regional water planning areas'
  },
  {
    id: 'groundwater-management',
    name: 'Groundwater Management Areas',
    file: 'Texas_Ground_Water_Management_Areas.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#0ea5e9',
    fillColor: '#0ea5e9',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Groundwater management areas'
  },
  {
    id: 'groundwater-management-detail',
    name: 'Groundwater Management (Detail)',
    file: 'Texas_fround_water_management_areas_detail.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#0ea5e9',
    fillColor: '#0ea5e9',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Detailed groundwater management areas'
  },
  {
    id: 'groundwater-conservation',
    name: 'Groundwater Conservation Districts',
    file: 'Texas_Groundwater_conservation_districts.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#0ea5e9',
    fillColor: '#0ea5e9',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Groundwater conservation districts'
  },
  {
    id: 'groundwater',
    name: 'Groundwater',
    file: 'Texas_Groundwater.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#0ea5e9',
    fillColor: '#0ea5e9',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Groundwater data'
  },
  {
    id: 'major-aquifers',
    name: 'Major Aquifers',
    file: 'Texas_major_aquafiers.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#1e40af',
    fillColor: '#3b82f6',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Major groundwater aquifer systems'
  },
  {
    id: 'minor-aquifers',
    name: 'Minor Aquifers',
    file: 'Texas_minor_aquafiers.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#1e40af',
    fillColor: '#3b82f6',
    fillOpacity: 0.15,
    weight: 1,
    description: 'Minor aquifer systems'
  },
  {
    id: 'priority-groundwater',
    name: 'Priority Groundwater Areas',
    file: 'Texas_priority_groundwater_management_areas.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#1e40af',
    fillColor: '#3b82f6',
    fillOpacity: 0.25,
    weight: 2,
    description: 'Priority groundwater management areas'
  },
  {
    id: 'flood-planning-groups',
    name: 'Flood Planning Groups',
    file: 'Texas_Flood_Planning_Groups.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#0ea5e9',
    fillColor: '#0ea5e9',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Flood planning groups'
  },
  {
    id: 'hydraulic-unit-code',
    name: 'Hydraulic Unit Code',
    file: 'Texas_yhdrolic_unit_code.geojson',
    category: LAYER_CATEGORIES.WATER_RESOURCES,
    type: 'polygon',
    color: '#0ea5e9',
    fillColor: '#0ea5e9',
    fillOpacity: 0.15,
    weight: 1,
    description: 'Hydraulic unit code boundaries'
  },

  // ===== ENERGY =====
  {
    id: 'wind-turbines',
    name: 'Wind Turbine Locations',
    file: 'Texas_wind_turbine_locations.geojson',
    category: LAYER_CATEGORIES.ENERGY,
    type: 'point',
    color: '#16a34a',
    radius: 3,
    fillOpacity: 0.6,
    description: 'Wind turbine installation sites'
  },
  {
    id: 'wind-power-potential',
    name: 'Wind Power Potential',
    file: 'texas_wind_power_potential.geojson',
    category: LAYER_CATEGORIES.ENERGY,
    type: 'polygon',
    color: '#16a34a',
    fillColor: '#22c55e',
    fillOpacity: 0.2,
    weight: 1,
    description: 'Wind power potential areas'
  },
  {
    id: 'oil-gas-basins',
    name: 'Oil & Natural Gas Basins',
    file: 'Texas_Oil_And_Natural_Gas_Basins.geojson',
    category: LAYER_CATEGORIES.ENERGY,
    type: 'polygon',
    color: '#ea580c',
    fillColor: '#f97316',
    fillOpacity: 0.25,
    weight: 2,
    description: 'Oil and natural gas basin areas'
  },
  {
    id: 'oil-production',
    name: 'Oil Production',
    file: 'Texas_Oil_Production.geojson',
    category: LAYER_CATEGORIES.ENERGY,
    type: 'polygon',
    color: '#ea580c',
    fillColor: '#f97316',
    fillOpacity: 0.25,
    weight: 2,
    description: 'Oil production areas'
  },
  {
    id: 'natural-gas-production',
    name: 'Natural Gas Production',
    file: 'Texas_Natural_Gas_Production.geojson',
    category: LAYER_CATEGORIES.ENERGY,
    type: 'polygon',
    color: '#ea580c',
    fillColor: '#f97316',
    fillOpacity: 0.25,
    weight: 2,
    description: 'Natural gas production areas'
  },
  {
    id: 'coal-production',
    name: 'Coal Production',
    file: 'Texas_Coal_Production.geojson',
    category: LAYER_CATEGORIES.ENERGY,
    type: 'polygon',
    color: '#92400e',
    fillColor: '#f59e0b',
    fillOpacity: 0.25,
    weight: 2,
    description: 'Coal production areas'
  },
  {
    id: 'coal-deposits',
    name: 'Coal Deposits',
    file: 'Texas_coal_deposits.geojson',
    category: LAYER_CATEGORIES.ENERGY,
    type: 'polygon',
    color: '#92400e',
    fillColor: '#f59e0b',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Coal deposit locations'
  },
  {
    id: 'geothermal-potential',
    name: 'Geothermal Potential',
    file: 'Texas_Geothermal_Potential.geojson',
    category: LAYER_CATEGORIES.ENERGY,
    type: 'polygon',
    color: '#dc2626',
    fillColor: '#ef4444',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Geothermal energy potential areas'
  },
  {
    id: 'solar-power-potential',
    name: 'Solar Power Potential',
    file: 'Texas_solar_powe_potential.geojson',
    category: LAYER_CATEGORIES.ENERGY,
    type: 'polygon',
    color: '#f59e0b',
    fillColor: '#fbbf24',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Solar power potential areas'
  },
  {
    id: 'biomass-crop-residue',
    name: 'Biomass Crop Residue',
    file: 'Texas_Biomass_Crop_Residue_Biomass.geojson',
    category: LAYER_CATEGORIES.ENERGY,
    type: 'polygon',
    color: '#16a34a',
    fillColor: '#22c55e',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Biomass crop residue areas'
  },
  {
    id: 'biomass-woodmill-residue',
    name: 'Biomass Woodmill Residue',
    file: 'Texas_Biomass_Woodmill_Residue_Biomass.geojson',
    category: LAYER_CATEGORIES.ENERGY,
    type: 'polygon',
    color: '#16a34a',
    fillColor: '#22c55e',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Biomass woodmill residue areas'
  },
  {
    id: 'plugging-report',
    name: 'Plugging Report',
    file: 'Texas_plugging_report.geojson',
    category: LAYER_CATEGORIES.ENERGY,
    type: 'point',
    color: '#ea580c',
    radius: 2,
    fillOpacity: 0.6,
    description: 'Oil/gas well plugging report locations'
  },
  {
    id: 'well-locations',
    name: 'Well Locations',
    file: 'Texas_well_location.geojson',
    category: LAYER_CATEGORIES.ENERGY,
    type: 'point',
    color: '#ea580c',
    radius: 2,
    fillOpacity: 0.6,
    description: 'Oil and gas well locations'
  },
  {
    id: 'PCFA-regions',
    name: 'PCFA Regions',
    file: 'Texas_PCFA_regions_and_field_office.geojson',
    category: LAYER_CATEGORIES.ENERGY,
    type: 'polygon',
    color: '#ea580c',
    fillColor: '#f97316',
    fillOpacity: 0.2,
    weight: 2,
    description: 'PCFA regions and field offices'
  },

  // ===== EDUCATION =====
  {
    id: 'education-regions',
    name: 'Education Regions',
    file: 'Texas_education_region.geojson',
    category: LAYER_CATEGORIES.EDUCATION,
    type: 'polygon',
    color: '#7c2d12',
    fillColor: '#ea580c',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Educational service regions'
  },
  {
    id: 'school-locations',
    name: 'School Locations',
    file: 'Texas_school_locations.geojson',
    category: LAYER_CATEGORIES.EDUCATION,
    type: 'point',
    color: '#7c2d12',
    radius: 3,
    fillOpacity: 0.6,
    description: 'School locations across Texas'
  },
  {
    id: 'school-regions',
    name: 'School Regions',
    file: 'Texas_school_region.geojson',
    category: LAYER_CATEGORIES.EDUCATION,
    type: 'polygon',
    color: '#7c2d12',
    fillColor: '#ea580c',
    fillOpacity: 0.2,
    weight: 2,
    description: 'School region boundaries'
  },
  {
    id: 'schools-2012',
    name: 'Schools (2012)',
    file: 'Texas_schools_2012.geojson',
    category: LAYER_CATEGORIES.EDUCATION,
    type: 'point',
    color: '#7c2d12',
    radius: 3,
    fillOpacity: 0.6,
    description: 'School locations from 2012'
  },
  {
    id: 'school-districts',
    name: 'School Districts',
    file: 'Texas_schooldistricts_2012_2013.geojson',
    category: LAYER_CATEGORIES.EDUCATION,
    type: 'polygon',
    color: '#7c2d12',
    fillColor: '#ea580c',
    fillOpacity: 0.2,
    weight: 2,
    description: 'School district boundaries'
  },
  {
    id: 'tea-regions',
    name: 'TEA Regions (2007)',
    file: 'Texas_tea_regions_2007.geojson',
    category: LAYER_CATEGORIES.EDUCATION,
    type: 'polygon',
    color: '#7c2d12',
    fillColor: '#ea580c',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Texas Education Agency regions from 2007'
  },

  // ===== NATURAL FEATURES =====
  {
    id: 'state-parks-points',
    name: 'State Parks (Points)',
    file: 'Texas_state_parks_points.geojson',
    category: LAYER_CATEGORIES.RECREATION,
    type: 'point',
    color: '#15803d',
    radius: 5,
    fillOpacity: 0.8,
    description: 'State park locations'
  },
  {
    id: 'state-parks-polygon',
    name: 'State Parks (Areas)',
    file: 'Texas_state_parks_polygon.geojson',
    category: LAYER_CATEGORIES.RECREATION,
    type: 'polygon',
    color: '#15803d',
    fillColor: '#22c55e',
    fillOpacity: 0.3,
    weight: 2,
    description: 'State park boundaries'
  },
  {
    id: 'state-parks-texas',
    name: 'State Parks (Texas)',
    file: 'Texas_state_parks.geojson',
    category: LAYER_CATEGORIES.RECREATION,
    type: 'polygon',
    color: '#15803d',
    fillColor: '#22c55e',
    fillOpacity: 0.3,
    weight: 2,
    description: 'Texas state parks'
  },
  {
    id: 'wildlife-management',
    name: 'Wildlife Management Areas',
    file: 'Texas_wildlife_management_areas.geojson',
    category: LAYER_CATEGORIES.ENVIRONMENTAL,
    type: 'polygon',
    color: '#15803d',
    fillColor: '#22c55e',
    fillOpacity: 0.25,
    weight: 2,
    description: 'Wildlife management areas'
  },
  {
    id: 'wildlife-refuges',
    name: 'Wildlife Refuges',
    file: 'Texas_wildlife_refugees.geojson',
    category: LAYER_CATEGORIES.ENVIRONMENTAL,
    type: 'polygon',
    color: '#15803d',
    fillColor: '#22c55e',
    fillOpacity: 0.25,
    weight: 2,
    description: 'Wildlife refuge areas'
  },
  {
    id: 'wetlands',
    name: 'Wetlands',
    file: 'Texas_wetlands.geojson',
    category: LAYER_CATEGORIES.ENVIRONMENTAL,
    type: 'polygon',
    color: '#0ea5e9',
    fillColor: '#0ea5e9',
    fillOpacity: 0.25,
    weight: 1,
    description: 'Wetland areas'
  },
  {
    id: 'surface-geology',
    name: 'Surface Geology',
    file: 'Texas_surface_geology.geojson',
    category: LAYER_CATEGORIES.ENVIRONMENTAL,
    type: 'polygon',
    color: '#92400e',
    fillColor: '#f59e0b',
    fillOpacity: 0.2,
    weight: 1,
    description: 'Surface geology formations'
  },
  {
    id: 'soil-map',
    name: 'Soil Map',
    file: 'Texas_soil_map.geojson',
    category: LAYER_CATEGORIES.ENVIRONMENTAL,
    type: 'polygon',
    color: '#92400e',
    fillColor: '#f59e0b',
    fillOpacity: 0.15,
    weight: 1,
    description: 'Soil type mapping'
  },
  {
    id: 'ecological-provinces',
    name: 'Ecological Provinces',
    file: 'Texas_ecological_provinces.geojson',
    category: LAYER_CATEGORIES.ENVIRONMENTAL,
    type: 'polygon',
    color: '#15803d',
    fillColor: '#22c55e',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Ecological province boundaries'
  },
  {
    id: 'ecological-sections',
    name: 'Ecological Sections',
    file: 'Texas_ecological_section.geojson',
    category: LAYER_CATEGORIES.ENVIRONMENTAL,
    type: 'polygon',
    color: '#15803d',
    fillColor: '#22c55e',
    fillOpacity: 0.2,
    weight: 2,
    description: 'Ecological section boundaries'
  },
  {
    id: 'precipitation',
    name: 'Precipitation',
    file: 'Texas_precipitation.geojson',
    category: LAYER_CATEGORIES.ENVIRONMENTAL,
    type: 'polygon',
    color: '#0ea5e9',
    fillColor: '#0ea5e9',
    fillOpacity: 0.2,
    weight: 1,
    description: 'Precipitation data'
  },
  {
    id: 'cemeteries',
    name: 'Cemeteries',
    file: 'Texas_cemetries.geojson',
    category: LAYER_CATEGORIES.ADMINISTRATION,
    type: 'point',
    color: '#ffffff',
    fillColor: '#6b7280',
    radius: 8,
    weight: 2,
    fillOpacity: 0.8,
    description: 'Cemetery locations'
  },

  // ===== DEMOGRAPHICS =====
  {
    id: 'census-tracts',
    name: 'Census Tracts',
    file: 'Texas_census_tracts.geojson',
    category: LAYER_CATEGORIES.DEMOGRAPHICS,
    type: 'polygon',
    color: '#7c3aed',
    fillColor: '#a855f7',
    fillOpacity: 0.15,
    weight: 1,
    description: 'Census tract boundaries'
  },
  {
    id: 'census-block-groups',
    name: 'Census Block Groups',
    file: 'Texas_census_block_groups.geojson',
    category: LAYER_CATEGORIES.DEMOGRAPHICS,
    type: 'polygon',
    color: '#7c3aed',
    fillColor: '#a855f7',
    fillOpacity: 0.1,
    weight: 1,
    description: 'Census block group boundaries'
  },
  {
    id: 'tracts-2010',
    name: 'Tracts (2010)',
    file: 'Texas_tracts_2010.geojson',
    category: LAYER_CATEGORIES.DEMOGRAPHICS,
    type: 'polygon',
    color: '#7c3aed',
    fillColor: '#a855f7',
    fillOpacity: 0.15,
    weight: 1,
    description: 'Census tracts from 2010'
  },
  {
    id: 'race-population',
    name: 'Race-wise Population',
    file: 'Texas_race_wise_population.geojson',
    category: LAYER_CATEGORIES.DEMOGRAPHICS,
    type: 'polygon',
    color: '#7c3aed',
    fillColor: '#a855f7',
    fillOpacity: 0.2,
    weight: 1,
    description: 'Population data by race'
  },

  // ===== AGRICULTURE =====
  {
    id: 'tx-1degree',
    name: 'Texas 1 Degree Grid',
    file: 'Texas_tx_1degree_dd.geojson',
    category: LAYER_CATEGORIES.AGRICULTURE,
    type: 'polygon',
    color: '#16a34a',
    fillColor: '#22c55e',
    fillOpacity: 0.1,
    weight: 1,
    description: '1-degree grid for agricultural planning'
  }
];

// Texas boundary coordinates for map centering
export const TEXAS_BOUNDS = {
  center: [31.0, -99.0],
  zoom: 6,
  maxBounds: [
    [25.5, -106.5], // Southwest corner
    [36.5, -93.5]   // Northeast corner
  ]
};

// Layer styling defaults
export const DEFAULT_STYLES = {
  point: {
    radius: 5,
    fillColor: '#3b82f6',
    color: '#1e40af',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8
  },
  line: {
    color: '#3b82f6',
    weight: 3,
    opacity: 0.8
  },
  polygon: {
    fillColor: '#3b82f6',
    weight: 2,
    opacity: 1,
    color: '#1e40af',
    fillOpacity: 0.2
  }
};

export const getLayersByCategory = (category) => {
  return GEOJSON_LAYERS.filter(layer => layer.category === category);
};

export const getDefaultLayers = () => {
  return GEOJSON_LAYERS.filter(layer => layer.isDefault);
};

export const getLayerById = (id) => {
  return GEOJSON_LAYERS.find(layer => layer.id === id);
}; 