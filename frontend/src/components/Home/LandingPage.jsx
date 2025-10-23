import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FaFire, 
  FaSatellite, 
  FaTree, 
  FaMapMarkedAlt, 
  FaChartLine,
  FaShieldAlt,
  FaLeaf,
  FaBurn,
  FaGlobeAmericas,
  FaArrowRight,
  FaUser,
  FaSignOutAlt
} from 'react-icons/fa';
import { 
  IoAnalyticsSharp, 
  IoEarthSharp 
} from 'react-icons/io5';
import './LandingPage.css';
import { useTourGuide } from '../Tour/TourGuideWrapper';
import TourGuideButton from '../Tour/TourGuideButton';
import { landingPageTourSteps, defaultTourOptions } from '../Tour/TourGuideConfig';

const LandingPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // Refs for scroll animations
  const sectionsRef = useRef([]);
  
  // Initialize tour guide
  const { startTour } = useTourGuide(
    landingPageTourSteps,
    defaultTourOptions,
    'landing-tour',
    false // Don't auto-start
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.15 // Trigger when 15% of the section is visible
    };

    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('section-visible');
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Observe all sections
    sectionsRef.current.forEach((section) => {
      if (section) {
        observer.observe(section);
      }
    });

    // Cleanup
    return () => {
      sectionsRef.current.forEach((section) => {
        if (section) {
          observer.unobserve(section);
        }
      });
    };
  }, []);

  const features = [
    {
      id: 1,
      title: 'USGS Wildfire Forecast',
      description: 'Advanced wildfire prediction and forecasting system powered by USGS data. Monitor potential fire risks and get real-time alerts for proactive forest management.',
      icon: <FaFire />,
      gradient: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',
      path: '/usgs-wildfire-prediction',
      color: '#FF6B6B',
      features: ['Real-time predictions', 'Risk assessment', 'Alert system', 'Historical data analysis']
    },
    {
      id: 2,
      title: 'Fire Tracking',
      description: 'Comprehensive fire tracking and monitoring system. Track active fires across Texas with real-time updates, historical data, and detailed analytics.',
      icon: <FaBurn />,
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #DC2626 100%)',
      path: '/fire-tracking',
      color: '#F59E0B',
      features: ['Active fire monitoring', 'Historical tracking', 'Geospatial analysis', 'Incident reports']
    },
    {
      id: 3,
      title: 'Satellite Comparison',
      description: 'Compare satellite imagery across different time periods. Analyze forest changes, detect deforestation, and monitor ecosystem health with high-resolution imagery.',
      icon: <FaSatellite />,
      gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
      path: '/satellite-comparison',
      color: '#8B5CF6',
      features: ['Temporal comparison', 'NDVI analysis', 'Change detection', 'Multi-spectral imaging']
    },
    {
      id: 4,
      title: 'Encroachment Tracking',
      description: 'Monitor and track forest encroachment activities. Identify illegal deforestation, unauthorized construction, and protect forest boundaries with AI-powered detection.',
      icon: <FaShieldAlt />,
      gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      path: '/encroachment-tracking',
      color: '#10B981',
      features: ['AI-powered detection', 'Boundary monitoring', 'Alert notifications', 'Geographic distribution']
    },
    {
      id: 5,
      title: 'Texas Forestation Planner',
      description: 'Strategic forestation planning tool for Texas. Plan afforestation projects, analyze carbon sequestration potential, and optimize forest management strategies.',
      icon: <FaTree />,
      gradient: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
      path: '/texas-forestation-planner',
      color: '#14B8A6',
      features: ['Carbon estimation', 'Site suitability', 'Species selection', 'Impact assessment']
    }
  ];

  const capabilities = [
    {
      icon: <FaSatellite />,
      title: 'Satellite Intelligence',
      description: 'Advanced multi-spectral imagery analysis with real-time data processing from multiple satellite sources',
      color: '#3B82F6',
      gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
    },
    {
      icon: <FaShieldAlt />,
      title: 'Proactive Protection',
      description: 'AI-driven threat detection and automated alert systems for comprehensive forest security',
      color: '#10B981',
      gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
    },
    {
      icon: <IoAnalyticsSharp />,
      title: 'Predictive Analytics',
      description: 'Machine learning models for wildfire forecasting, encroachment detection, and ecosystem monitoring',
      color: '#F59E0B',
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
    },
    {
      icon: <FaGlobeAmericas />,
      title: 'Comprehensive Coverage',
      description: 'Statewide monitoring across all Texas forest ecosystems with continuous data integration',
      color: '#8B5CF6',
      gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)'
    }
  ];

  return (
    <div className="landing-page">
      {/* Tour Guide Button */}
      <TourGuideButton 
        onClick={startTour}
        position="bottom-right"
        tooltip="Start Guided Tour 🎯"
      />
      
      {/* Video Background */}
      <div className="video-background">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="background-video"
        >
          <source
            src="https://res.cloudinary.com/deve4tz0m/video/upload/v1759915950/forest-background-video_n8kauj.mp4"
            type="video/mp4"
          />
        </video>
        <div className="video-overlay"></div>
      </div>

      {/* Navigation Bar */}
      <nav className="landing-nav">
        <div className="nav-content">
          <div className="nav-logo">
            <FaLeaf className="logo-icon" />
            <div style={{display: "flex", flexDirection: "column"}}>
            <span className="logo-text">Texas Vanrakshak</span>
            <span style={{color: "white", fontSize: "12px", textAlign: "end" , fontWeight: "400"}}>Powered By Shorthills AI</span>
            </div>
          </div>
          <div className="nav-links">
            <button className="nav-link" onClick={() => navigate('/encroachment-tracking')}>
              <FaShieldAlt />
              <span>Encroachment</span>
            </button>
            <button className="nav-link" onClick={() => navigate('/usgs-wildfire-prediction')}>
              <FaFire />
              <span>USGS Wildfire</span>
            </button>
            <button className="nav-link" onClick={() => navigate('/fire-tracking')}>
              <FaBurn />
              <span>Fire Tracking</span>
            </button>
            <button className="nav-link" onClick={() => navigate('/satellite-comparison')}>
              <FaSatellite />
              <span>Satellite</span>
            </button>
            <button className="nav-link" onClick={() => navigate('/texas-forestation-planner')}>
              <FaTree />
              <span>Planner</span>
            </button>
          </div>
          <div className="nav-user">
            <FaUser className="user-icon" />
            <span className="user-name">{user?.username}</span>
            <button onClick={handleLogout} className="logout-btn">
              <FaSignOutAlt />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <IoEarthSharp />
            <span>Advanced Forest Management Platform</span>
          </div>
          <h1 className="hero-title">
            Protecting Texas Forests with
            <span className="hero-gradient"> AI-Powered Intelligence</span>
          </h1>
          <p className="hero-description">
            A comprehensive forest management and monitoring system leveraging satellite imagery,
            AI-driven analytics, and real-time data to safeguard Texas's natural resources.
          </p>
          <div className="hero-buttons">
            <button className="hero-btn primary" onClick={() => {
              document.getElementById('features-section').scrollIntoView({ behavior: 'smooth' });
            }}>
              <span>Explore Features</span>
              <FaArrowRight />
            </button>
            <button className="hero-btn secondary" onClick={() => navigate('/texas-forestation-planner')}>
              <FaMapMarkedAlt />
              <span>Start Planning</span>
            </button>
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section className="capabilities-section scroll-section" ref={(el) => sectionsRef.current[0] = el}>
        <div className="capabilities-container">
          {capabilities.map((capability, index) => (
            <div key={index} className="capability-card">
              <div className="capability-icon-wrapper" style={{ background: capability.gradient }}>
                <div className="capability-icon">
                  {capability.icon}
                </div>
              </div>
              <h3 className="capability-title">{capability.title}</h3>
              <p className="capability-description">{capability.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section className="about-section scroll-section" ref={(el) => sectionsRef.current[1] = el}>
        <div className="about-content">
          <div className="about-header">
            <h2 className="section-title">About Texas Vanrakshak</h2>
            <div className="title-underline"></div>
          </div>
          <div className="about-grid">
            <div className="about-text">
              <p className="about-description">
                Texas Vanrakshak is a cutting-edge forest management platform designed to protect and preserve
                Texas's vast forest ecosystems. Combining satellite technology, machine learning, and real-time
                data analytics, we provide comprehensive tools for forest monitoring, fire prediction, and
                conservation planning.
              </p>
              <p className="about-description">
                Our platform empowers forest managers, conservationists, and government agencies with actionable
                insights to make data-driven decisions. From predicting wildfire risks to tracking illegal
                encroachment, Texas Vanrakshak is your complete solution for sustainable forest management.
              </p>
              <div className="about-highlights">
                <div className="highlight-item">
                  <div className="highlight-icon">
                    <FaSatellite />
                  </div>
                  <div className="highlight-text">
                    <h4>Satellite Monitoring</h4>
                    <p>High-resolution imagery analysis</p>
                  </div>
                </div>
                <div className="highlight-item">
                  <div className="highlight-icon">
                    <IoAnalyticsSharp />
                  </div>
                  <div className="highlight-text">
                    <h4>AI-Powered Analytics</h4>
                    <p>Machine learning predictions</p>
                  </div>
                </div>
                <div className="highlight-item">
                  <div className="highlight-icon">
                    <FaChartLine />
                  </div>
                  <div className="highlight-text">
                    <h4>Real-Time Data</h4>
                    <p>Live monitoring and alerts</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features-section" className="features-section scroll-section" ref={(el) => sectionsRef.current[2] = el}>
        <div className="features-content">
          <div className="features-header">
            <h2 className="section-title">Powerful Features</h2>
            <div className="title-underline"></div>
            <p className="section-subtitle">
              Comprehensive tools for forest management, monitoring, and conservation
            </p>
          </div>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div
                key={feature.id}
                className="feature-card"
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => navigate(feature.path)}
              >
                <div className="feature-card-inner">
                  <div className="feature-icon-wrapper" style={{ background: feature.gradient }}>
                    {feature.icon}
                  </div>
                  <h3 className="feature-title">{feature.title}</h3>
                  <p className="feature-description">{feature.description}</p>
                  <ul className="feature-list">
                    {feature.features.map((item, idx) => (
                      <li key={idx} className="feature-list-item">
                        <FaArrowRight style={{ color: feature.color }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <button className="feature-btn" style={{ background: feature.gradient }}>
                    <span>Explore Feature</span>
                    <FaArrowRight />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Stack Section */}
      <section className="technology-section scroll-section" ref={(el) => sectionsRef.current[3] = el}>
        <div className="technology-content">
          <div className="technology-header">
            <h2 className="section-title">Powered by Advanced Technology</h2>
            <div className="title-underline"></div>
          </div>
          <div className="technology-grid">
            <div className="tech-card">
              <div className="tech-icon">
                <FaSatellite />
              </div>
              <h4>Satellite Data</h4>
              <p>Sentinel-2, Landsat, MODIS</p>
            </div>
            <div className="tech-card">
              <div className="tech-icon">
                <IoAnalyticsSharp />
              </div>
              <h4>Machine Learning</h4>
              <p>TensorFlow, PyTorch, scikit-learn</p>
            </div>
            <div className="tech-card">
              <div className="tech-icon">
                <FaMapMarkedAlt />
              </div>
              <h4>Geospatial Analysis</h4>
              <p>GIS, Remote Sensing, GDAL</p>
            </div>
            <div className="tech-card">
              <div className="tech-icon">
                <FaChartLine />
              </div>
              <h4>Real-Time Processing</h4>
              <p>Stream analytics, Cloud computing</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="cta-section scroll-section" ref={(el) => sectionsRef.current[4] = el}>
        <div className="cta-content">
          <h2 className="cta-title">Ready to Get Started?</h2>
          <p className="cta-description">
            Begin your journey in advanced forest management and conservation
          </p>
          <button className="cta-button" onClick={() => navigate('/texas-forestation-planner')}>
            <FaMapMarkedAlt />
            <span>Launch Platform</span>
            <FaArrowRight />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <FaLeaf className="footer-logo-icon" />
            <div style={{display: "flex", flexDirection: "column"}}>
            <span className="logo-text">Texas Vanrakshak</span>
            <span style={{color: "white", fontSize: "12px", textAlign: "end" , fontWeight: "400"}}>Powered By Shorthills AI</span>
            </div>
          </div>
          <p className="footer-text">
            Protecting Texas forests through technology and innovation
          </p>
          <p className="footer-copyright">
            &copy; {new Date().getFullYear()} Texas Vanrakshak. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

