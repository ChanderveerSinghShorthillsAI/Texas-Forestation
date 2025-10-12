import React, { useState } from 'react';
import { GEOJSON_LAYERS, LAYER_CATEGORIES } from '../../constants/geoJsonLayers';
import './LayerSelector.css';

/**
 * Component for selecting and toggling map layers
 */
const LayerSelector = ({ 
  isLayerActive, 
  isLayerLoading, 
  toggleLayer, 
  getLayerError,
  clearAllLayers,
  getActiveLayerCount,
  getActiveLayersData,
  onToggle
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Handle toggle with parent notification
  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    if (onToggle) {
      onToggle(newState);
    }
  };
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  // Group layers by category
  const layersByCategory = GEOJSON_LAYERS.reduce((acc, layer) => {
    if (!acc[layer.category]) {
      acc[layer.category] = [];
    }
    acc[layer.category].push(layer);
    return acc;
  }, {});

  // Filter layers based on selected category and active status
  let filteredLayers = selectedCategory === 'all' 
    ? GEOJSON_LAYERS 
    : layersByCategory[selectedCategory] || [];

  // Further filter by active status if requested
  if (showActiveOnly) {
    filteredLayers = filteredLayers.filter(layer => isLayerActive(layer.id));
  }

  const handleLayerToggle = (layerId) => {
    toggleLayer(layerId);
  };

  const getCategoryDisplayName = (category) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleClearAll = () => {
    clearAllLayers();
  };

  const activeLayerCount = getActiveLayerCount();
  const activeLayersData = getActiveLayersData();

  const getLayerStatusIcon = (layerId) => {
    if (isLayerLoading(layerId)) {
      return <span className="layer-status loading">⟳</span>;
    }
    if (getLayerError(layerId)) {
      return <span className="layer-status error">⚠</span>;
    }
    if (isLayerActive(layerId)) {
      return <span className="layer-status active">✓</span>;
    }
    return <span className="layer-status inactive">○</span>;
  };

  return (
    <div className="layer-selector">
      <button 
        className={`layer-selector-toggle ${isOpen ? 'open' : ''}`}
        onClick={handleToggle}
        title="Toggle Layer Panel"
      >
        <span className="icon">🗂</span>
        <span className="text">Layers</span>
        <span className={`arrow ${isOpen ? 'up' : 'down'}`}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div className="layer-panel">
          <div className="layer-panel-header">
            <div className="header-top">
              <h3>Map Layers</h3>
              <div className="active-count">
                {activeLayerCount} active
              </div>
            </div>
            
            <div className="controls-row">
              <div className="category-filter">
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="category-select"
                >
                  <option value="all">All Categories</option>
                  {Object.keys(LAYER_CATEGORIES).map(categoryKey => (
                    <option key={categoryKey} value={LAYER_CATEGORIES[categoryKey]}>
                      {getCategoryDisplayName(LAYER_CATEGORIES[categoryKey])}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="filter-toggles">
                <label className="filter-toggle">
                  <input
                    type="checkbox"
                    checked={showActiveOnly}
                    onChange={(e) => setShowActiveOnly(e.target.checked)}
                  />
                  <span>Active only</span>
                </label>
              </div>
            </div>

            {activeLayerCount > 0 && (
              <div className="active-layers-section">
                <div className="active-layers-header">
                  <span className="section-label">Active Layers:</span>
                  <button 
                    onClick={handleClearAll}
                    className="clear-all-btn"
                    title="Clear all active layers"
                  >
                    Clear All
                  </button>
                </div>
                <div className="active-layers-list">
                  {activeLayersData.map(layer => (
                    <div key={layer.id} className="active-layer-chip">
                      <span className="layer-chip-name">{layer.name}</span>
                      <button 
                        onClick={() => handleLayerToggle(layer.id)}
                        className="layer-chip-remove"
                        title={`Remove ${layer.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="layer-list">
            {filteredLayers.map(layer => (
              <div 
                key={layer.id} 
                className={`layer-item ${isLayerActive(layer.id) ? 'active' : ''}`}
              >
                <div 
                  className="layer-toggle"
                  onClick={() => handleLayerToggle(layer.id)}
                >
                  {getLayerStatusIcon(layer.id)}
                  <div className="layer-info">
                    <div className="layer-name" style={{color: 'Black'}}>{layer.name}</div>
                    <div className="layer-description">{layer.description}</div>
                    {getLayerError(layer.id) && (
                      <div className="layer-error">
                        Error: {getLayerError(layer.id)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="layer-meta">
                  <span className={`layer-type ${layer.type}`}>
                    {layer.type}
                  </span>
                  <span className={`layer-category ${layer.category}`}>
                    {getCategoryDisplayName(layer.category)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {filteredLayers.length === 0 && (
            <div className="no-layers">
              No layers found for the selected category.
            </div>
          )}

          <div className="layer-panel-footer">
            <div className="legend">
              <div className="legend-item">
                <span className="layer-status active">✓</span> Active
              </div>
              <div className="legend-item">
                <span className="layer-status loading">⟳</span> Loading
              </div>
              <div className="legend-item">
                <span className="layer-status error">⚠</span> Error
              </div>
              <div className="legend-item">
                <span className="layer-status inactive">○</span> Inactive
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LayerSelector; 