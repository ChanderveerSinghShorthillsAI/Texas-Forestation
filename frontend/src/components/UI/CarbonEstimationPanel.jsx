import React, { useState, useEffect } from 'react';
import { carbonEstimationService } from '../../services/carbonEstimationService';
import './CarbonEstimationPanel.css';

const CarbonEstimationPanel = ({ 
  selectedCounty = null, 
  isVisible = true, 
  onClose = null,
  onCountySelect = null 
}) => {
  const [carbonData, setCarbonData] = useState(null);
  const [statewideData, setStatewideData] = useState(null);
  const [topCounties, setTopCounties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('county');
  const [searchCounty, setSearchCounty] = useState('');

  // Load county data when selectedCounty changes
  useEffect(() => {
    if (selectedCounty && activeTab === 'county') {
      loadCountyData(selectedCounty);
    }
  }, [selectedCounty, activeTab]);

  // Load statewide data when statewide tab is active
  useEffect(() => {
    if (activeTab === 'statewide' && !statewideData) {
      loadStatewideData();
    }
  }, [activeTab, statewideData]);

  // Load top counties when rankings tab is active
  useEffect(() => {
    if (activeTab === 'rankings' && topCounties.length === 0) {
      loadTopCounties();
    }
  }, [activeTab, topCounties]);

  const loadCountyData = async (countyName) => {
    setLoading(true);
    setError(null);

    try {
      const data = await carbonEstimationService.getCountyCarbon(countyName);
      setCarbonData(data);
    } catch (err) {
      setError(`Failed to load carbon data for ${countyName}: ${err.message}`);
      setCarbonData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadStatewideData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await carbonEstimationService.getStatewideCarbon();
      setStatewideData(data);
    } catch (err) {
      setError(`Failed to load statewide data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTopCounties = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await carbonEstimationService.getTopCarbonCounties(15);
      setTopCounties(data.top_counties || []);
    } catch (err) {
      setError(`Failed to load top counties: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchCounty = async (e) => {
    e.preventDefault();
    if (searchCounty.trim()) {
      await loadCountyData(searchCounty.trim());
      setSearchCounty('');
      if (onCountySelect) {
        onCountySelect(searchCounty.trim());
      }
    }
  };

  const handleCountyClick = (countyName) => {
    if (onCountySelect) {
      onCountySelect(countyName);
    }
    setActiveTab('county');
  };

  if (!isVisible) return null;

  return (
    <div className="carbon-estimation-panel">
      <div className="panel-header">
        <h2>🌲 Texas Carbon Estimation</h2>
        {onClose && (
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>

      <div className="panel-tabs">
        <button 
          className={`tab ${activeTab === 'county' ? 'active' : ''}`}
          onClick={() => setActiveTab('county')}
        >
          County Analysis
        </button>
        <button 
          className={`tab ${activeTab === 'statewide' ? 'active' : ''}`}
          onClick={() => setActiveTab('statewide')}
        >
          Statewide
        </button>
        <button 
          className={`tab ${activeTab === 'rankings' ? 'active' : ''}`}
          onClick={() => setActiveTab('rankings')}
        >
          Top Counties
        </button>
      </div>

      <div className="panel-content">
        {loading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Calculating carbon stocks...</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {/* County Tab */}
        {activeTab === 'county' && (
          <div className="county-tab">
            <div className="county-search">
              <form onSubmit={handleSearchCounty}>
                <input
                  type="text"
                  placeholder="Search county (e.g., Harris, Dallas)"
                  value={searchCounty}
                  onChange={(e) => setSearchCounty(e.target.value)}
                  className="county-search-input"
                />
                <button type="submit" className="search-btn">
                  Search
                </button>
              </form>
            </div>

            {selectedCounty && (
              <p className="selected-county">
                📍 Selected: <strong>{selectedCounty} County</strong>
              </p>
            )}

            {carbonData && !loading && (
              <div className="carbon-results">
                <div className="county-header">
                  <h3>{carbonData.county_name} County</h3>
                  <span className="fips-code">FIPS: {carbonData.county_fips}</span>
                  {carbonEstimationService.isDefaultEstimate(carbonData) && (
                    <div className="default-estimate-warning" style={{
                      backgroundColor: '#fef3c7',
                      color: '#d97706',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      marginTop: '8px',
                      border: '1px solid #fcd34d'
                    }}>
                      ⚠️ <strong>Default Estimate:</strong> No biomass data available for this county. Values are based on average Texas county characteristics.
                    </div>
                  )}
                </div>

                <div className="carbon-metrics">
                  <div className="metric-card total-carbon">
                    <div className="metric-icon">🌍</div>
                    <div className="metric-content">
                      <div className="metric-label">Total Carbon Stock</div>
                      <div className="metric-value">
                        {carbonEstimationService.formatCarbonValue(carbonData.total_carbon_tons)}
                      </div>
                    </div>
                  </div>

                  <div className="metric-card co2-equivalent">
                    <div className="metric-icon">💨</div>
                    <div className="metric-content">
                      <div className="metric-label">CO₂ Equivalent</div>
                      <div className="metric-value">
                        {carbonEstimationService.formatCO2Value(carbonData.total_co2_equivalent_tons)}
                      </div>
                    </div>
                  </div>

                  <div className="metric-card biomass-carbon">
                    <div className="metric-icon">🌲</div>
                    <div className="metric-content">
                      <div className="metric-label">Biomass Carbon</div>
                      <div className="metric-value">
                        {carbonEstimationService.formatCarbonValue(carbonData.biomass_carbon_tons)}
                      </div>
                    </div>
                  </div>

                  <div className="metric-card soil-carbon">
                    <div className="metric-icon">🌱</div>
                    <div className="metric-content">
                      <div className="metric-label">Soil Carbon Potential</div>
                      <div className="metric-value">
                        {carbonEstimationService.formatCarbonValue(carbonData.soil_carbon_potential_tons)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="detailed-breakdown">
                  <h4>Detailed Breakdown</h4>
                  <div className="breakdown-items">
                    <div className="breakdown-item">
                      <span className="item-label">Wood Biomass:</span>
                      <span className="item-value">
                        {carbonEstimationService.formatCarbonValue(carbonData.wood_biomass_tons)}
                      </span>
                    </div>
                    <div className="breakdown-item">
                      <span className="item-label">Crop Residue:</span>
                      <span className="item-value">
                        {carbonEstimationService.formatCarbonValue(carbonData.crop_residue_tons)}
                      </span>
                    </div>
                    <div className="breakdown-item">
                      <span className="item-label">Wetland Carbon/Year:</span>
                      <span className="item-value">
                        {carbonEstimationService.formatCarbonValue(carbonData.wetland_carbon_potential_tons)}
                      </span>
                    </div>
                    {carbonData.wetland_acres > 0 && (
                      <div className="breakdown-item">
                        <span className="item-label">Wetland Area:</span>
                        <span className="item-value">{carbonData.wetland_acres.toFixed(1)} acres</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="calculation-info">
                  <small>
                    Calculated: {new Date(carbonData.calculation_timestamp).toLocaleString()}
                  </small>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Statewide Tab */}
        {activeTab === 'statewide' && (
          <div className="statewide-tab">
            {statewideData && !loading && (
              <div className="statewide-results">
                <div className="statewide-summary">
                  <h3>Texas Statewide Carbon Assessment</h3>
                  
                  <div className="summary-metrics">
                    <div className="summary-card">
                      <div className="summary-icon">🏢</div>
                      <div className="summary-content">
                        <div className="summary-label">Counties Analyzed</div>
                        <div className="summary-value">{statewideData.total_counties}</div>
                      </div>
                    </div>

                    <div className="summary-card highlight">
                      <div className="summary-icon">🌍</div>
                      <div className="summary-content">
                        <div className="summary-label">Total State Carbon</div>
                        <div className="summary-value">
                          {carbonEstimationService.formatCarbonValue(statewideData.total_carbon_tons)}
                        </div>
                      </div>
                    </div>

                    <div className="summary-card">
                      <div className="summary-icon">💨</div>
                      <div className="summary-content">
                        <div className="summary-label">CO₂ Equivalent</div>
                        <div className="summary-value">
                          {carbonEstimationService.formatCO2Value(statewideData.total_co2_equivalent_tons)}
                        </div>
                      </div>
                    </div>

                    <div className="summary-card">
                      <div className="summary-icon">📊</div>
                      <div className="summary-content">
                        <div className="summary-label">Average per County</div>
                        <div className="summary-value">
                          {carbonEstimationService.formatCarbonValue(statewideData.average_carbon_per_county)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="top-counties-preview">
                    <h4>Top 5 Carbon-Rich Counties</h4>
                    <div className="preview-list">
                      {statewideData.top_carbon_counties.slice(0, 5).map((county, index) => (
                        <div 
                          key={county.county_name} 
                          className="preview-county"
                          onClick={() => handleCountyClick(county.county_name)}
                        >
                          <span className="rank">#{index + 1}</span>
                          <span className="name">{county.county_name}</span>
                          <span className="carbon">
                            {carbonEstimationService.formatCarbonValue(county.total_carbon_tons)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rankings Tab */}
        {activeTab === 'rankings' && (
          <div className="rankings-tab">
            {topCounties.length > 0 && !loading && (
              <div className="rankings-results">
                <h3>Top 15 Carbon-Rich Counties</h3>
                <div className="counties-ranking">
                  {topCounties.map((county, index) => {
                    const category = carbonEstimationService.getCarbonCategory(county.total_carbon_tons);
                    return (
                      <div 
                        key={county.county_name}
                        className="ranking-county"
                        onClick={() => handleCountyClick(county.county_name)}
                        style={{ borderLeft: `4px solid ${category.color}` }}
                      >
                        <div className="ranking-position">
                          <span className="position-number">#{index + 1}</span>
                          <span className="category-label">{category.label}</span>
                        </div>
                        <div className="county-info">
                          <div className="county-name">{county.county_name} County</div>
                          <div className="carbon-amount">
                            {carbonEstimationService.formatCarbonValue(county.total_carbon_tons)}
                          </div>
                          <div className="co2-amount">
                            {carbonEstimationService.formatCO2Value(county.total_co2_equivalent_tons)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel-footer">
        <small>
          🔬 Based on scientific conversion factors (IPCC/FAO standards)
        </small>
      </div>
    </div>
  );
};

export default CarbonEstimationPanel;
