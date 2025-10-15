import React, { useState, useEffect, useCallback, useRef } from 'react';
import { carbonEstimationService } from '../../services/carbonEstimationService';
import './CarbonEstimationPanel.css';
import { BsFillTreeFill } from "react-icons/bs";
import { MdLocationPin } from "react-icons/md";
import { RiRoadMapFill } from "react-icons/ri";
import { FaTrophy } from "react-icons/fa";
import { FaEarthAsia } from "react-icons/fa6";
import { WiSmoke } from "react-icons/wi";
import { FaTree } from "react-icons/fa";
import { PiPlantBold } from "react-icons/pi";
import { FaSearch } from "react-icons/fa";

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
  const [skeletonLoading, setSkeletonLoading] = useState(false);
  
  const dataLoadedRef = useRef({
    county: false,
    statewide: false,
    rankings: false
  });

  // Debounce search input
  const debounceTimer = useRef(null);

  // Load county data when selectedCounty changes
  useEffect(() => {
    if (selectedCounty && activeTab === 'county' && !dataLoadedRef.current.county) {
      loadCountyData(selectedCounty);
    }
  }, [selectedCounty, activeTab]);

  // Load statewide data when statewide tab is active
  useEffect(() => {
    if (activeTab === 'statewide' && !dataLoadedRef.current.statewide) {
      loadStatewideData();
    }
  }, [activeTab]);

  // Load top counties when rankings tab is active
  useEffect(() => {
    if (activeTab === 'rankings' && !dataLoadedRef.current.rankings) {
      loadTopCounties();
    }
  }, [activeTab]);

  const loadCountyData = useCallback(async (countyName) => {
    setSkeletonLoading(true);
    setLoading(true);
    setError(null);

    try {
      const data = await carbonEstimationService.getCountyCarbon(countyName);
      setCarbonData(data);
      dataLoadedRef.current.county = true;
    } catch (err) {
      setError(`Failed to load carbon data for ${countyName}: ${err.message}`);
      setCarbonData(null);
    } finally {
      setLoading(false);
      setSkeletonLoading(false);
    }
  }, []);

  const loadStatewideData = useCallback(async () => {
    setSkeletonLoading(true);
    setLoading(true);
    setError(null);

    try {
      const data = await carbonEstimationService.getStatewideCarbon();
      setStatewideData(data);
      dataLoadedRef.current.statewide = true;
    } catch (err) {
      setError(`Failed to load statewide data: ${err.message}`);
    } finally {
      setLoading(false);
      setSkeletonLoading(false);
    }
  }, []);

  const loadTopCounties = useCallback(async () => {
    setSkeletonLoading(true);
    setLoading(true);
    setError(null);

    try {
      const data = await carbonEstimationService.getTopCarbonCounties(15);
      setTopCounties(data.top_counties || []);
      dataLoadedRef.current.rankings = true;
    } catch (err) {
      setError(`Failed to load top counties: ${err.message}`);
    } finally {
      setLoading(false);
      setSkeletonLoading(false);
    }
  }, []);

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
    loadCountyData(countyName);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div className="carbon-modal-backdrop" onClick={onClose} />
      
      {/* Modal panel */}
      <div className="carbon-estimation-modal">
        <div className="modal-header"  style={{background: "#3a6725"}}>
          <div className="header-content">
            {/* <span className="header-icon"><BsFillTreeFill  style={{color: "#2d5016"}}/></span> */}
            <div className="header-text">
              <h2>Texas Carbon Analysis</h2>
              <p className="header-subtitle">Comprehensive carbon stock estimation across Texas counties</p>
            </div>
          </div>
          {onClose && (
            <button className="close-btn" onClick={onClose} aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        <div className="modal-tabs">
          <button 
            className={`tab ${activeTab === 'county' ? 'active' : ''}`}
            onClick={() => handleTabChange('county')}
          >
            {/* <span className="tab-icon"><MdLocationPin color='#FF0000'/></span> */}
            <span className="tab-text">County Analysis</span>
          </button>
          <button 
            className={`tab ${activeTab === 'statewide' ? 'active' : ''}`}
            onClick={() => handleTabChange('statewide')}
          >
            {/* <span className="tab-icon"><RiRoadMapFill color='#A2653E'/></span> */}
            <span className="tab-text">Statewide Overview</span>
          </button>
          <button 
            className={`tab ${activeTab === 'rankings' ? 'active' : ''}`}
            onClick={() => handleTabChange('rankings')}
          >
            {/* <span className="tab-icon"><FaTrophy color='#D6AF36'/></span> */}
            <span className="tab-text">Top Counties</span>
          </button>
        </div>

        <div className="modal-content">
          {error && (
            <div className="error-banner">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {/* County Tab */}
          {activeTab === 'county' && (
            <div className="county-tab">
              <div className="county-search-section">
              <h1 style={{color: "#2a7c2e", textAlign: "center"}}><FaSearch style={{color: "#91b8db" }} size={17}/> Search for a County</h1>
                <form onSubmit={handleSearchCounty} className="search-form">
                  <div className="search-input-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      placeholder="Search county (e.g., Harris, Dallas, Travis)"
                      value={searchCounty}
                      onChange={(e) => setSearchCounty(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  <button type="submit" className="search-btn">
                    Search
                  </button>
                </form>
              </div>

              {selectedCounty && (
                <div className="selected-indicator">
                  <span className="indicator-icon"><MdLocationPin color='#FF0000'/></span>
                  <span>Currently viewing: <strong>{selectedCounty} County</strong></span>
                </div>
              )}

              {skeletonLoading && <SkeletonLoader type="county" />}

              {carbonData && !skeletonLoading && (
                <div className="carbon-results">
                  <div className="county-header-card">
                    <div className="county-title-section">
                      <h3>{carbonData.county_name} County</h3>
                      <span className="fips-badge">FIPS: {carbonData.county_fips}</span>
                    </div>
                    {carbonEstimationService.isDefaultEstimate(carbonData) && (
                      <div className="default-warning">
                        <span className="warning-icon">⚠️</span>
                        <div className="warning-text">
                          <strong>Default Estimate:</strong> No biomass data available. Values based on Texas averages.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="metrics-grid">
                    <div className="metric-card primary">
                      <div className="metric-header">
                        <span className="metric-icon"><FaEarthAsia color='#88D9C0'/></span>
                        <span className="metric-label">Total Carbon Stock</span>
                      </div>
                      <div className="metric-value">
                        {carbonEstimationService.formatCarbonValue(carbonData.total_carbon_tons)}
                      </div>
                      <div className="metric-description">Stored carbon across all sources</div>
                    </div>

                    <div className="metric-card secondary">
                      <div className="metric-header">
                        <span className="metric-icon"><WiSmoke color="white"/></span>
                        <span className="metric-label">CO₂ Equivalent</span>
                      </div>
                      <div className="metric-value">
                        {carbonEstimationService.formatCO2Value(carbonData.total_co2_equivalent_tons)}
                      </div>
                      <div className="metric-description">Total greenhouse gas impact</div>
                    </div>

                    <div className="metric-card accent-1">
                      <div className="metric-header">
                        <span className="metric-icon"><FaTree style={{color: "#2d5016"}}/></span>
                        <span className="metric-label">Biomass Carbon</span>
                      </div>
                      <div className="metric-value">
                        {carbonEstimationService.formatCarbonValue(carbonData.biomass_carbon_tons)}
                      </div>
                      <div className="metric-description">From vegetation & trees</div>
                    </div>

                    <div className="metric-card accent-2">
                      <div className="metric-header">
                        <span className="metric-icon"><PiPlantBold color='#358856'/></span>
                        <span className="metric-label">Soil Carbon</span>
                      </div>
                      <div className="metric-value">
                        {carbonEstimationService.formatCarbonValue(carbonData.soil_carbon_potential_tons)}
                      </div>
                      <div className="metric-description">Sequestered in soil</div>
                    </div>
                  </div>

                  <div className="breakdown-section">
                  <h4
                  className="section-title"
                  style={{
                    fontSize: '2.5rem',
                    background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
                    WebkitBackgroundClip: 'text',   // vendor prefixed
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent', // hides the fill so background shows through
                    color: 'transparent'
                  }}
                >
                  Detailed Breakdown
                </h4>
                    <div className="breakdown-grid">
                      <div className="breakdown-item">
                        <span className="breakdown-label">Wood Biomass</span>
                        <span className="breakdown-value">
                          {carbonEstimationService.formatCarbonValue(carbonData.wood_biomass_tons)}
                        </span>
                      </div>
                      <div className="breakdown-item">
                        <span className="breakdown-label">Crop Residue</span>
                        <span className="breakdown-value">
                          {carbonEstimationService.formatCarbonValue(carbonData.crop_residue_tons)}
                        </span>
                      </div>
                      <div className="breakdown-item">
                        <span className="breakdown-label">Wetland Carbon/Year</span>
                        <span className="breakdown-value">
                          {carbonEstimationService.formatCarbonValue(carbonData.wetland_carbon_potential_tons)}
                        </span>
                      </div>
                      {carbonData.wetland_acres > 0 && (
                        <div className="breakdown-item">
                          <span className="breakdown-label">Wetland Area</span>
                          <span className="breakdown-value">{carbonData.wetland_acres.toFixed(1)} acres</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="calculation-timestamp">
                    <span className="timestamp-icon">🕐</span>
                    <span>Calculated: {new Date(carbonData.calculation_timestamp).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Statewide Tab */}
          {activeTab === 'statewide' && (
            <div className="statewide-tab">
              {skeletonLoading && <SkeletonLoader type="statewide" />}
              
              {statewideData && !skeletonLoading && (
                <div className="statewide-results">
                  <div className="statewide-header">
                    <h3>Texas Statewide Carbon Assessment</h3>
                    <p className="statewide-description">
                      Comprehensive analysis across all {statewideData.total_counties} Texas counties
                    </p>
                  </div>
                  
                  <div className="summary-grid">
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

                  <div className="top-preview-section">
                    <h4 className="section-title">Top 5 Carbon-Rich Counties</h4>
                    <div className="preview-grid">
                      {statewideData.top_carbon_counties.slice(0, 5).map((county, index) => (
                        <div 
                          key={county.county_name} 
                          className="preview-card"
                          onClick={() => handleCountyClick(county.county_name)}
                        >
                          <div className="preview-rank">#{index + 1}</div>
                          <div className="preview-info">
                            <div className="preview-name">{county.county_name}</div>
                            <div className="preview-carbon">
                              {carbonEstimationService.formatCarbonValue(county.total_carbon_tons)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rankings Tab */}
          {activeTab === 'rankings' && (
            <div className="rankings-tab">
              {skeletonLoading && <SkeletonLoader type="rankings" />}
              
              {topCounties.length > 0 && !skeletonLoading && (
                <div className="rankings-results">
                  <div className="rankings-header">
                    <h3>Top 15 Carbon-Rich Counties</h3>
                    <p className="rankings-description">
                      Counties ranked by total carbon stock potential
                    </p>
                  </div>
                  <div className="rankings-grid">
                    {topCounties.map((county, index) => {
                      const category = carbonEstimationService.getCarbonCategory(county.total_carbon_tons);
                      return (
                        <div 
                          key={county.county_name}
                          className="ranking-card"
                          onClick={() => handleCountyClick(county.county_name)}
                          style={{ 
                            borderLeft: `4px solid ${category.color}`,
                            animationDelay: `${index * 50}ms`
                          }}
                        >
                          <div className="ranking-position">
                            <div className="position-badge">#{index + 1}</div>
                            <div className="category-badge" style={{ backgroundColor: category.color }}>
                              {category.label}
                            </div>
                          </div>
                          <div className="ranking-info">
                            <div className="ranking-name">{county.county_name} County</div>
                            <div className="ranking-metrics">
                              <div className="ranking-carbon">
                                <span className="metric-icon-small">🌲</span>
                                {carbonEstimationService.formatCarbonValue(county.total_carbon_tons)}
                              </div>
                              <div className="ranking-co2">
                                <span className="metric-icon-small">💨</span>
                                {carbonEstimationService.formatCO2Value(county.total_co2_equivalent_tons)}
                              </div>
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

        <div className="modal-footer">
          <div className="footer-info">
            <span className="footer-icon">🔬</span>
            <span style={{color: "#E77D22"}}>Based on IPCC/FAO standards | Data cached for optimal performance</span>
          </div>
        </div>
      </div>
    </>
  );
};

// Skeleton Loader Component
const SkeletonLoader = ({ type }) => {
  if (type === 'county') {
    return (
      <div className="skeleton-container">
        <div className="skeleton skeleton-header"></div>
        <div className="skeleton-metrics">
          <div className="skeleton skeleton-card"></div>
          <div className="skeleton skeleton-card"></div>
          <div className="skeleton skeleton-card"></div>
          <div className="skeleton skeleton-card"></div>
        </div>
        <div className="skeleton skeleton-breakdown"></div>
      </div>
    );
  }
  
  if (type === 'statewide') {
    return (
      <div className="skeleton-container">
        <div className="skeleton skeleton-header"></div>
        <div className="skeleton-metrics">
          <div className="skeleton skeleton-card"></div>
          <div className="skeleton skeleton-card"></div>
          <div className="skeleton skeleton-card"></div>
          <div className="skeleton skeleton-card"></div>
        </div>
      </div>
    );
  }
  
  if (type === 'rankings') {
    return (
      <div className="skeleton-container">
        <div className="skeleton skeleton-header"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton skeleton-ranking-item"></div>
        ))}
      </div>
    );
  }
  
  return null;
};

export default CarbonEstimationPanel;
