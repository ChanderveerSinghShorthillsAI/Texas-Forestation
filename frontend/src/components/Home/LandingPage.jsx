import React from 'react';
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

const LandingPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

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

  const statistics = [
    {
      icon: <FaGlobeAmericas />,
      value: '268,596',
      label: 'Square Miles Monitored',
      color: '#3B82F6'
    },
    {
      icon: <FaTree />,
      value: '50M+',
      label: 'Trees Analyzed',
      color: '#10B981'
    },
    {
      icon: <FaFire />,
      value: '99.2%',
      label: 'Fire Detection Accuracy',
      color: '#F59E0B'
    },
    {
      icon: <IoAnalyticsSharp />,
      value: '24/7',
      label: 'Real-time Monitoring',
      color: '#8B5CF6'
    }
  ];

  return (
    <div className="landing-page">
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
            <span className="logo-text">Texas Vanrakshak</span>
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

      {/* Statistics Section */}
      <section className="statistics-section">
        <div className="statistics-container">
          {statistics.map((stat, index) => (
            <div key={index} className="stat-card" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="stat-icon" style={{ color: stat.color }}>
                {stat.icon}
              </div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section className="about-section">
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
      <section id="features-section" className="features-section">
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
      <section className="technology-section">
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
      <section className="cta-section">
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
            <span>Texas Vanrakshak</span>
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

