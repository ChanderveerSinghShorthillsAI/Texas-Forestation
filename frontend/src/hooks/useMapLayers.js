import { useState, useEffect, useCallback } from 'react';
import { geoJsonService } from '../services/geoJsonService';
import { getDefaultLayers, getLayerById } from '../constants/geoJsonLayers';

/**
 * Custom hook for managing map layers
 */
export const useMapLayers = () => {
  const [layers, setLayers] = useState(new Map());
  const [activeLayers, setActiveLayers] = useState(new Set());
  const [loadingLayers, setLoadingLayers] = useState(new Set());
  const [errors, setErrors] = useState(new Map());

  // Delay default layer loading to prevent overwhelming the browser during initial load
  useEffect(() => {
    const loadDefaultLayersDelayed = async () => {
      // Wait for map to be initialized before loading default layers
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const defaultLayers = getDefaultLayers();
      console.log('🗂️ Loading default map layers...');
      
      // Update loading progress
      if (window.updateLoadingTask) {
        window.updateLoadingTask('layers', { status: 'in-progress', progress: 0 });
      }
      
      // Load layers with small delays between each to prevent browser freeze
      for (let i = 0; i < defaultLayers.length; i++) {
        const layerConfig = defaultLayers[i];
        
        try {
          await loadLayer(layerConfig.id);
          
          // Update progress
          if (window.updateLoadingTask) {
            const progress = ((i + 1) / defaultLayers.length) * 100;
            window.updateLoadingTask('layers', { status: 'in-progress', progress });
          }
          
          // Small delay between layers to prevent browser lockup
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.warn(`Failed to load layer ${layerConfig.id}:`, error);
        }
      }
      
      if (window.updateLoadingTask) {
        window.updateLoadingTask('layers', { status: 'completed', progress: 100 });
      }
      
      console.log('✅ Default layers loaded');
    };

    loadDefaultLayersDelayed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Load a layer by ID with detailed timing measurements
   */
  const loadLayer = useCallback(async (layerId) => {
    const layerConfig = getLayerById(layerId);
    if (!layerConfig) {
      console.error(`Layer not found: ${layerId}`);
      return;
    }

    // Start overall timing
    const overallStartTime = performance.now();
    console.log(`🔄 Loading layer: ${layerConfig.name} (${layerConfig.file})`);

    setLoadingLayers(prev => new Set(prev).add(layerId));
    setErrors(prev => {
      const newErrors = new Map(prev);
      newErrors.delete(layerId);
      return newErrors;
    });

    try {
      // Measure network fetch time
      const fetchStartTime = performance.now();
      const geoJsonData = await geoJsonService.loadGeoJson(layerConfig.file, layerConfig.basePath);
      const fetchEndTime = performance.now();
      const fetchTime = fetchEndTime - fetchStartTime;
      
      // Measure data processing time
      const processStartTime = performance.now();
      const featureCount = geoJsonData.features ? geoJsonData.features.length : 0;
      const fileSizeEstimate = JSON.stringify(geoJsonData).length;
      const processEndTime = performance.now();
      const processTime = processEndTime - processStartTime;
      
      // Measure React state update time
      const stateUpdateStartTime = performance.now();
      setLayers(prev => new Map(prev).set(layerId, {
        ...layerConfig,
        data: geoJsonData,
        zIndex: layerConfig.isDefault ? 1 : 10,
        loadTime: fetchEndTime - overallStartTime, // Total time including state updates
        fetchTime: fetchTime,
        processTime: processTime,
        featureCount: featureCount,
        fileSizeEstimate: fileSizeEstimate
      }));
      const stateUpdateEndTime = performance.now();
      const stateUpdateTime = stateUpdateEndTime - stateUpdateStartTime;
      
      // Calculate total time
      const totalTime = stateUpdateEndTime - overallStartTime;
      
      // Auto-activate default layers
      if (layerConfig.isDefault) {
        setActiveLayers(prev => new Set(prev).add(layerId));
      }
      
      // Detailed performance logging
      console.log(`✅ Layer loaded: ${layerConfig.name}`);
      console.log(`   🌐 Network fetch: ${fetchTime.toFixed(2)}ms (${(fetchTime/1000).toFixed(2)}s)`);
      console.log(`   ⚙️  Data processing: ${processTime.toFixed(2)}ms (${(processTime/1000).toFixed(2)}s)`);
      console.log(`   🔄 State update: ${stateUpdateTime.toFixed(2)}ms (${(stateUpdateTime/1000).toFixed(2)}s)`);
      console.log(`   📊 Total load time: ${totalTime.toFixed(2)}ms (${(totalTime/1000).toFixed(2)}s)`);
      console.log(`   📄 Features: ${featureCount.toLocaleString()}`);
      console.log(`   💾 Size: ~${(fileSizeEstimate / (1024 * 1024)).toFixed(2)}MB`);
      console.log(`   📈 Performance breakdown:`);
      console.log(`      Network: ${((fetchTime/totalTime)*100).toFixed(1)}%`);
      console.log(`      Processing: ${((processTime/totalTime)*100).toFixed(1)}%`);
      console.log(`      State Update: ${((stateUpdateTime/totalTime)*100).toFixed(1)}%`);
      
      // Performance warnings with specific bottleneck identification
      if (totalTime > 5000) {
        console.warn(`⚠️  SLOW LAYER: ${layerConfig.name} took ${(totalTime/1000).toFixed(2)}s to load!`);
        if (fetchTime > totalTime * 0.7) {
          console.warn(`   🌐 Network bottleneck: ${(fetchTime/1000).toFixed(2)}s (${((fetchTime/totalTime)*100).toFixed(1)}%)`);
        }
        if (processTime > totalTime * 0.3) {
          console.warn(`   ⚙️  Processing bottleneck: ${(processTime/1000).toFixed(2)}s (${((processTime/totalTime)*100).toFixed(1)}%)`);
        }
      } else if (totalTime > 2000) {
        console.warn(`⚡ Moderate load time: ${layerConfig.name} took ${(totalTime/1000).toFixed(2)}s`);
      }

    } catch (error) {
      const endTime = performance.now();
      const failTime = endTime - overallStartTime;
      
      console.error(`❌ Failed to load layer: ${layerConfig.name} after ${failTime.toFixed(2)}ms`);
      console.error(`   Error: ${error.message}`);
      
      setErrors(prev => new Map(prev).set(layerId, error.message));
    } finally {
      setLoadingLayers(prev => {
        const newLoading = new Set(prev);
        newLoading.delete(layerId);
        return newLoading;
      });
    }
  }, []);

  /**
   * Toggle layer visibility with single-layer selection
   */
  const toggleLayer = useCallback((layerId) => {
    setActiveLayers(prev => {
      const newActive = new Set(prev);
      
      if (newActive.has(layerId)) {
        // If clicking on active layer, deactivate it
        newActive.delete(layerId);
      } else {
        // Deactivate all other layers first (single-layer selection)
        newActive.clear();
        // Then activate the new layer
        newActive.add(layerId);
        
        // Load layer if not already loaded
        if (!layers.has(layerId)) {
          loadLayer(layerId);
        }
      }
      
      return newActive;
    });
  }, [layers, loadLayer]);

  /**
   * Get active layer data sorted by z-index for proper rendering order
   */
  const getActiveLayersData = useCallback(() => {
    return Array.from(activeLayers)
      .map(layerId => layers.get(layerId))
      .filter(Boolean)
      .sort((a, b) => (a.zIndex || 5) - (b.zIndex || 5)); // Sort by z-index
  }, [activeLayers, layers]);

  /**
   * Check if layer is loading
   */
  const isLayerLoading = useCallback((layerId) => {
    return loadingLayers.has(layerId);
  }, [loadingLayers]);

  /**
   * Check if layer is active
   */
  const isLayerActive = useCallback((layerId) => {
    return activeLayers.has(layerId);
  }, [activeLayers]);

  /**
   * Get layer error
   */
  const getLayerError = useCallback((layerId) => {
    return errors.get(layerId);
  }, [errors]);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors(new Map());
  }, []);

  /**
   * Clear all active layers
   */
  const clearAllLayers = useCallback(() => {
    setActiveLayers(new Set());
  }, []);

  /**
   * Get active layer count
   */
  const getActiveLayerCount = useCallback(() => {
    return activeLayers.size;
  }, [activeLayers]);

  /**
   * Get performance statistics for loaded layers
   */
  const getPerformanceStats = useCallback(() => {
    const stats = Array.from(layers.values())
      .filter(layer => layer.loadTime !== undefined)
      .map(layer => ({
        name: layer.name,
        file: layer.file,
        loadTime: layer.loadTime,
        loadTimeSeconds: (layer.loadTime / 1000).toFixed(2),
        featureCount: layer.featureCount || 0,
        fileSizeMB: layer.fileSizeEstimate ? (layer.fileSizeEstimate / (1024 * 1024)).toFixed(2) : 'unknown'
      }))
      .sort((a, b) => b.loadTime - a.loadTime); // Sort by load time (slowest first)

    return stats;
  }, [layers]);

  /**
   * Log performance summary to console
   */
  const logPerformanceSummary = useCallback(() => {
    const stats = getPerformanceStats();
    
    if (stats.length === 0) {
      console.log('📊 No layer performance data available yet');
      return;
    }

    console.log('\n📊 LAYER PERFORMANCE SUMMARY');
    console.log('═'.repeat(80));
    console.log('Rank | Layer Name                    | Load Time | Features    | Size (MB)');
    console.log('-'.repeat(80));
    
    stats.forEach((stat, index) => {
      const rank = (index + 1).toString().padStart(4);
      const name = stat.name.padEnd(30).substring(0, 30);
      const loadTime = `${stat.loadTimeSeconds}s`.padStart(9);
      const features = stat.featureCount.toLocaleString().padStart(11);
      const size = `${stat.fileSizeMB}MB`.padStart(9);
      
      console.log(`${rank} | ${name} | ${loadTime} | ${features} | ${size}`);
    });
    
    console.log('-'.repeat(80));
    console.log(`Total layers analyzed: ${stats.length}`);
    console.log(`Slowest layer: ${stats[0]?.name} (${stats[0]?.loadTimeSeconds}s)`);
    console.log(`Fastest layer: ${stats[stats.length - 1]?.name} (${stats[stats.length - 1]?.loadTimeSeconds}s)`);
    
    // Identify problematic layers
    const slowLayers = stats.filter(s => s.loadTime > 5000);
    const moderateLayers = stats.filter(s => s.loadTime > 2000 && s.loadTime <= 5000);
    
    if (slowLayers.length > 0) {
      console.log(`\n⚠️  SLOW LAYERS (>5s): ${slowLayers.map(l => l.name).join(', ')}`);
    }
    if (moderateLayers.length > 0) {
      console.log(`⚡ MODERATE LAYERS (2-5s): ${moderateLayers.map(l => l.name).join(', ')}`);
    }
    
    console.log('═'.repeat(80));
  }, [getPerformanceStats]);

  return {
    layers,
    activeLayers,
    loadingLayers,
    errors,
    loadLayer,
    toggleLayer,
    getActiveLayersData,
    getAllLayersData: () => layers,
    getActiveLayerIds: () => activeLayers,
    isLayerLoading,
    isLayerActive,
    getLayerError,
    clearErrors,
    clearAllLayers,
    getActiveLayerCount,
    getPerformanceStats,
    logPerformanceSummary
  };
}; 