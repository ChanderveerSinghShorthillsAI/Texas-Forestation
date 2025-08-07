# Texas GeoSpatial Explorer

An interactive web application for exploring Texas geographic data through multiple GeoJSON layers.

## Features

### 🗺️ Interactive Map
- **Texas-focused view**: Map automatically centers and zooms to Texas state boundaries
- **County boundaries**: Texas counties are highlighted and separated for easy identification
- **Responsive design**: Works seamlessly on desktop, tablet, and mobile devices

### 📊 Layer Management
- **Dynamic layer loading**: GeoJSON layers are loaded on-demand for optimal performance
- **Categorized layers**: Layers organized by categories (Boundaries, Infrastructure, Natural Features, Energy, Education, Administration)
- **Layer toggle**: Easy on/off switching for any layer via the layer panel
- **Loading indicators**: Visual feedback while layers are being loaded
- **Error handling**: Graceful error handling with user-friendly messages

### 🎨 Interactive Features
- **Hover effects**: Features highlight on mouse hover
- **Click popups**: Click any feature to see detailed property information
- **Custom styling**: Each layer type has distinctive colors and styling
- **Zoom controls**: Custom-styled zoom controls

### 📱 User Interface
- **Layer selector panel**: Collapsible panel with all available layers
- **Category filtering**: Filter layers by category type
- **Status indicators**: Visual indicators showing layer status (active, loading, error)
- **Layer legend**: Clear legend explaining status indicators

## Available Layers

### Boundaries
- **Texas State Boundary**: Complete state outline
- **Texas Counties**: All 254 Texas counties with boundaries

### Administrative
- **Major Cities**: Important cities across Texas
- **County Seats**: Official county seat locations
- **Military Lands**: Military installation boundaries

### Infrastructure
- **Airports**: Airport locations across Texas
- **Major Rivers**: Primary river systems
- **River Basins**: Watershed boundaries

### Natural Features
- **State Parks**: State park locations and boundaries
- **Major Aquifers**: Groundwater aquifer systems

### Energy
- **Wind Turbines**: Wind turbine installation sites
- **Oil & Gas Basins**: Oil and natural gas production areas

### Education
- **Education Regions**: Educational service regions

## Technical Architecture

### Component Structure
```
src/
├── components/
│   ├── Map/
│   │   ├── TexasMap.jsx          # Main map component
│   │   ├── GeoJsonLayer.jsx      # Individual layer renderer
│   │   └── TexasMap.css          # Map styling
│   └── UI/
│       ├── LayerSelector.jsx     # Layer control panel
│       └── LayerSelector.css     # Panel styling
├── hooks/
│   └── useMapLayers.js           # Layer management hook
├── services/
│   └── geoJsonService.js         # Data loading service
├── constants/
│   └── geoJsonLayers.js          # Layer definitions
├── utils/
│   └── mapUtils.js               # Utility functions
└── App.js                        # Main application
```

### Key Technologies
- **React 19.1.1**: Modern React with hooks
- **Leaflet**: Open-source mapping library
- **React-Leaflet 5.0.0**: React bindings for Leaflet
- **Custom CSS**: Modern styling with CSS Grid and Flexbox

### Performance Optimizations
- **Lazy loading**: GeoJSON files loaded only when needed
- **Caching**: Loaded data is cached to prevent re-downloads
- **Debounced interactions**: Optimized user interactions
- **Efficient re-renders**: Careful state management to minimize re-renders

## Usage

### Basic Navigation
1. **View Texas**: The map opens with Texas state and county boundaries visible
2. **Zoom and Pan**: Use mouse wheel to zoom, click and drag to pan
3. **Layer Panel**: Click the "Layers" button in the top-right corner

### Layer Management
1. **Open Layer Panel**: Click the "Layers" button
2. **Filter Categories**: Use the dropdown to filter by category
3. **Toggle Layers**: Click any layer to turn it on/off
4. **View Status**: Check the icon to see if a layer is active, loading, or has errors

### Exploring Features
1. **Hover**: Move mouse over features to see highlight effects
2. **Click**: Click any feature to see detailed information in a popup
3. **Navigate**: Use zoom controls or mouse wheel to explore different areas

## Data Sources

The application uses various Texas state government GeoJSON datasets including:
- Texas State Boundary and County data
- Infrastructure and transportation data
- Natural features and environmental data
- Energy and resource data
- Educational and administrative boundaries

## Development

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation
```bash
cd frontend
npm install
```

### Development Server
```bash
npm start
```

### Building for Production
```bash
npm run build
```

## File Size Considerations

The application is designed to handle various file sizes efficiently:
- **Small files** (< 1MB): Cities, airports, military lands
- **Medium files** (1-10MB): Counties, rivers, education regions  
- **Large files** (10MB+): Some datasets are selectively included based on visualization value

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow the established component structure
2. Add new layers to `constants/geoJsonLayers.js`
3. Ensure responsive design principles
4. Test on multiple screen sizes
5. Add appropriate error handling

## License

This project is built for educational and demonstration purposes using publicly available Texas state geographic data.
