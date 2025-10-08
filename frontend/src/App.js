import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import TexasMap from './components/Map/TexasMap';
import LoginPage from './components/login/LoginPage';
import LandingPage from './components/Home/LandingPage';
import CitizenChatbotPage from './components/CitizenChatbot/CitizenChatbotPage';
import WildfirePredictionPage from './components/Wildfire/WildfirePredictionPage';
import FullTexasWildfirePrediction from './components/Wildfire/FullTexasWildfirePrediction';
import USGSWildfirePrediction from './components/Wildfire/USGSWildfirePrediction';
import GridFireDashboard from './components/GridFire/GridFireDashboard';
import GridFireMap from './components/GridFire/GridFireMap';
import EncroachmentTrackingPage from './components/Encroachment/EncroachmentTrackingPage';
import TemporalComparisonPage from './components/SatelliteComparison/TemporalComparisonPage';
import FireTrackingPage from './components/FireTracking/FireTrackingPage';
import './App.css';

/**
 * Protected Route Component
 * Redirects to login if not authenticated
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h2>Texas Forestation</h2>
          <p>Loading your spatial analysis platform...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login but remember where they were trying to go
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * Login Route Component
 * Redirects to main app if already authenticated
 */
const LoginRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Handle successful login
   */
  const handleLoginSuccess = (authData) => {
    console.log('🎉 Login successful, user authenticated:', authData.user.username);
    
    // Navigate to the home page or where they were trying to go
    const from = location.state?.from?.pathname || '/home';
    navigate(from, { replace: true });
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h2>Texas Forestation</h2>
          <p>Loading your spatial analysis platform...</p>
        </div>
      </div>
    );
  }

  // If already authenticated, redirect to home page
  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
};

/**
 * Main Application Component
 * The protected content that shows after authentication
 */
const MainAppContent = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  /**
   * Handle logout and redirect to login
   */
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="App">
      <TexasMap />
      
      {/* Feature Navigation Buttons - positioned in top-left corner */}
      <div style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        zIndex: 1500,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <button
          onClick={() => navigate('/encroachment-tracking')}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '25px',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255, 255, 255, 0.2)'
          }}
          title="Track forest encroachment alerts across Texas"
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-3px)';
            e.target.style.boxShadow = '0 6px 25px rgba(102, 126, 234, 0.6)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.4)';
          }}
        >
          🌲 Encroachment Tracking
        </button>
        
        <button
          onClick={() => navigate('/satellite-comparison')}
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: 'none',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '25px',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255, 255, 255, 0.2)'
          }}
          title="Compare satellite imagery across time"
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-3px)';
            e.target.style.boxShadow = '0 6px 25px rgba(245, 158, 11, 0.6)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 20px rgba(245, 158, 11, 0.4)';
          }}
        >
          🛰️ Satellite Comparison
        </button>
      </div>
      
      {/* Logout button - positioned in bottom-right corner */}
      <div style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: '500'
      }}>
        <span>👋 {user?.username}</span>
        <button
          onClick={handleLogout}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
          title="Logout"
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
};

/**
 * App Router Component
 * Handles all routing logic
 */
const AppRouter = () => {
  return (
    <Routes>
      {/* Login Route */}
      <Route path="/login" element={<LoginRoute />} />
      
      {/* Citizen Chatbot Route - Public Access */}
      <Route path="/citizen-chatbot" element={<CitizenChatbotPage />} />
      
      {/* Home/Landing Page - Protected */}
      <Route 
        path="/home" 
        element={
          <ProtectedRoute>
            <LandingPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Main Application Route - Protected */}
      <Route 
        path="/texas-forestation-planner" 
        element={
          <ProtectedRoute>
            <MainAppContent />
          </ProtectedRoute>
        } 
      />
      
      {/* Wildfire Prediction Route - Protected */}
      <Route 
        path="/wildfire-prediction" 
        element={
          <ProtectedRoute>
            <WildfirePredictionPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Full Texas Wildfire Prediction Route - Protected */}
      <Route 
        path="/full-texas-wildfire" 
        element={
          <ProtectedRoute>
            <FullTexasWildfirePrediction />
          </ProtectedRoute>
        } 
      />
      
      {/* USGS Wildfire Prediction Route - Protected */}
      <Route 
        path="/usgs-wildfire-prediction" 
        element={
          <ProtectedRoute>
            <USGSWildfirePrediction />
          </ProtectedRoute>
        } 
      />
      
      {/* Grid Fire Dashboard Route - Protected */}
      <Route 
        path="/grid-fire-dashboard" 
        element={
          <ProtectedRoute>
            <GridFireDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* Grid Fire Map Route - Protected */}
      <Route 
        path="/grid-fire-map" 
        element={
          <ProtectedRoute>
            <GridFireMap />
          </ProtectedRoute>
        } 
      />
      
      {/* Encroachment Tracking Route - Protected */}
      <Route 
        path="/encroachment-tracking" 
        element={
          <ProtectedRoute>
            <EncroachmentTrackingPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Satellite Comparison Route - Protected */}
      <Route 
        path="/satellite-comparison" 
        element={
          <ProtectedRoute>
            <TemporalComparisonPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Fire Tracking Route - Protected */}
      <Route 
        path="/fire-tracking" 
        element={
          <ProtectedRoute>
            <FireTrackingPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Root Route - Redirect based on authentication */}
      <Route path="/" element={<RootRedirect />} />
      
      {/* Catch all other routes and redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

/**
 * Root Redirect Component
 * Determines where to redirect users coming to "/"
 */
const RootRedirect = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h2>Texas Forestation</h2>
          <p>Loading your spatial analysis platform...</p>
        </div>
      </div>
    );
  }

  // Redirect based on authentication status
  return isAuthenticated ? 
    <Navigate to="/home" replace /> : 
    <Navigate to="/login" replace />;
};

/**
 * Root App Component with Router and Authentication Provider
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRouter />
      </Router>
    </AuthProvider>
  );
}

export default App;
