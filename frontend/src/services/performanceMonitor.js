/**
 * Performance Monitor Service
 * Tracks and optimizes application performance during loading
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.loadingStart = Date.now();
    this.thresholds = {
      slow: 3000,    // 3 seconds
      timeout: 10000  // 10 seconds
    };
  }

  /**
   * Start tracking a performance metric
   */
  startTracking(key, description) {
    this.metrics.set(key, {
      description,
      startTime: performance.now(),
      endTime: null,
      duration: null
    });
    
    console.log(`⏱️ Started tracking: ${description}`);
  }

  /**
   * Stop tracking a performance metric
   */
  stopTracking(key) {
    const metric = this.metrics.get(key);
    if (metric) {
      metric.endTime = performance.now();
      metric.duration = metric.endTime - metric.startTime;
      
      const status = metric.duration > this.thresholds.slow ? '🐌' : '⚡';
      console.log(`${status} Completed: ${metric.description} (${metric.duration.toFixed(2)}ms)`);
      
      return metric.duration;
    }
    return 0;
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const summary = {
      totalLoadTime: Date.now() - this.loadingStart,
      slowOperations: [],
      fastOperations: [],
      totalOperations: this.metrics.size
    };

    this.metrics.forEach((metric, key) => {
      if (metric.duration !== null) {
        const operation = {
          key,
          description: metric.description,
          duration: metric.duration
        };

        if (metric.duration > this.thresholds.slow) {
          summary.slowOperations.push(operation);
        } else {
          summary.fastOperations.push(operation);
        }
      }
    });

    return summary;
  }

  /**
   * Log performance summary to console
   */
  logSummary() {
    const summary = this.getSummary();
    
    console.group('📊 Performance Summary');
    console.log(`Total Load Time: ${summary.totalLoadTime}ms`);
    console.log(`Operations Tracked: ${summary.totalOperations}`);
    
    if (summary.slowOperations.length > 0) {
      console.group('🐌 Slow Operations');
      summary.slowOperations.forEach(op => {
        console.log(`${op.description}: ${op.duration.toFixed(2)}ms`);
      });
      console.groupEnd();
    }
    
    if (summary.fastOperations.length > 0) {
      console.group('⚡ Fast Operations');
      summary.fastOperations.forEach(op => {
        console.log(`${op.description}: ${op.duration.toFixed(2)}ms`);
      });
      console.groupEnd();
    }
    
    console.groupEnd();
  }

  /**
   * Detect if device might be slow/mobile
   */
  detectSlowDevice() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const hardwareConcurrency = navigator.hardwareConcurrency || 2;
    
    // Consider device slow if:
    // - Less than 4 CPU cores
    // - Slow network connection
    // - Low device memory (if available)
    const isSlowCPU = hardwareConcurrency < 4;
    const isSlowNetwork = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');
    const isLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4; // Less than 4GB RAM
    
    return {
      isSlowDevice: isSlowCPU || isSlowNetwork || isLowMemory,
      reasons: {
        slowCPU: isSlowCPU,
        slowNetwork: isSlowNetwork,
        lowMemory: isLowMemory
      },
      details: {
        cpuCores: hardwareConcurrency,
        networkType: connection?.effectiveType || 'unknown',
        deviceMemory: navigator.deviceMemory || 'unknown'
      }
    };
  }

  /**
   * Get optimization recommendations based on device capabilities
   */
  getOptimizationRecommendations() {
    const deviceInfo = this.detectSlowDevice();
    const recommendations = [];

    if (deviceInfo.isSlowDevice) {
      if (deviceInfo.reasons.slowCPU) {
        recommendations.push({
          type: 'cpu',
          message: 'Device has limited CPU cores. Consider reducing concurrent operations.',
          action: 'sequential_loading'
        });
      }

      if (deviceInfo.reasons.slowNetwork) {
        recommendations.push({
          type: 'network',
          message: 'Slow network detected. Consider loading essential data first.',
          action: 'prioritize_critical'
        });
      }

      if (deviceInfo.reasons.lowMemory) {
        recommendations.push({
          type: 'memory',
          message: 'Limited device memory. Consider data streaming or lazy loading.',
          action: 'reduce_memory_usage'
        });
      }
    }

    return {
      deviceInfo,
      recommendations,
      suggestedConfig: {
        maxConcurrentLoads: deviceInfo.isSlowDevice ? 1 : 3,
        enableCaching: true,
        prioritizeEssential: deviceInfo.reasons.slowNetwork,
        useProgressiveLoading: deviceInfo.isSlowDevice
      }
    };
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Auto-detect device capabilities on load
const optimization = performanceMonitor.getOptimizationRecommendations();
if (optimization.recommendations.length > 0) {
  console.group('🔧 Performance Optimization Recommendations');
  optimization.recommendations.forEach(rec => {
    console.log(`${rec.type.toUpperCase()}: ${rec.message}`);
  });
  console.log('Suggested Config:', optimization.suggestedConfig);
  console.groupEnd();
}

export default performanceMonitor;
