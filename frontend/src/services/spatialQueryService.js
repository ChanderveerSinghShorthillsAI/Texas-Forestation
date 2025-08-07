import * as turf from '@turf/turf';
import { geoJsonService } from './geoJsonService';
import { GEOJSON_LAYERS } from '../constants/geoJsonLayers';
import { LAYER_TYPES } from '../utils/spatialAnalysis';

/**
 * Optimized Spatial Query Service
 * Handles large GeoJSON datasets efficiently to prevent crashes
 */
class SpatialQueryService {
  constructor() {
    this.cache = new Map();
    this.loadingPromises = new Map();
    this.abortControllers = new Map();
    
    // Performance thresholds (restored since we skip problematic layers)
    this.MAX_FEATURES_PER_CHUNK = 1000; // Normal performance
    this.MAX_CONCURRENT_LAYERS = 3; // Normal concurrency
    this.QUERY_TIMEOUT = 30000; // 30 seconds should be fine now
    this.LARGE_LAYER_THRESHOLD = 5000; // Normal threshold
    this.VERY_LARGE_LAYER_THRESHOLD = 10000; // Keep for remaining large layers
    this.MAX_LAYER_PROCESSING_TIME = 10000; // 10 seconds per layer should be enough
  }

  /**
   * Get layer size estimate without loading full data
   */
  async getLayerSizeEstimate(layerId) {
    const layerConfig = GEOJSON_LAYERS.find(layer => layer.id === layerId);
    if (!layerConfig) return 0;

    // Check if we have cached size info
    const cacheKey = `size_${layerId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Try to get just the header/metadata if possible
      const response = await fetch(`/Texas_Geojsons/${layerConfig.file}`, {
        method: 'HEAD'
      });
      
      const contentLength = response.headers.get('content-length');
      const estimatedSize = contentLength ? parseInt(contentLength) : 0;
      
      this.cache.set(cacheKey, estimatedSize);
      return estimatedSize;
    } catch (error) {
      console.warn(`Could not get size estimate for ${layerId}:`, error);
      return 0;
    }
  }

  /**
   * Load layer with chunking for large datasets
   */
  async loadLayerOptimized(layerId, signal) {
    const layerConfig = GEOJSON_LAYERS.find(layer => layer.id === layerId);
    if (!layerConfig) return null;

    // Layers to skip entirely due to performance issues
    const skipLayers = [
      'race-population', 
      'census-block-groups', 
      'census-tracts',
      'tracts-2010',
      'tx-1degree'
    ];

    // Skip problematic layers entirely
    if (skipLayers.includes(layerId)) {
      console.log(`⏭️ Skipping ${layerConfig.name} (known to cause timeouts)`);
      return null;
    }

    // This code is now redundant since we skip problematic layers above
    const isProblematic = false;

    // Check cache first
    if (this.cache.has(layerId)) {
      return this.cache.get(layerId);
    }

    try {
      console.log(`📥 Loading ${layerConfig.name}${isProblematic ? ' (large dataset)' : ''}...`);
      const loadStart = performance.now();
      
      const geoJsonData = await geoJsonService.loadGeoJson(layerConfig.file);
      
      const loadTime = performance.now() - loadStart;
      console.log(`📥 Loaded ${layerConfig.name} in ${(loadTime/1000).toFixed(2)}s`);
      
      if (signal?.aborted) {
        throw new Error('Query aborted');
      }

      const featureCount = geoJsonData.features?.length || 0;

      // Add metadata
      const enrichedData = {
        ...layerConfig,
        data: geoJsonData,
        featureCount: featureCount,
        isLarge: featureCount > this.LARGE_LAYER_THRESHOLD,
        isVeryLarge: featureCount > this.VERY_LARGE_LAYER_THRESHOLD,
        isProblematic: isProblematic,
        loadTime: loadTime
      };

      // Cache the result
      this.cache.set(layerId, enrichedData);
      
      return enrichedData;
    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'Query aborted') {
        console.log(`Layer loading aborted: ${layerId}`);
        return null;
      }
      console.error(`Error loading layer ${layerId}:`, error);
      return null;
    }
  }

  /**
   * Process spatial query in chunks to prevent blocking
   */
  async processLayerChunked(layerData, clickPoint, signal) {
    if (!layerData?.data?.features) return [];

    const results = [];
    const features = layerData.data.features;
    const isPolygonLayer = LAYER_TYPES.POLYGON_LAYERS.includes(layerData.id);
    const isPointLayer = LAYER_TYPES.POINT_LAYERS.includes(layerData.id);

    // Skip if not a supported layer type
    if (!isPolygonLayer && !isPointLayer) return [];

    const targetPoint = turf.point(clickPoint);
    const featureCount = features.length;
    const isVeryLarge = featureCount > this.VERY_LARGE_LAYER_THRESHOLD;
    
    // Dynamic chunk sizing based on layer size
    let chunkSize;
    if (isVeryLarge) {
      chunkSize = 50; // Very small chunks for extremely large layers
    } else if (layerData.isLarge) {
      chunkSize = 100; // Small chunks for large layers
    } else {
      chunkSize = this.MAX_FEATURES_PER_CHUNK; // Normal chunks
    }

    console.log(`🔧 Processing ${layerData.name}: ${featureCount} features, chunk size: ${chunkSize}`);
    
    // Start timer for this layer
    const layerStartTime = performance.now();
    
    for (let i = 0; i < features.length; i += chunkSize) {
      if (signal?.aborted) {
        throw new Error('Query aborted');
      }

      // Check layer processing timeout
      const layerElapsedTime = performance.now() - layerStartTime;
      if (layerElapsedTime > this.MAX_LAYER_PROCESSING_TIME) {
        console.warn(`⏰ Layer ${layerData.name} timed out after ${(layerElapsedTime/1000).toFixed(2)}s, stopping processing`);
        break;
      }

      const chunk = features.slice(i, i + chunkSize);
      
      // Process chunk
      for (const feature of chunk) {
        if (signal?.aborted) {
          throw new Error('Query aborted');
        }

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
            if (distance <= 50) { // 50km radius
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
          console.warn(`Error processing feature in ${layerData.id}:`, error);
        }
      }

      // More frequent yielding for very large layers
      const yieldFrequency = isVeryLarge ? 50 : (layerData.isLarge ? 100 : 500);
      if (i % yieldFrequency === 0) {
        await new Promise(resolve => setTimeout(resolve, isVeryLarge ? 1 : 0));
      }
    }

    const layerEndTime = performance.now();
    const layerDuration = layerEndTime - layerStartTime;
    console.log(`✅ Completed ${layerData.name}: ${results.length} matches in ${(layerDuration/1000).toFixed(2)}s`);

    return results;
  }

  /**
   * Perform spatial query on all layers with optimization
   */
  async performOptimizedSpatialQuery(clickPoint, onProgress = null) {
    const queryId = Date.now().toString();
    const abortController = new AbortController();
    this.abortControllers.set(queryId, abortController);

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
      performance: {
        startTime: performance.now(),
        layersProcessed: 0,
        totalLayers: GEOJSON_LAYERS.length - 5, // Subtract the 5 skipped layers
        errors: [],
        skippedLayers: ['race-population', 'census-block-groups', 'census-tracts', 'tracts-2010', 'tx-1degree']
      }
    };

    try {
      // Filter out problematic layers entirely and sort by size
      const skipLayers = ['race-population', 'census-block-groups', 'census-tracts', 'tracts-2010', 'tx-1degree'];
      const layersToProcess = GEOJSON_LAYERS.filter(layer => !skipLayers.includes(layer.id));
      
      const layersWithSize = await Promise.all(
        layersToProcess.map(async (layer) => ({
          ...layer,
          estimatedSize: await this.getLayerSizeEstimate(layer.id)
        }))
      );
      
      // Sort by size (smallest first)
      layersWithSize.sort((a, b) => a.estimatedSize - b.estimatedSize);
      
      console.log(`🔄 Processing ${layersWithSize.length} layers (skipping ${skipLayers.length} problematic layers)`);

      // Process layers in batches to limit memory usage  
      const batchSize = this.MAX_CONCURRENT_LAYERS;
      
      for (let i = 0; i < layersWithSize.length; i += batchSize) {
        if (abortController.signal.aborted) break;

        const batch = layersWithSize.slice(i, i + batchSize);
        
        // Load batch layers
        const layerPromises = batch.map(layer => 
          this.loadLayerOptimized(layer.id, abortController.signal)
        );

        const batchLayers = await Promise.allSettled(layerPromises);
        
        // Process each loaded layer
        for (let j = 0; j < batchLayers.length; j++) {
          if (abortController.signal.aborted) break;

          const layerResult = batchLayers[j];
          
          if (layerResult.status === 'fulfilled' && layerResult.value) {
            try {
              const layerData = layerResult.value;
              const layerResults = await this.processLayerChunked(
                layerData, 
                clickPoint, 
                abortController.signal
              );

              // Add results
              layerResults.forEach(result => {
                if (result.queryType === 'polygon') {
                  results.polygonData.push(result);
                } else if (result.queryType === 'point') {
                  results.nearestPoints.push(result);
                }
              });

              results.performance.layersProcessed++;
              
              // Report progress
              if (onProgress) {
                onProgress({
                  processed: results.performance.layersProcessed,
                  total: results.performance.totalLayers,
                  currentLayer: layerData.name,
                  polygonCount: results.polygonData.length,
                  pointCount: results.nearestPoints.length
                });
              }

            } catch (error) {
              if (error.message !== 'Query aborted') {
                results.performance.errors.push({
                  layer: batch[j].id,
                  error: error.message
                });
              }
            }
          } else if (layerResult.status === 'rejected') {
            results.performance.errors.push({
              layer: batch[j].id,
              error: layerResult.reason?.message || 'Failed to load'
            });
          }
        }

        // Small delay between batches
        if (i + batchSize < layersWithSize.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Sort nearest points by distance
      results.nearestPoints.sort((a, b) => a.distance - b.distance);
      results.nearestPoints = results.nearestPoints.slice(0, 10); // Keep top 10

      results.performance.endTime = performance.now();
      results.performance.totalTime = results.performance.endTime - results.performance.startTime;

      console.log('🎯 Spatial query completed:', {
        duration: `${(results.performance.totalTime / 1000).toFixed(2)}s`,
        layersProcessed: results.performance.layersProcessed,
        polygonMatches: results.polygonData.length,
        nearestPoints: results.nearestPoints.length,
        errors: results.performance.errors.length
      });

      return results;

    } catch (error) {
      if (error.message !== 'Query aborted') {
        console.error('Spatial query failed:', error);
        results.performance.errors.push({
          layer: 'general',
          error: error.message
        });
      }
      return results;
    } finally {
      this.abortControllers.delete(queryId);
    }
  }

  /**
   * Abort an ongoing query
   */
  abortQuery(queryId) {
    const controller = this.abortControllers.get(queryId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(queryId);
    }
  }

  /**
   * Clear cache to free up memory
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Spatial query cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cachedLayers: this.cache.size,
      activequeries: this.abortControllers.size,
      memoryEstimate: `${(JSON.stringify([...this.cache.values()]).length / (1024 * 1024)).toFixed(2)}MB`
    };
  }
}

// Export singleton instance
export const spatialQueryService = new SpatialQueryService(); 