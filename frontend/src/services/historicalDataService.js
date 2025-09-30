import * as XLSX from 'xlsx';

/**
 * Service for loading and parsing historical fire data from Excel files
 */
class HistoricalDataService {
  constructor() {
    this.cache = new Map();
    this.dataFiles = [
      {
        id: 'deadliest',
        name: 'Texas Deadliest Fires',
        filename: 'texas_deadliest_fires.xlsx',
        description: 'Historical data of the most deadly wildfires in Texas'
      },
      {
        id: 'destructive',
        name: 'Texas Most Destructive Fires',
        filename: 'texas_most_destructive_fires.xlsx',
        description: 'Historical data of the most destructive wildfires in Texas'
      },
      {
        id: 'stats',
        name: 'Texas Wildfire Statistics',
        filename: 'texas_wildfire_stats.xlsx',
        description: 'General wildfire statistics and trends for Texas'
      }
    ];
  }

  /**
   * Load Excel file from the public directory
   * @param {string} filename - Name of the Excel file
   * @returns {Promise<Object>} Parsed Excel data
   */
  async loadExcelFile(filename) {
    try {
      // Check cache first
      if (this.cache.has(filename)) {
        console.log(`📋 Loading ${filename} from cache`);
        return this.cache.get(filename);
      }

      console.log(`📋 Loading ${filename} from server`);
      
      // Fetch the Excel file from the public directory
      const response = await fetch(`/historical_fire_data/${filename}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${filename}: ${response.status} ${response.statusText}`);
      }

      // Get the file as array buffer
      const arrayBuffer = await response.arrayBuffer();
      
      // Parse with xlsx
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Get the first worksheet
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      
      // Convert to JSON with headers
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // Use first row as headers
        defval: '', // Default value for empty cells
        blankrows: false // Skip blank rows
      });

      // Process the data to have proper headers
      const processedData = this.processExcelData(jsonData);
      
      // Cache the result
      this.cache.set(filename, processedData);
      
      console.log(`✅ Successfully loaded ${filename}:`);
      console.log(`   📊 Total rows: ${processedData.rows.length}`);
      console.log(`   📋 Headers: ${processedData.headers.length} columns`);
      console.log(`   🏷️ Column names:`, processedData.headers);
      
      return processedData;

    } catch (error) {
      console.error(`❌ Error loading ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Process raw Excel data into a structured format
   * @param {Array} rawData - Raw data from Excel
   * @returns {Object} Processed data with headers and rows
   */
  processExcelData(rawData) {
    if (!rawData || rawData.length === 0) {
      console.log('📋 No raw data to process');
      return { headers: [], rows: [] };
    }

    console.log(`📋 Processing Excel data: ${rawData.length} raw rows`);

    // First row contains headers
    const headers = rawData[0] || [];
    console.log(`📋 Found ${headers.length} headers:`, headers);
    
    // Remaining rows contain data
    const allRows = rawData.slice(1).map((row, index) => {
      const rowData = {};
      headers.forEach((header, colIndex) => {
        rowData[header] = row[colIndex] || '';
      });
      rowData._rowIndex = index;
      return rowData;
    });

    console.log(`📋 Processed ${allRows.length} data rows before filtering`);

    const filteredRows = allRows.filter(row => {
      // Filter out completely empty rows
      return Object.values(row).some(value => 
        value !== '' && value !== null && value !== undefined && value !== '_rowIndex'
      );
    });

    console.log(`📋 After filtering empty rows: ${filteredRows.length} rows remaining`);

    return {
      headers: headers.filter(header => header && header.toString().trim() !== ''),
      rows: filteredRows
    };
  }

  /**
   * Load all historical data files
   * @returns {Promise<Object>} All historical data organized by file type
   */
  async loadAllHistoricalData() {
    try {
      console.log('📋 Loading all historical fire data...');
      
      const results = {};
      const loadPromises = this.dataFiles.map(async (fileInfo) => {
        try {
          const data = await this.loadExcelFile(fileInfo.filename);
          return {
            ...fileInfo,
            data: data,
            loaded: true,
            error: null
          };
        } catch (error) {
          console.warn(`⚠️ Failed to load ${fileInfo.filename}:`, error);
          return {
            ...fileInfo,
            data: { headers: [], rows: [] },
            loaded: false,
            error: error.message
          };
        }
      });

      const loadedFiles = await Promise.all(loadPromises);
      
      // Organize results by file ID
      loadedFiles.forEach(fileResult => {
        results[fileResult.id] = fileResult;
      });

      console.log('✅ Historical data loading completed');
      return results;

    } catch (error) {
      console.error('❌ Error loading historical data:', error);
      throw error;
    }
  }

  /**
   * Get metadata about available data files
   * @returns {Array} Array of file metadata
   */
  getAvailableFiles() {
    return [...this.dataFiles];
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Historical data cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      cachedFiles: this.cache.size,
      totalFiles: this.dataFiles.length,
      cacheKeys: Array.from(this.cache.keys())
    };
  }

  /**
   * Format data for display in tables
   * @param {Object} data - Processed Excel data
   * @param {number} maxRows - Maximum number of rows to return
   * @returns {Object} Formatted data for display
   */
  formatForDisplay(data, maxRows = 100) {
    if (!data || !data.rows) {
      return { headers: [], rows: [], total: 0, showing: 0 };
    }

    const displayRows = data.rows.slice(0, maxRows);
    
    return {
      headers: data.headers,
      rows: displayRows,
      total: data.rows.length,
      showing: displayRows.length,
      hasMore: data.rows.length > maxRows
    };
  }

  /**
   * Search within the data
   * @param {Object} data - Processed Excel data
   * @param {string} searchTerm - Term to search for
   * @returns {Object} Filtered data matching the search term
   */
  searchData(data, searchTerm) {
    if (!data || !data.rows || !searchTerm) {
      return data;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    
    const filteredRows = data.rows.filter(row => {
      return Object.values(row).some(value => {
        return value && value.toString().toLowerCase().includes(lowerSearchTerm);
      });
    });

    return {
      headers: data.headers,
      rows: filteredRows
    };
  }
}

// Export singleton instance
export const historicalDataService = new HistoricalDataService();
export default historicalDataService;
