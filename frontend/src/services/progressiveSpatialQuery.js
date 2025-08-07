import * as turf from '@turf/turf';
import { geoJsonService } from './geoJsonService';
import { GEOJSON_LAYERS } from '../constants/geoJsonLayers';
import { LAYER_TYPES } from '../utils/spatialAnalysis';

/**
 * Progressive Spatial Query Service
 * Loads layers one by one and shows results as they come in
 */
class ProgressiveSpatialQueryService {
  constructor() {
    this.cache = new Map();
    this.currentQuery = null;
  }

  /**
   * Perform progressive spatial query - shows results as layers are processed
   */
  async performProgressiveQuery(clickPoint, onProgress, onNewResults) {
    const queryId = Date.now().toString();
    this.currentQuery = { id: queryId, cancelled: false };

    // Initialize results
    const results = {
      clickCoordinates: {
        lng: clickPoint[0],
        lat: clickPoint[1],
        formatted: `${clickPoint[1].toFixed(6)}, ${clickPoint[0].toFixed(6)}`
      },
      polygonData: [],
      nearestPoints: [],
      queryTimestamp: new Date().toISOString(),
      queryId: queryId,
      isComplete: false,
      processedLayers: 0,
      totalLayers: 0
    };

    try {
      // Filter layers by priority - fast ones first
      const prioritizedLayers = this.prioritizeLayers();
      results.totalLayers = prioritizedLayers.length;

      console.log(`🚀 Starting progressive query for ${prioritizedLayers.length} layers`);

      // Process layers one by one
      for (let i = 0; i < prioritizedLayers.length; i++) {
        if (this.currentQuery?.cancelled) {
          console.log('🛑 Query cancelled by user');
          break;
        }

        const layerConfig = prioritizedLayers[i];
        
        try {
          // Update progress
          onProgress({
            processed: i,
            total: prioritizedLayers.length,
            currentLayer: layerConfig.name,
            polygonCount: results.polygonData.length,
            pointCount: results.nearestPoints.length
          });

          // Process this layer
          const layerResults = await this.processLayer(layerConfig, clickPoint);
          
          if (layerResults.length > 0) {
            // Add results immediately
            layerResults.forEach(result => {
              if (result.queryType === 'polygon') {
                results.polygonData.push(result);
              } else if (result.queryType === 'point') {
                results.nearestPoints.push(result);
              }
            });

            // Sort nearest points by distance
            results.nearestPoints.sort((a, b) => a.distance - b.distance);
            results.nearestPoints = results.nearestPoints.slice(0, 20); // Keep top 20

            // Send updated results immediately
            results.processedLayers = i + 1;
            onNewResults({ ...results });
          }

          results.processedLayers = i + 1;

        } catch (error) {
          console.warn(`Error processing layer ${layerConfig.name}:`, error);
        }

        // Small delay to prevent UI blocking
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Mark as complete
      results.isComplete = true;
      onNewResults({ ...results });

      console.log(`✅ Progressive query complete: ${results.polygonData.length} polygons, ${results.nearestPoints.length} points`);
      
      return results;

    } catch (error) {
      console.error('Progressive query failed:', error);
      results.isComplete = true;
      return results;
    } finally {
      this.currentQuery = null;
    }
  }

  /**
   * Process a single layer for spatial matches
   */
  async processLayer(layerConfig, clickPoint) {
    try {
      // Load layer data
      let layerData;
      if (this.cache.has(layerConfig.id)) {
        layerData = this.cache.get(layerConfig.id);
      } else {
        const geoJsonData = await geoJsonService.loadGeoJson(layerConfig.file);
        layerData = {
          ...layerConfig,
          data: geoJsonData,
          featureCount: geoJsonData.features?.length || 0
        };
        this.cache.set(layerConfig.id, layerData);
      }

      if (!layerData?.data?.features) return [];

      const results = [];
      const features = layerData.data.features;
      const isPolygonLayer = LAYER_TYPES.POLYGON_LAYERS.includes(layerData.id);
      const isPointLayer = LAYER_TYPES.POINT_LAYERS.includes(layerData.id);

      if (!isPolygonLayer && !isPointLayer) return [];

      const targetPoint = turf.point(clickPoint);

      // Process features in smaller chunks for large layers
      const chunkSize = features.length > 1000 ? 200 : 500;
      
      for (let i = 0; i < features.length; i += chunkSize) {
        if (this.currentQuery?.cancelled) break;

        const chunk = features.slice(i, i + chunkSize);
        
        for (const feature of chunk) {
          if (this.currentQuery?.cancelled) break;

          try {
            if (isPolygonLayer && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
              const isInside = turf.booleanPointInPolygon(targetPoint, feature);
              if (isInside) {
                results.push({
                  ...feature,
                  layerId: layerData.id,
                  layerName: layerData.name,
                  queryType: 'polygon'
                });
              }
            } else if (isPointLayer && feature.geometry.type === 'Point') {
              const distance = turf.distance(targetPoint, feature, { units: 'kilometers' });
              if (distance <= 50) {
                results.push({
                  ...feature,
                  layerId: layerData.id,
                  layerName: layerData.name,
                  distance: distance,
                  distanceFormatted: `${distance.toFixed(2)} km`,
                  queryType: 'point'
                });
              }
            }
          } catch (error) {
            // Skip individual feature errors
          }
        }

        // Yield control after each chunk
        if (features.length > 1000) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      return results;

    } catch (error) {
      console.warn(`Failed to process layer ${layerConfig.name}:`, error);
      return [];
    }
  }

  /**
   * Prioritize layers - fast/important ones first
   */
  prioritizeLayers() {
    // Fast layers first
    const fastLayers = [
      'texas-boundary', 'counties', 'cities', 'county-seats', 'major-rivers',
      'state-parks-points', 'airports', 'military-lands', 'cemeteries'
    ];

    // Skip problematic layers entirely
    const skipLayers = [
      'race-population', 'census-block-groups', 'census-tracts', 
      'tracts-2010', 'tx-1degree'
    ];

    const allLayers = GEOJSON_LAYERS.filter(layer => !skipLayers.includes(layer.id));
    
    // Separate fast and remaining layers
    const prioritized = [];
    const remaining = [];

    allLayers.forEach(layer => {
      if (fastLayers.includes(layer.id)) {
        prioritized.push(layer);
      } else {
        remaining.push(layer);
      }
    });

    // Return fast layers first, then others
    return [...prioritized, ...remaining];
  }

  /**
   * Cancel current query
   */
  cancelQuery() {
    if (this.currentQuery) {
      this.currentQuery.cancelled = true;
      console.log('🛑 Cancelling progressive query');
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Progressive query cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      cachedLayers: this.cache.size,
      isQuerying: !!this.currentQuery,
      memoryEstimate: `${(JSON.stringify([...this.cache.values()]).length / (1024 * 1024)).toFixed(2)}MB`
    };
  }
}

// Export singleton instance
export const progressiveSpatialQueryService = new ProgressiveSpatialQueryService(); 