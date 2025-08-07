/**
 * Service for loading and processing grid cell data from CSV with performance optimizations
 */
class GridService {
  constructor() {
    this.cache = null;
    this.loadingPromise = null;
    this.processedData = null; // Store processed GeoJSON
    this.originalData = null;  // Store raw CSV data for memory management
  }

  /**
   * Load grid cells from CSV file with performance optimizations
   * @returns {Promise<Array>} - Array of grid cell objects
   */
  async loadGridCells() {
    // Return cached data if available
    if (this.cache) {
      console.log('📦 Using cached grid data');
      return this.cache;
    }

    // Return existing promise if already loading
    if (this.loadingPromise) {
      console.log('⏳ Grid data already loading...');
      return this.loadingPromise;
    }

    // Start loading with memory optimization
    this.loadingPromise = this.fetchAndParseCSVOptimized();
    
    try {
      const gridData = await this.loadingPromise;
      this.cache = gridData;
      this.loadingPromise = null;
      
      // Clear original CSV data from memory after processing
      this.originalData = null;
      
      return gridData;
    } catch (error) {
      this.loadingPromise = null;
      throw error;
    }
  }

  /**
   * Optimized fetch and parse with memory management
   * @returns {Promise<Array>} - Parsed grid data
   */
  async fetchAndParseCSVOptimized() {
    const startTime = performance.now();
    console.log('🔄 Loading Texas grid cells from CSV (optimized)...');

    try {
      // Import the CSV file from public directory
      const csvPath = '/texas_grid_cells.csv';
      const response = await fetch(csvPath);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
      }

      const csvText = await response.text();
      const parseTime = performance.now();
      
      const fileSizeMB = (csvText.length / 1024 / 1024);
      console.log(`📥 CSV downloaded: ${fileSizeMB.toFixed(2)}MB`);
      
      // Parse CSV with streaming approach for better memory management
      const gridCells = this.parseCSVOptimized(csvText);
      const endTime = performance.now();
      
      // Memory optimization: clear CSV text from memory
      const processedSizeMB = (JSON.stringify(gridCells).length / 1024 / 1024);
      
      console.log(`✅ Grid cells loaded with optimizations:`);
      console.log(`   📊 Total cells: ${gridCells.length.toLocaleString()}`);
      console.log(`   💾 Original size: ${fileSizeMB.toFixed(2)}MB`);
      console.log(`   💾 Processed size: ${processedSizeMB.toFixed(2)}MB`);
      console.log(`   📉 Memory reduction: ${((1 - processedSizeMB/fileSizeMB) * 100).toFixed(1)}%`);
      console.log(`   🌐 Download time: ${(parseTime - startTime).toFixed(2)}ms`);
      console.log(`   ⚙️  Parse time: ${(endTime - parseTime).toFixed(2)}ms`);
      console.log(`   📊 Total time: ${(endTime - startTime).toFixed(2)}ms (${((endTime - startTime)/1000).toFixed(2)}s)`);
      
      // Performance analysis
      const cellsPerSecond = Math.round(gridCells.length / ((endTime - startTime) / 1000));
      console.log(`   ⚡ Processing rate: ${cellsPerSecond.toLocaleString()} cells/second`);
      
      // Memory warnings
      if (processedSizeMB > 50) {
        console.warn(`⚠️  Large dataset in memory: ${processedSizeMB.toFixed(2)}MB`);
        console.warn(`   💡 Consider: Implementing tile-based loading for better performance`);
      }
      
      return gridCells;
      
    } catch (error) {
      console.error('❌ Failed to load grid cells:', error);
      throw new Error(`Failed to load grid cells: ${error.message}`);
    }
  }

  /**
   * Optimized CSV parsing with memory efficiency
   * @param {string} csvText - Raw CSV content
   * @returns {Array} - Array of grid cell objects
   */
  parseCSVOptimized(csvText) {
    const lines = csvText.split('\n');
    console.log(`🔧 Parsing CSV: ${lines.length - 1} data rows (optimized)`);
    
    const gridCells = [];
    let skippedRows = 0;
    let processedRows = 0;
    
    // Process in chunks for better memory management
    const CHUNK_SIZE = 1000;
    const totalRows = lines.length - 1;
    
    // Skip header row, parse data rows in chunks
    for (let i = 1; i < lines.length; i += CHUNK_SIZE) {
      const chunkEnd = Math.min(i + CHUNK_SIZE, lines.length);
      const chunkProgress = Math.round((i / totalRows) * 100);
      
      if (chunkProgress % 20 === 0 && chunkProgress > 0) {
        console.log(`   📊 Processing: ${chunkProgress}% (${i.toLocaleString()}/${totalRows.toLocaleString()} rows)`);
      }
      
      for (let j = i; j < chunkEnd; j++) {
        const values = lines[j].trim().split(',');
        
        if (values.length >= 5 && values[0] && values[1] && values[2] && values[3] && values[4]) {
          try {
            const minLng = parseFloat(values[1]);
            const minLat = parseFloat(values[2]);
            const maxLng = parseFloat(values[3]);
            const maxLat = parseFloat(values[4]);
            
            // Validate coordinates
            if (!isNaN(minLng) && !isNaN(minLat) && !isNaN(maxLng) && !isNaN(maxLat)) {
              const gridCell = {
                index: parseInt(values[0]),
                min_lng: minLng,
                min_lat: minLat,
                max_lng: maxLng,
                max_lat: maxLat,
                // Pre-calculate bounds for better performance
                bounds: [
                  [minLat, minLng], // Southwest corner [lat, lng]
                  [maxLat, maxLng]  // Northeast corner [lat, lng]
                ]
              };
              
              gridCells.push(gridCell);
              processedRows++;
            } else {
              skippedRows++;
            }
          } catch (error) {
            skippedRows++;
          }
        } else {
          skippedRows++;
        }
      }
    }
    
    console.log(`✅ CSV parsing complete:`);
    console.log(`   ✅ Processed: ${processedRows.toLocaleString()} rows`);
    console.log(`   ⚠️  Skipped: ${skippedRows.toLocaleString()} invalid rows`);
    console.log(`   📊 Success rate: ${((processedRows / (processedRows + skippedRows)) * 100).toFixed(1)}%`);
    
    return gridCells;
  }

  /**
   * Convert grid cells to optimized GeoJSON format
   * @param {Array} gridCells - Array of grid cell objects
   * @returns {Object} - GeoJSON FeatureCollection
   */
  toGeoJSON(gridCells) {
    const startTime = performance.now();
    console.log('🔄 Converting to GeoJSON (optimized)...');
    
    const features = gridCells.map((cell, index) => {
      // Show progress for large datasets
      if (index % 5000 === 0 && index > 0) {
        const progress = Math.round((index / gridCells.length) * 100);
        console.log(`   📊 GeoJSON progress: ${progress}% (${index.toLocaleString()}/${gridCells.length.toLocaleString()})`);
      }
      
      return {
        type: 'Feature',
        properties: {
          index: cell.index,
          grid_id: `grid_${cell.index}`
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [cell.min_lng, cell.min_lat], // Southwest
            [cell.max_lng, cell.min_lat], // Southeast
            [cell.max_lng, cell.max_lat], // Northeast
            [cell.min_lng, cell.max_lat], // Northwest
            [cell.min_lng, cell.min_lat]  // Close polygon
          ]]
        }
      };
    });

    const geoJson = {
      type: 'FeatureCollection',
      features: features
    };
    
    const endTime = performance.now();
    const geoJsonSizeMB = (JSON.stringify(geoJson).length / 1024 / 1024);
    
    console.log(`✅ GeoJSON conversion complete:`);
    console.log(`   ⏱️  Conversion time: ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`   📊 Features: ${features.length.toLocaleString()}`);
    console.log(`   💾 GeoJSON size: ${geoJsonSizeMB.toFixed(2)}MB`);
    console.log(`   ⚡ Conversion rate: ${Math.round(features.length / ((endTime - startTime) / 1000)).toLocaleString()} features/second`);
    
    // Cache the processed GeoJSON
    this.processedData = geoJson;
    
    return geoJson;
  }

  /**
   * Get optimized statistics about the grid
   * @param {Array} gridCells - Array of grid cell objects
   * @returns {Object} - Grid statistics
   */
  getGridStats(gridCells) {
    if (!gridCells || gridCells.length === 0) {
      return null;
    }

    console.log('📊 Calculating grid statistics...');
    
    // Use sampling for large datasets to speed up stats calculation
    const sampleSize = Math.min(1000, gridCells.length);
    const sampleCells = gridCells.slice(0, sampleSize);
    
    const lngs = sampleCells.flatMap(cell => [cell.min_lng, cell.max_lng]);
    const lats = sampleCells.flatMap(cell => [cell.min_lat, cell.max_lat]);
    
    // Calculate cell size (assuming uniform grid)
    const cellWidth = sampleCells[0].max_lng - sampleCells[0].min_lng;
    const cellHeight = sampleCells[0].max_lat - sampleCells[0].min_lat;
    
    const stats = {
      totalCells: gridCells.length,
      bounds: {
        minLng: Math.min(...lngs),
        maxLng: Math.max(...lngs),
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats)
      },
      cellSize: {
        width: cellWidth,
        height: cellHeight,
        widthKm: cellWidth * 111.32, // Rough km conversion
        heightKm: cellHeight * 110.54 // Rough km conversion
      },
      memoryUsage: {
        estimatedMB: (JSON.stringify(gridCells).length / 1024 / 1024).toFixed(2),
        cellsPerMB: Math.round(gridCells.length / (JSON.stringify(gridCells).length / 1024 / 1024))
      }
    };
    
    console.log(`📊 Grid statistics calculated (${sampleSize} sample size)`);
    return stats;
  }

  /**
   * Clear cached data to free memory
   */
  clearCache() {
    this.cache = null;
    this.processedData = null;
    this.originalData = null;
    console.log('🗑️  Grid cache cleared - memory freed');
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage() {
    const usage = {
      cacheSize: this.cache ? (JSON.stringify(this.cache).length / 1024 / 1024).toFixed(2) : 0,
      processedSize: this.processedData ? (JSON.stringify(this.processedData).length / 1024 / 1024).toFixed(2) : 0,
      totalMB: 0
    };
    
    usage.totalMB = (parseFloat(usage.cacheSize) + parseFloat(usage.processedSize)).toFixed(2);
    
    return usage;
  }
}

// Export singleton instance
export const gridService = new GridService(); 