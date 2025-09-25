/**
 * Loading Optimization Utilities
 * Provides utilities to optimize loading performance based on device capabilities
 */

/**
 * Detect if the user is on a mobile device or slow connection
 */
export const detectSlowDevice = () => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const userAgent = navigator.userAgent;
  
  // Check for mobile devices
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  // Check for slow network
  const isSlowNetwork = connection && (
    connection.effectiveType === 'slow-2g' || 
    connection.effectiveType === '2g' || 
    connection.effectiveType === '3g'
  );
  
  // Check for low-end device indicators
  const isLowEndDevice = navigator.hardwareConcurrency < 4 || 
                        (navigator.deviceMemory && navigator.deviceMemory < 4);
  
  return {
    isMobile,
    isSlowNetwork,
    isLowEndDevice,
    shouldOptimize: isMobile || isSlowNetwork || isLowEndDevice
  };
};

/**
 * Create optimized loading configuration based on device capabilities
 */
export const createOptimizedConfig = () => {
  const deviceInfo = detectSlowDevice();
  
  if (deviceInfo.shouldOptimize) {
    return {
      // Reduced concurrent operations for slow devices
      maxConcurrentLoads: 1,
      
      // Longer delays between operations
      operationDelay: 200,
      
      // Load only essential data initially
      loadEssentialOnly: true,
      
      // Use smaller chunks for large data
      useChunking: true,
      
      // Enable aggressive caching
      aggressiveCaching: true,
      
      // Skip non-essential features initially
      skipNonEssential: ['yolo', 'advanced_stats'],
      
      // Show progress more frequently
      progressUpdateFrequency: 100
    };
  }
  
  // Fast device configuration
  return {
    maxConcurrentLoads: 3,
    operationDelay: 100,
    loadEssentialOnly: false,
    useChunking: false,
    aggressiveCaching: true,
    skipNonEssential: [],
    progressUpdateFrequency: 500
  };
};

/**
 * Optimize data loading based on priority
 */
export const prioritizeDataLoading = (dataTypes) => {
  // Essential data that must load first
  const essential = ['boundaries', 'auth'];
  
  // Important data that should load second
  const important = ['grid', 'counties'];
  
  // Optional data that can load last
  const optional = ['yolo', 'layers', 'statistics'];
  
  const prioritized = [];
  
  // Add in priority order
  essential.forEach(type => {
    if (dataTypes.includes(type)) {
      prioritized.push({ type, priority: 'essential' });
    }
  });
  
  important.forEach(type => {
    if (dataTypes.includes(type)) {
      prioritized.push({ type, priority: 'important' });
    }
  });
  
  optional.forEach(type => {
    if (dataTypes.includes(type)) {
      prioritized.push({ type, priority: 'optional' });
    }
  });
  
  return prioritized;
};

/**
 * Progressive data loader with error recovery
 */
export class ProgressiveLoader {
  constructor(config = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      ...config
    };
    this.loadedItems = new Set();
    this.failedItems = new Set();
  }

  async loadWithProgress(items, progressCallback) {
    const results = [];
    const total = items.length;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      try {
        // Update progress
        if (progressCallback) {
          progressCallback({
            current: i,
            total,
            item: item.name || item.id || 'Unknown',
            percentage: (i / total) * 100
          });
        }
        
        // Load item with retry logic
        const result = await this.loadWithRetry(item);
        results.push(result);
        this.loadedItems.add(item.id || item.name);
        
      } catch (error) {
        console.warn(`Failed to load ${item.name || item.id}:`, error);
        this.failedItems.add(item.id || item.name);
        results.push(null); // Placeholder for failed items
      }
      
      // Small delay to prevent browser freeze
      await new Promise(resolve => setTimeout(resolve, this.config.operationDelay || 50));
    }
    
    // Final progress update
    if (progressCallback) {
      progressCallback({
        current: total,
        total,
        item: 'Complete',
        percentage: 100
      });
    }
    
    return results;
  }

  async loadWithRetry(item, attempt = 1) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), this.config.timeout);
      });
      
      // Race between actual loading and timeout
      const loadPromise = typeof item.load === 'function' ? 
        item.load() : 
        this.defaultLoader(item);
        
      return await Promise.race([loadPromise, timeoutPromise]);
      
    } catch (error) {
      if (attempt < this.config.maxRetries) {
        console.log(`Retry ${attempt} for ${item.name || item.id}`);
        await new Promise(resolve => 
          setTimeout(resolve, this.config.retryDelay * attempt)
        );
        return this.loadWithRetry(item, attempt + 1);
      }
      throw error;
    }
  }

  async defaultLoader(item) {
    if (item.url) {
      const response = await fetch(item.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    }
    throw new Error('No loader defined for item');
  }

  getStats() {
    return {
      loaded: this.loadedItems.size,
      failed: this.failedItems.size,
      loadedItems: Array.from(this.loadedItems),
      failedItems: Array.from(this.failedItems)
    };
  }
}

/**
 * Memory usage monitor
 */
export const monitorMemoryUsage = () => {
  if (performance.memory) {
    const used = performance.memory.usedJSHeapSize;
    const total = performance.memory.totalJSHeapSize;
    const limit = performance.memory.jsHeapSizeLimit;
    
    const usagePercent = (used / limit) * 100;
    
    if (usagePercent > 70) {
      console.warn('🚨 High memory usage detected:', {
        used: `${(used / 1024 / 1024).toFixed(2)} MB`,
        total: `${(total / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(limit / 1024 / 1024).toFixed(2)} MB`,
        percentage: `${usagePercent.toFixed(1)}%`
      });
      
      return { status: 'high', percentage: usagePercent };
    }
    
    return { status: 'normal', percentage: usagePercent };
  }
  
  return { status: 'unknown', percentage: 0 };
};

/**
 * Cleanup unused resources
 */
export const cleanupResources = () => {
  // Clear any global caches if they exist
  if (window.mapCache) {
    window.mapCache.clear();
  }
  
  // Request garbage collection if available (Chrome DevTools)
  if (window.gc && typeof window.gc === 'function') {
    window.gc();
  }
  
  console.log('🧹 Resources cleaned up');
};
