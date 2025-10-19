import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NotFound.css';
import { FaHome, FaLeaf, FaTree } from 'react-icons/fa';

const NotFound = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="notfound-container">
      {/* Animated background forest */}
      <div className="forest-background">
        <div className="mountain-layer"></div>
        <div className="trees-layer">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="tree-silhouette"
              style={{
                left: `${(i * 7) + (i % 3) * 3}%`,
                animationDelay: `${i * 0.2}s`,
                height: `${60 + (i % 4) * 15}px`,
              }}
            >
              <FaTree />
            </div>
          ))}
        </div>
        <div className="fog-layer"></div>
        <div className="fog-layer fog-layer-2"></div>
      </div>

      {/* Floating leaves */}
      <div className="floating-leaves">
        {[...Array(100)].map((_, i) => (
          <div
            key={i}
            className="leaf"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${20 + Math.random() * 10}s`,
            }}
          >
            <FaLeaf />
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="notfound-content">
        <div className="error-code">
          <span className="digit">4</span>
          <span className="digit tree-zero">
            <FaTree className="tree-icon" />
          </span>
          <span className="digit">4</span>
        </div>

        <h1 className="error-title">Lost in the Forest?</h1>
        <p className="error-description">
          Oops! The path you're looking for seems to have been overgrown by nature.
          <br />
          This page doesn't exist in the Texas Forestation system.
        </p>

        <div className="error-actions">
          <button className="btn-home" onClick={handleGoHome}>
            <FaHome />
            <span>Return Home</span>
          </button>
          <button className="btn-back" onClick={handleGoBack}>
            <span>Go Back</span>
          </button>
        </div>

        {/* Helpful links */}
        <div className="helpful-links">
          <p className="links-title">Popular destinations:</p>
          <div className="links-grid">
            <a href="/home" className="link-item">
              <FaTree />
              <span>Home</span>
            </a>
            <a href="/citizen-chatbot" className="link-item">
              <FaLeaf />
              <span>Chatbot</span>
            </a>
            <a href="/login" className="link-item">
              <FaLeaf />
              <span>Login</span>
            </a>
          </div>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="ground-layer">
        <div className="grass"></div>
      </div>
    </div>
  );
};

export default NotFound;

