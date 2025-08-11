/**
 * Service for loading and processing YOLO classification results for grid cells
 */
class YoloResultsService {
  constructor() {  
    this.cache = null;
    this.loadingPromise = null;
    this.cultivabilityMap = new Map(); // Fast lookup: grid_index -> cultivable (0/1)
  }

  /**
   * Load YOLO results from CSV file
   * @returns {Promise<Map>} - Map of grid index to cultivability data
   */
  async loadYoloResults() {
    // Return cached data if available
    if (this.cache) {
      console.log('📦 Using cached YOLO results');
      return this.cache;
    }

    // Return existing promise if already loading
    if (this.loadingPromise) {
      console.log('⏳ YOLO results already loading...');
      return this.loadingPromise;
    }

    // Start loading
    this.loadingPromise = this.fetchAndParseResults();
    
    try {
      const results = await this.loadingPromise;
      this.cache = results;
      this.loadingPromise = null;
      return results;
    } catch (error) {
      this.loadingPromise = null;
      throw error;
    }
  }

  /**
   * Fetch and parse YOLO results CSV
   * @returns {Promise<Map>} - Parsed results map
   */
  async fetchAndParseResults() {
    const startTime = performance.now();
    console.log('🔄 Loading YOLO classification results...');

    try {
      // Load from backend results
      const csvPath = '/backend/yolo_results/grid_results.csv';
      let response;
      
      // Try multiple possible paths
      const possiblePaths = [
        '/grid_results.csv',
        '/backend/yolo_results/grid_results.csv',
        '/yolo_results/grid_results.csv',
        'http://localhost:8000/static/grid_results.csv'
      ];

      for (const path of possiblePaths) {
        try {
          response = await fetch(path);
          if (response.ok) {
            console.log(`✅ Found YOLO results at: ${path}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!response || !response.ok) {
        throw new Error('Could not find YOLO results file. Please ensure grid_results.csv is accessible.');
      }

      const csvText = await response.text();
      const parseTime = performance.now();
      
      const fileSizeMB = (csvText.length / 1024 / 1024);
      console.log(`📥 YOLO CSV downloaded: ${fileSizeMB.toFixed(2)}MB`);
      
      // Parse CSV
      const results = this.parseYoloCSV(csvText);
      const endTime = performance.now();
      
      console.log(`✅ YOLO results loaded:`);
      console.log(`   📊 Total classifications: ${results.size.toLocaleString()}`);
      console.log(`   💾 File size: ${fileSizeMB.toFixed(2)}MB`);
      console.log(`   🌐 Download time: ${(parseTime - startTime).toFixed(2)}ms`);
      console.log(`   ⚙️  Parse time: ${(endTime - parseTime).toFixed(2)}ms`);
      console.log(`   📊 Total time: ${(endTime - startTime).toFixed(2)}ms`);
      
      // Calculate statistics
      const cultivableCount = Array.from(results.values()).filter(r => r.cultivable === 1).length;
      const nonCultivableCount = results.size - cultivableCount;
      
      console.log(`   🌱 Cultivable: ${cultivableCount.toLocaleString()} (${((cultivableCount/results.size)*100).toFixed(1)}%)`);
      console.log(`   🖤 Non-cultivable: ${nonCultivableCount.toLocaleString()} (${((nonCultivableCount/results.size)*100).toFixed(1)}%)`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Failed to load YOLO results:', error);
      throw new Error(`Failed to load YOLO results: ${error.message}`);
    }
  }

  /**
   * Parse YOLO results CSV
   * @param {string} csvText - Raw CSV content
   * @returns {Map} - Map of grid index to result data
   */
  parseYoloCSV(csvText) {
    const lines = csvText.trim().split('\n');
    console.log(`🔧 Parsing YOLO CSV: ${lines.length - 1} data rows`);
    
    const results = new Map();
    let skippedRows = 0;
    let processedRows = 0;
    
    // Skip header row, parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].trim().split(',');
      
      if (values.length >= 4 && values[0] && values[1] && values[2] && values[3]) {
        try {
          const index = parseInt(values[0]);
          const cultivable = parseInt(values[1]);
          const predictedClass = values[2];
          const confidence = parseFloat(values[3]);
          
          // Validate data
          if (!isNaN(index) && !isNaN(cultivable) && !isNaN(confidence)) {
            const resultData = {
              index: index,
              cultivable: cultivable, // 0 = non-cultivable, 1 = cultivable
              predictedClass: predictedClass,
              confidence: confidence
            };
            
            results.set(index, resultData);
            
            // Also populate the fast lookup map
            this.cultivabilityMap.set(index, cultivable);
            
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
    
    console.log(`✅ YOLO CSV parsing complete:`);
    console.log(`   ✅ Processed: ${processedRows.toLocaleString()} rows`);
    console.log(`   ⚠️  Skipped: ${skippedRows.toLocaleString()} invalid rows`);
    console.log(`   📊 Success rate: ${((processedRows / (processedRows + skippedRows)) * 100).toFixed(1)}%`);
    
    return results;
  }

  /**
   * Get cultivability for a specific grid index
   * @param {number} gridIndex - Grid cell index
   * @returns {number|null} - 0 for non-cultivable, 1 for cultivable, null if not found
   */
  getCultivability(gridIndex) {
    return this.cultivabilityMap.get(gridIndex) ?? null;
  }

  /**
   * Check if a grid cell is cultivable
   * @param {number} gridIndex - Grid cell index
   * @returns {boolean} - True if cultivable, false otherwise
   */
  isCultivable(gridIndex) {
    return this.getCultivability(gridIndex) === 1;
  }

  /**
   * Get full result data for a grid index
   * @param {number} gridIndex - Grid cell index
   * @returns {Object|null} - Full result data or null if not found
   */
  getResultData(gridIndex) {
    return this.cache ? this.cache.get(gridIndex) || null : null;
  }

  /**
   * Get statistics about the YOLO results
   * @returns {Object|null} - Statistics object
   */
  getStats() {
    if (!this.cache) {
      return null;
    }

    const total = this.cache.size;
    const cultivable = Array.from(this.cache.values()).filter(r => r.cultivable === 1).length;
    const nonCultivable = total - cultivable;

    return {
      total: total,
      cultivable: cultivable,
      nonCultivable: nonCultivable,
      cultivablePercentage: (cultivable / total) * 100,
      nonCultivablePercentage: (nonCultivable / total) * 100
    };
  }

  /**
   * Clear cached data to free memory
   */
  clearCache() {
    this.cache = null;
    this.cultivabilityMap.clear();
    console.log('🗑️  YOLO results cache cleared - memory freed');
  }
}

// Export singleton instance
export const yoloResultsService = new YoloResultsService(); 