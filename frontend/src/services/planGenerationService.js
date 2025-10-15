/**
 * Texas Plantation Plan Generation Service
 * Handles communication with the backend API for generating comprehensive 10-year plantation plans
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class PlanGenerationService {
  constructor() {
    this.currentRequest = null;
    this.abortController = null;
    this.currentRequestId = null;
  }

  /**
   * Generate a unique request ID for tracking
   * @returns {string} Unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a comprehensive 10-year plantation plan
   * @param {Object} spatialData - The spatial query results from map click
   * @param {string} additionalContext - Optional additional context or requirements
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise} Plan generation result
   */
  async generatePlantationPlan(spatialData, additionalContext = null, onProgress = null) {
    try {
      // Cancel any existing request
      this.cancelGeneration();

      // Create new abort controller for this request
      this.abortController = new AbortController();
      this.currentRequestId = this.generateRequestId();

      console.log('🌱 Starting plantation plan generation...', {
        requestId: this.currentRequestId,
        coordinates: spatialData.clickCoordinates,
        polygonLayers: spatialData.polygonData?.length || 0,
        nearestPoints: spatialData.nearestPoints?.length || 0
      });

      // Notify progress
      if (onProgress) {
        onProgress({ 
          stage: 'initializing', 
          message: 'Preparing plan generation request...',
          percentage: 0 
        });
      }

      // Prepare request payload
      const requestPayload = {
        spatial_data: spatialData,
        additional_context: additionalContext,
        request_id: this.currentRequestId
      };

      console.log('📤 Sending plan generation request:', requestPayload);

      // Start listening to progress updates via SSE
      let eventSource = null;
      if (onProgress && this.currentRequestId) {
        eventSource = new EventSource(`${API_BASE}/api/plantation-plan-progress/${this.currentRequestId}`);
        
        eventSource.onmessage = (event) => {
          try {
            const progressData = JSON.parse(event.data);
            console.log('📊 Progress update:', progressData);
            
            onProgress({
              stage: progressData.stage || 'generating',
              message: progressData.section || 'Generating plan...',
              percentage: progressData.percentage || 0,
              section: progressData.section,
              section_number: progressData.section_number,
              total_sections: progressData.total_sections
            });
          } catch (err) {
            console.error('Failed to parse progress data:', err);
          }
        };
        
        eventSource.onerror = (error) => {
          console.warn('⚠️ SSE connection error:', error);
          eventSource?.close();
        };
      }

      // Make API request
      if (onProgress) {
        onProgress({ 
          stage: 'processing', 
          message: 'Analyzing spatial data and generating plan...',
          percentage: 5
        });
      }

      const response = await fetch(`${API_BASE}/api/generate-plantation-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: this.abortController.signal
      });

      // Close SSE connection
      eventSource?.close();

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(`Plan generation failed: ${errorData.detail || response.statusText}`);
      }

      const planData = await response.json();

      if (onProgress) {
        onProgress({ 
          stage: 'completed', 
          message: 'Plan generation completed successfully!',
          percentage: 100
        });
      }

      console.log('✅ Plan generated successfully:', {
        planId: planData.plan_id,
        title: planData.title,
        contentLength: planData.content?.length || 0,
        previewUrl: planData.preview_url,
        pdfUrl: planData.pdf_url
      });

      return {
        success: true,
        plan: planData,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('🚫 Plan generation cancelled by user');
        return {
          success: false,
          error: 'Generation cancelled',
          cancelled: true
        };
      }

      console.error('❌ Plan generation failed:', error);
      
      if (onProgress) {
        onProgress({ 
          stage: 'error', 
          message: `Generation failed: ${error.message}`,
          error: true,
          percentage: 0
        });
      }

      return {
        success: false,
        error: error.message,
        cancelled: false
      };
    } finally {
      this.currentRequest = null;
      this.abortController = null;
      this.currentRequestId = null;
    }
  }

  /**
   * Get plan preview data
   * @param {string} planId - The plan ID from generation response
   * @returns {Promise} Preview data result
   */
  async getPlantationPlanPreview(planId) {
    try {
      console.log('👁️ Fetching plan preview:', planId);

      const response = await fetch(`${API_BASE}/api/preview-plan/${planId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Preview failed: ${response.statusText}`);
      }

      const previewData = await response.json();
      
      console.log('✅ Preview fetched successfully:', {
        planId: previewData.plan_id,
        title: previewData.title,
        contentLength: previewData.content?.length || 0,
        spatialSummary: previewData.spatial_data_summary
      });

      return { success: true, preview: previewData };

    } catch (error) {
      console.error('❌ Preview fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download the generated plan PDF
   * @param {string} planId - The plan ID from generation response
   * @returns {Promise} Download result
   */
  async downloadPlanPDF(planId) {
    try {
      console.log('📄 Downloading plan PDF:', planId);

      const response = await fetch(`${API_BASE}/api/download-plan/${planId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      // Get the PDF blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `texas_plantation_plan_${planId}.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      window.URL.revokeObjectURL(url);

      console.log('✅ PDF downloaded successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ PDF download failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancel ongoing plan generation
   */
  async cancelGeneration() {
    // Signal server-side cancellation first
    if (this.currentRequestId) {
      try {
        await fetch(`${API_BASE}/api/cancel-plantation-plan/${this.currentRequestId}`, {
          method: 'POST'
        });
        console.log('🛑 Server-side cancellation signaled for:', this.currentRequestId);
      } catch (error) {
        console.warn('⚠️ Failed to signal server cancellation:', error);
      }
    }

    // Abort the HTTP request
    if (this.abortController) {
      console.log('🚫 Cancelling plan generation...');
      this.abortController.abort();
      this.abortController = null;
      this.currentRequest = null;
      this.currentRequestId = null;
    }
  }

  /**
   * Check if a generation is currently in progress
   * @returns {boolean} True if generation is in progress
   */
  isGenerating() {
    return this.currentRequest !== null;
  }

  /**
   * Format spatial data summary for display
   * @param {Object} spatialData - Spatial query results
   * @returns {Object} Formatted summary
   */
  formatSpatialDataSummary(spatialData) {
    const summary = {
      location: 'Unknown',
      coverageLayers: 0,
      nearbyFeatures: 0,
      dataQuality: 'basic'
    };

    if (spatialData.clickCoordinates) {
      summary.location = spatialData.clickCoordinates.formatted || 
        `${spatialData.clickCoordinates.lat?.toFixed(4) || 'N/A'}, ${spatialData.clickCoordinates.lng?.toFixed(4) || 'N/A'}`;
    }

    if (spatialData.polygonData) {
      summary.coverageLayers = spatialData.polygonData.length;
    }

    if (spatialData.nearestPoints) {
      summary.nearbyFeatures = spatialData.nearestPoints.length;
    }

    // Assess data quality
    const totalDataPoints = summary.coverageLayers + summary.nearbyFeatures;
    if (totalDataPoints > 10) {
      summary.dataQuality = 'excellent';
    } else if (totalDataPoints > 5) {
      summary.dataQuality = 'good';
    } else if (totalDataPoints > 2) {
      summary.dataQuality = 'fair';
    }

    return summary;
  }

  /**
   * Format plan content for preview display
   * @param {string} content - Raw plan content
   * @returns {string} Formatted content for display
   */
  formatPlanContentForPreview(content) {
    if (!content) return '';
    
    let formatted = content;
    
    // 1. Handle tables first (before other processing)
    formatted = this._convertMarkdownTables(formatted);
    
    // 2. Handle headers (in reverse order to avoid conflicts)
    formatted = formatted
      .replace(/^#### (.*$)/gm, '<h4 class="preview-h4">$1</h4>')
      .replace(/^### (.*$)/gm, '<h3 class="preview-h3">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="preview-h2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="preview-h1">$1</h1>');
    
    // 3. Handle lists
    formatted = this._convertMarkdownLists(formatted);
    
    // 4. Handle text formatting
    formatted = formatted
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic text
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 5. Handle horizontal rules
    formatted = formatted.replace(/^---+$/gm, '<hr class="preview-hr">');
    
    // 6. Handle paragraphs and line breaks
    formatted = this._convertParagraphs(formatted);
    
    return formatted;
  }
  
  /**
   * Convert markdown tables to HTML tables
   * @param {string} text - Text containing markdown tables
   * @returns {string} Text with HTML tables
   */
  _convertMarkdownTables(text) {
    // Split text into lines and find table patterns
    const lines = text.split('\n');
    let result = '';
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      
      // Check if this line contains pipe separators (potential table row)
      if (line.includes('|') && line.trim().length > 0) {
        // Look ahead to see if next line is a separator row
        const nextLine = lines[i + 1];
        
        if (nextLine && this._isTableSeparator(nextLine)) {
          // Found a table! Process it
          const tableResult = this._processTable(lines, i);
          result += tableResult.html;
          i = tableResult.nextIndex;
          continue;
        }
      }
      
      // Not a table, add the line as-is
      result += line + '\n';
      i++;
    }
    
    return result;
  }
  
  /**
   * Check if a line is a table separator row
   * @param {string} line - Line to check
   * @returns {boolean} True if it's a separator row
   */
  _isTableSeparator(line) {
    // Table separator contains only pipes, dashes, colons, and whitespace
    return /^[\s\|\-:]+$/.test(line) && line.includes('|') && line.includes('-');
  }
  
  /**
   * Process a complete table starting from the header row
   * @param {Array} lines - All lines in the text
   * @param {number} startIndex - Index of the header row
   * @returns {Object} HTML and next index to continue processing
   */
  _processTable(lines, startIndex) {
    const headerLine = lines[startIndex];
    const separatorLine = lines[startIndex + 1];
    
    // Parse header
    const headers = headerLine.split('|')
      .map(h => h.trim())
      .filter(h => h.length > 0);
    
    // Find all table rows
    const tableRows = [];
    let currentIndex = startIndex + 2; // Start after separator
    
    while (currentIndex < lines.length) {
      const line = lines[currentIndex];
      
      // If line doesn't contain pipes or is empty, table has ended
      if (!line.includes('|') || line.trim().length === 0) {
        break;
      }
      
      // Check if this looks like another table separator (nested table)
      if (this._isTableSeparator(line)) {
        break;
      }
      
      // Parse row
      const cells = line.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0);
      
      if (cells.length > 0) {
        tableRows.push(cells);
      }
      
      currentIndex++;
    }
    
    // Build HTML table
    let tableHtml = '<table class="preview-table">';
    
    // Add header
    if (headers.length > 0) {
      tableHtml += '<thead><tr>';
      headers.forEach(header => {
        let headerContent = this._formatCellContent(header);
        tableHtml += `<th>${headerContent}</th>`;
      });
      tableHtml += '</tr></thead>';
    }
    
    // Add body rows
    if (tableRows.length > 0) {
      tableHtml += '<tbody>';
      tableRows.forEach(row => {
        tableHtml += '<tr>';
        // Ensure we have the same number of cells as headers
        for (let i = 0; i < Math.max(headers.length, row.length); i++) {
          const cell = row[i] || '';
          let cellContent = this._formatCellContent(cell);
          tableHtml += `<td>${cellContent}</td>`;
        }
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody>';
    }
    
    tableHtml += '</table>\n';
    
    return {
      html: tableHtml,
      nextIndex: currentIndex
    };
  }
  
  /**
   * Format cell content with markdown formatting
   * @param {string} content - Cell content
   * @returns {string} Formatted content
   */
  _formatCellContent(content) {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  
  /**
   * Convert markdown lists to HTML lists
   * @param {string} text - Text containing markdown lists
   * @returns {string} Text with HTML lists
   */
  _convertMarkdownLists(text) {
    // Handle unordered lists (- or • or *)
    text = text.replace(/^([•\-\*]\s+.+(?:\n[•\-\*]\s+.+)*)/gm, (match) => {
      const items = match.split('\n')
        .map(line => line.replace(/^[•\-\*]\s+/, '').trim())
        .filter(item => item.length > 0);
      
      let listHtml = '<ul class="preview-list">';
      items.forEach(item => {
        // Process item content for formatting
        let itemContent = item
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code>$1</code>');
        listHtml += `<li>${itemContent}</li>`;
      });
      listHtml += '</ul>';
      return listHtml;
    });
    
    // Handle numbered lists
    text = text.replace(/^(\d+\.\s+.+(?:\n\d+\.\s+.+)*)/gm, (match) => {
      const items = match.split('\n')
        .map(line => line.replace(/^\d+\.\s+/, '').trim())
        .filter(item => item.length > 0);
      
      let listHtml = '<ol class="preview-list">';
      items.forEach(item => {
        // Process item content for formatting
        let itemContent = item
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code>$1</code>');
        listHtml += `<li>${itemContent}</li>`;
      });
      listHtml += '</ol>';
      return listHtml;
    });
    
    return text;
  }
  
  /**
   * Convert text to paragraphs with proper line breaks
   * @param {string} text - Text to convert
   * @returns {string} Text with paragraph tags
   */
  _convertParagraphs(text) {
    // Split by double line breaks to create paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    
    return paragraphs
      .map(para => {
        para = para.trim();
        if (para.length === 0) return '';
        
        // Don't wrap if it's already an HTML element
        if (para.startsWith('<') && para.endsWith('>')) {
          return para;
        }
        
        // Convert single line breaks to <br> within paragraphs
        para = para.replace(/\n/g, '<br>');
        
        return `<p class="preview-paragraph">${para}</p>`;
      })
      .filter(para => para.length > 0)
      .join('\n');
  }

  /**
   * Validate spatial data for plan generation
   * @param {Object} spatialData - Spatial query results to validate
   * @returns {Object} Validation result with warnings/recommendations
   */
  validateSpatialData(spatialData) {
    const validation = {
      isValid: true,
      warnings: [],
      recommendations: []
    };

    // Check if we have basic coordinate data
    if (!spatialData.clickCoordinates || 
        (!spatialData.clickCoordinates.lat && !spatialData.clickCoordinates.lng)) {
      validation.isValid = false;
      validation.warnings.push('Missing coordinate information');
      return validation;
    }

    // Check data richness
    const polygonCount = spatialData.polygonData?.length || 0;
    const pointCount = spatialData.nearestPoints?.length || 0;

    if (polygonCount === 0 && pointCount === 0) {
      validation.warnings.push('Limited spatial data available for this location');
      validation.recommendations.push('Consider enabling more map layers for richer plan generation');
    } else if (polygonCount === 0) {
      validation.warnings.push('No coverage layers found for this location');
      validation.recommendations.push('Plan will be based on general Texas agricultural guidelines');
    } else if (pointCount === 0) {
      validation.warnings.push('No nearby reference features found');
      validation.recommendations.push('Plan may lack local context information');
    }

    // Check for rich property data
    let hasRichData = false;
    if (spatialData.polygonData) {
      hasRichData = spatialData.polygonData.some(feature => 
        feature.properties && Object.keys(feature.properties).length > 2
      );
    }

    if (!hasRichData && spatialData.nearestPoints) {
      hasRichData = spatialData.nearestPoints.some(feature => 
        feature.properties && Object.keys(feature.properties).length > 2
      );
    }

    if (!hasRichData) {
      validation.recommendations.push('Enable more detailed map layers for enhanced plan customization');
    }

    return validation;
  }
}

// Export singleton instance
export default new PlanGenerationService(); 