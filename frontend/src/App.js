import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import TexasMap from './components/Map/TexasMap';
import LoginPage from './components/login/LoginPage';
import CitizenChatbotPage from './components/CitizenChatbot/CitizenChatbotPage';
import WildfirePredictionPage from './components/Wildfire/WildfirePredictionPage';
import FullTexasWildfirePrediction from './components/Wildfire/FullTexasWildfirePrediction';
import USGSWildfirePrediction from './components/Wildfire/USGSWildfirePrediction';
import GridFireDashboard from './components/GridFire/GridFireDashboard';
import GridFireMap from './components/GridFire/GridFireMap';
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
    
    // Navigate to the main app or where they were trying to go
    const from = location.state?.from?.pathname || '/texas-forestation-planner';
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

  // If already authenticated, redirect to main app
  if (isAuthenticated) {
    return <Navigate to="/texas-forestation-planner" replace />;
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
    <Navigate to="/texas-forestation-planner" replace /> : 
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
