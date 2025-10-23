/**
 * Tour Guide Configuration for Texas Vanrakshak
 * Defines all tour steps for different pages and features
 */

// Landing Page Tour Steps
export const landingPageTourSteps = [
  {
    title: "Welcome to Texas Vanrakshak! 🌲",
    content: "Welcome to Texas Vanrakshak - your comprehensive AI-powered forest management platform. Let me show you around! This tour will introduce you to all the powerful features available.",
    target: ".landing-nav",
    order: 1,
    group: "landing-tour",
  },
  {
    title: "Navigation Bar 🧭",
    content: "Use this navigation bar to quickly access any feature. You have direct links to Encroachment Tracking, USGS Wildfire prediction, Fire Tracking, Satellite Comparison, and the Forestation Planner.",
    target: ".nav-links",
    order: 2,
    group: "landing-tour",
  },
  {
    title: "User Profile 👤",
    content: "Your user profile is displayed here. You can logout anytime using the logout button.",
    target: ".nav-user",
    order: 3,
    group: "landing-tour",
  },
  {
    title: "Platform Overview 🚀",
    content: "Texas Vanrakshak protects Texas forests using AI-powered intelligence, satellite imagery, and real-time data analytics. It's your complete solution for sustainable forest management.",
    target: ".hero-content",
    order: 4,
    group: "landing-tour",
  },
  {
    title: "Core Capabilities 💪",
    content: "Our platform offers four core capabilities: Satellite Intelligence for imagery analysis, Proactive Protection with AI-driven alerts, Predictive Analytics for forecasting, and Comprehensive Coverage across all Texas forests.",
    target: ".capabilities-section",
    order: 5,
    group: "landing-tour",
  },
  {
    title: "USGS Wildfire Forecast 🔥",
    content: "Advanced wildfire prediction powered by USGS data. Get real-time alerts, risk assessments, and historical data analysis to proactively manage fire risks.",
    target: ".feature-card:nth-child(1)",
    order: 6,
    group: "landing-tour",
  },
  {
    title: "Fire Tracking 🔥",
    content: "Comprehensive fire tracking system with real-time monitoring of active fires across Texas. Access historical data, geospatial analysis, and detailed incident reports.",
    target: ".feature-card:nth-child(2)",
    order: 7,
    group: "landing-tour",
  },
  {
    title: "Satellite Comparison 🛰️",
    content: "Compare satellite imagery across different time periods. Perform NDVI analysis, detect changes in forest cover, and monitor ecosystem health with multi-spectral imaging.",
    target: ".feature-card:nth-child(3)",
    order: 8,
    group: "landing-tour",
  },
  {
    title: "Encroachment Tracking 🛡️",
    content: "AI-powered detection system to monitor forest encroachment activities. Identify illegal deforestation, unauthorized construction, and protect forest boundaries with real-time alerts.",
    target: ".feature-card:nth-child(4)",
    order: 9,
    group: "landing-tour",
  },
  {
    title: "Texas Forestation Planner 🌳",
    content: "Strategic planning tool for forestation projects. Estimate carbon sequestration potential, analyze site suitability, select appropriate species, and assess environmental impact.",
    target: ".feature-card:nth-child(5)",
    order: 10,
    group: "landing-tour",
  },
  {
    title: "Technology Stack 💻",
    content: "Powered by cutting-edge technology including Sentinel-2 & Landsat satellites, TensorFlow & PyTorch for machine learning, GIS & GDAL for geospatial analysis, and real-time cloud processing.",
    target: ".technology-section",
    order: 11,
    group: "landing-tour",
  },
  {
    title: "Ready to Explore! 🎉",
    content: "You're all set! Click on any feature card to get started, or use the 'Launch Platform' button to begin with the Forestation Planner. Each feature has its own detailed tour guide to help you.",
    target: ".cta-section",
    order: 12,
    group: "landing-tour",
  }
];

// Texas Forestation Planner Tour Steps
export const forestationPlannerTourSteps = [
  {
    title: "Welcome to Forestation Planner! 🌳",
    content: "This is your main planning workspace. Here you can analyze land suitability, plan forestation projects, and estimate carbon sequestration potential.",
    target: ".leaflet-container",
    order: 1,
    group: "planner-tour",
  },
  {
    title: "Map Controls 🗺️",
    content: "Use the zoom controls to navigate the map. You can zoom in/out and reset the view. The map shows Texas counties and forest areas.",
    target: ".leaflet-control-zoom",
    order: 2,
    group: "planner-tour",
  },
  {
    title: "Layer Selector 📊",
    content: "Select different GeoJSON layers to visualize various data on the map. Choose from county boundaries, forest areas, protected regions, and more.",
    target: "[data-tour-id='layer-selector']",
    order: 3,
    group: "planner-tour",
  },
  {
    title: "Carbon Estimation 🌿",
    content: "This powerful feature estimates carbon sequestration potential for selected areas. Click here to open the carbon estimation panel and analyze environmental impact.",
    target: "[data-tour-id='carbon-button']",
    order: 4,
    group: "planner-tour",
  },
  {
    title: "Carbon Estimation Panel 📈",
    content: "The Carbon Estimation Panel provides detailed analysis including total carbon stock, annual sequestration rates, and CO2 equivalent calculations. You can analyze specific counties or custom areas.",
    target: "[data-tour-id='carbon-panel']",
    order: 5,
    group: "planner-tour",
  },
  {
    title: "Plantation Plan Generator 🌱",
    content: "Generate comprehensive forestation plans with species recommendations, planting strategies, and timeline projections. This tool helps you create data-driven afforestation projects.",
    target: "[data-tour-id='plantation-generator']",
    order: 6,
    group: "planner-tour",
  },
  {
    title: "Query Results 📋",
    content: "View detailed spatial query results here. You'll see area calculations, forest coverage statistics, and recommendations based on your selected region.",
    target: "[data-tour-id='query-results']",
    order: 7,
    group: "planner-tour",
  },
  {
    title: "Historical Fire Data 📊",
    content: "Access historical wildfire data for Texas including deadliest fires, most destructive fires, and comprehensive statistics to inform your planning decisions.",
    target: "[data-tour-id='historical-fire-button']",
    order: 8,
    group: "planner-tour",
  },
  {
    title: "Start Planning! ✨",
    content: "You're ready to start planning! Select a layer, click on the map to analyze areas, and use the tools to create effective forestation strategies.",
    target: ".leaflet-container",
    order: 9,
    group: "planner-tour",
  }
];

// Encroachment Tracking Tour Steps
export const encroachmentTrackingTourSteps = [
  {
    title: "Welcome to Encroachment Tracking! 🛡️",
    content: "This AI-powered system helps you monitor and track forest encroachment activities across Texas. Let's explore the features!",
    target: "[data-tour-id='encroachment-header']",
    order: 1,
    group: "encroachment-tour",
  },
  {
    title: "Statistics Dashboard 📊",
    content: "View real-time statistics including total alerts, high-risk areas, affected forest area, and recent activities. These metrics are updated continuously.",
    target: "[data-tour-id='encroachment-stats']",
    order: 2,
    group: "encroachment-tour",
  },
  {
    title: "Filter Controls 🎛️",
    content: "Use these filters to refine your view. Filter by severity level (Critical, High, Medium, Low), time period, county, and alert status to focus on specific concerns.",
    target: "[data-tour-id='encroachment-filters']",
    order: 3,
    group: "encroachment-tour",
  },
  {
    title: "Interactive Map 🗺️",
    content: "The map displays all encroachment alerts as color-coded markers. Red indicates critical alerts, orange for high risk, yellow for medium, and blue for low risk areas.",
    target: "[data-tour-id='encroachment-map']",
    order: 4,
    group: "encroachment-tour",
  },
  {
    title: "Alerts List 📋",
    content: "Browse detailed information about each alert including location, severity, detection date, affected area, and current status. Click on any alert to view it on the map.",
    target: "[data-tour-id='encroachment-alerts-list']",
    order: 5,
    group: "encroachment-tour",
  },
  {
    title: "Geographic Distribution 🌍",
    content: "The system provides geographic distribution analysis showing which counties and regions are most affected by encroachment activities.",
    target: "[data-tour-id='encroachment-map']",
    order: 6,
    group: "encroachment-tour",
  },
  {
    title: "Alert Actions 🚨",
    content: "For each alert, you can view details, mark as investigated, update status, or generate reports. This helps in systematic monitoring and response.",
    target: "[data-tour-id='encroachment-alerts-list']",
    order: 7,
    group: "encroachment-tour",
  },
  {
    title: "Start Monitoring! 👁️",
    content: "You're all set! Use the filters to explore different alert types, click on markers to see details, and track forest protection efforts in real-time.",
    target: "[data-tour-id='encroachment-header']",
    order: 8,
    group: "encroachment-tour",
  }
];

// Satellite Comparison Tour Steps
export const satelliteComparisonTourSteps = [
  {
    title: "Welcome to Satellite Comparison! 🛰️",
    content: "Compare satellite imagery across different time periods to analyze forest changes, detect deforestation, and monitor ecosystem health. Let's get started!",
    target: "[data-tour-id='satellite-header']",
    order: 1,
    group: "satellite-tour",
  },
  {
    title: "Location Selector 📍",
    content: "Choose a specific location or county in Texas to analyze. You can search by county name or click directly on the map to select an area of interest.",
    target: "[data-tour-id='location-selector']",
    order: 2,
    group: "satellite-tour",
  },
  {
    title: "Date Range Selection 📅",
    content: "Select two different dates to compare satellite imagery. This helps identify changes in forest cover, vegetation health, and land use patterns over time.",
    target: "[data-tour-id='date-selector']",
    order: 3,
    group: "satellite-tour",
  },
  {
    title: "Comparison Viewer 👁️",
    content: "View side-by-side satellite imagery comparison. The left panel shows the earlier date, and the right panel shows the more recent date for easy visual comparison.",
    target: "[data-tour-id='comparison-viewer']",
    order: 4,
    group: "satellite-tour",
  },
  {
    title: "NDVI Analysis 🌿",
    content: "Normalized Difference Vegetation Index (NDVI) analysis provides insights into vegetation health. Green indicates healthy vegetation, yellow shows stressed vegetation, and red indicates sparse or no vegetation.",
    target: "[data-tour-id='comparison-viewer']",
    order: 5,
    group: "satellite-tour",
  },
  {
    title: "Change Detection 📊",
    content: "The system automatically detects changes between the two time periods including deforestation, forest growth, and land use changes with detailed statistics.",
    target: "[data-tour-id='comparison-stats']",
    order: 6,
    group: "satellite-tour",
  },
  {
    title: "Statistics Panel 📈",
    content: "View detailed statistics including area changes, vegetation index differences, forest cover percentages, and trend analysis with visual charts.",
    target: "[data-tour-id='comparison-stats']",
    order: 7,
    group: "satellite-tour",
  },
  {
    title: "Multi-spectral Options 🌈",
    content: "Choose from different spectral band combinations (True Color, False Color, NDVI) to highlight different features and analyze vegetation patterns.",
    target: "[data-tour-id='comparison-viewer']",
    order: 8,
    group: "satellite-tour",
  },
  {
    title: "Start Analyzing! 🔍",
    content: "You're ready! Select a location and dates to start comparing satellite imagery and analyzing forest changes across Texas.",
    target: "[data-tour-id='satellite-header']",
    order: 9,
    group: "satellite-tour",
  }
];

// Fire Tracking Tour Steps
export const fireTrackingTourSteps = [
  {
    title: "Welcome to Fire Tracking! 🔥",
    content: "Monitor active fires, track historical fire data, and get real-time updates on wildfire activities across Texas. Let's explore this powerful tool!",
    target: "[data-tour-id='fire-tracking-header']",
    order: 1,
    group: "fire-tour",
  },
  {
    title: "Active Fires Map 🗺️",
    content: "View all active fires on the interactive map. Red markers indicate current fire locations with size representing fire intensity and affected area.",
    target: "[data-tour-id='fire-map']",
    order: 2,
    group: "fire-tour",
  },
  {
    title: "Fire Control Panel 🎛️",
    content: "Control what fire data you want to see. Toggle between active fires, fire perimeters, MODIS thermal data (last 48 hours / 7 days), and incident locations.",
    target: "[data-tour-id='fire-control-panel']",
    order: 3,
    group: "fire-tour",
  },
  {
    title: "MODIS Thermal Detection 🌡️",
    content: "MODIS satellite provides thermal hotspot detection. View fires detected in the last 48 hours or last 7 days for comprehensive monitoring.",
    target: "[data-tour-id='fire-control-panel']",
    order: 4,
    group: "fire-tour",
  },
  {
    title: "Fire Perimeters 🔴",
    content: "View fire perimeter boundaries to understand the extent and spread of fires. Toggle between current perimeters and year-to-date perimeter data.",
    target: "[data-tour-id='fire-map']",
    order: 5,
    group: "fire-tour",
  },
  {
    title: "Incident Information ℹ️",
    content: "Click on any fire marker to view detailed incident information including fire name, location, size, containment percentage, start date, and current status.",
    target: "[data-tour-id='fire-map']",
    order: 6,
    group: "fire-tour",
  },
  {
    title: "Historical Fire Data 📚",
    content: "Access comprehensive historical fire data including Texas's deadliest fires, most destructive fires, and statistical trends over decades.",
    target: "[data-tour-id='historical-fire-button']",
    order: 7,
    group: "fire-tour",
  },
  {
    title: "Real-time Updates ⚡",
    content: "The fire data is updated regularly from USGS, WFIGS, and MODIS sources ensuring you have the most current information for emergency response.",
    target: "[data-tour-id='fire-tracking-header']",
    order: 8,
    group: "fire-tour",
  },
  {
    title: "Start Tracking! 🚀",
    content: "You're ready to start tracking fires! Use the control panel to toggle different fire layers and click on markers for detailed information.",
    target: "[data-tour-id='fire-map']",
    order: 9,
    group: "fire-tour",
  }
];

// USGS Wildfire Prediction Tour Steps
export const usgsWildfireTourSteps = [
  {
    title: "Welcome to USGS Wildfire Forecast! 🔥",
    content: "Advanced wildfire prediction system powered by USGS data. Get risk assessments, predictions, and proactive alerts for forest fire management.",
    target: "[data-tour-id='usgs-wildfire-header']",
    order: 1,
    group: "usgs-wildfire-tour",
  },
  {
    title: "Risk Assessment Map 🗺️",
    content: "The map displays wildfire risk levels across Texas using color coding. Red indicates very high risk, orange for high risk, yellow for moderate, and green for low risk areas.",
    target: "[data-tour-id='usgs-wildfire-map']",
    order: 2,
    group: "usgs-wildfire-tour",
  },
  {
    title: "Prediction Controls 🎚️",
    content: "Adjust prediction parameters including forecast period (1-7 days), weather factors (temperature, humidity, wind), and historical fire data to refine risk assessment.",
    target: "[data-tour-id='usgs-wildfire-controls']",
    order: 3,
    group: "usgs-wildfire-tour",
  },
  {
    title: "Weather Integration ☁️",
    content: "The system integrates real-time weather data including temperature, humidity, wind speed, and precipitation forecasts to calculate fire risk.",
    target: "[data-tour-id='usgs-wildfire-controls']",
    order: 4,
    group: "usgs-wildfire-tour",
  },
  {
    title: "Risk Factors Analysis 📊",
    content: "View detailed risk factor analysis including fuel moisture, vegetation density, topography, historical fire patterns, and current weather conditions.",
    target: "[data-tour-id='usgs-wildfire-risk-panel']",
    order: 5,
    group: "usgs-wildfire-tour",
  },
  {
    title: "Alert System 🚨",
    content: "Set up custom alerts for specific counties or risk levels. Receive notifications when fire risk increases in your areas of interest.",
    target: "[data-tour-id='usgs-wildfire-alerts']",
    order: 6,
    group: "usgs-wildfire-tour",
  },
  {
    title: "County-level Details 🏘️",
    content: "Click on any county to view detailed risk assessment including overall risk score, contributing factors, historical fire incidents, and recommended actions.",
    target: "[data-tour-id='usgs-wildfire-map']",
    order: 7,
    group: "usgs-wildfire-tour",
  },
  {
    title: "Forecast Timeline ⏱️",
    content: "View fire risk predictions over time with timeline visualization. See how risk levels are expected to change over the next several days.",
    target: "[data-tour-id='usgs-wildfire-timeline']",
    order: 8,
    group: "usgs-wildfire-tour",
  },
  {
    title: "Start Predicting! 🎯",
    content: "You're ready! Adjust forecast parameters, explore the risk map, and set up alerts to stay ahead of potential wildfire threats.",
    target: "[data-tour-id='usgs-wildfire-header']",
    order: 9,
    group: "usgs-wildfire-tour",
  }
];

// Default tour guide options
export const defaultTourOptions = {
  autoScroll: true,
  autoScrollSmooth: true,
  autoScrollOffset: 80,
  backdropClass: "texas-vanrakshak-backdrop",
  backdropColor: "rgba(10, 20, 30, 0.35)",
  targetPadding: 20,
  backdropAnimate: true,
  dialogClass: "texas-vanrakshak-dialog",
  allowDialogOverlap: false,
  dialogZ: 10000,
  dialogWidth: 0,
  dialogMaxWidth: 420,
  dialogAnimate: true,
  closeButton: true,
  nextLabel: "Next →",
  prevLabel: "← Back",
  finishLabel: "Finish ✓",
  hidePrev: false,
  hideNext: false,
  completeOnFinish: true,
  showStepDots: true,
  stepDotsPlacement: "footer",
  showButtons: true,
  showStepProgress: true,
  progressBar: "#10B981", // Green progress bar
  keyboardControls: true,
  exitOnEscape: true,
  exitOnClickOutside: false,
  rememberStep: true,
  debug: false,
  activeStepInteraction: false,
};

