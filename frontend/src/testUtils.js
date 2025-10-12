/**
 * Test Utilities for Frontend Testing
 * 
 * Provides custom render functions, mocks, and helpers for testing React components
 */

import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

/**
 * Custom render function that includes all providers
 * @param {React.Component} ui - Component to render
 * @param {Object} options - Render options
 * @returns {Object} - Render result with additional utilities
 */
export function render(ui, { route = '/', ...renderOptions } = {}) {
  // Set initial route
  window.history.pushState({}, 'Test page', route);

  function Wrapper({ children }) {
    return (
      <BrowserRouter>
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Mock GeoJSON data for testing
 */
export const mockGeoJson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-95.0, 29.5],
          [-95.0, 30.5],
          [-94.0, 30.5],
          [-94.0, 29.5],
          [-95.0, 29.5]
        ]]
      },
      properties: {
        name: 'Test County',
        county: 'Harris',
        population: 4713325
      }
    }
  ]
};

/**
 * Mock carbon data for testing
 */
export const mockCarbonData = {
  county_name: 'Harris',
  county_fips: '48201',
  total_carbon_tons: 24567890.5,
  total_co2_equivalent_tons: 90123456.7,
  wood_biomass_tons: 15000000.0,
  crop_biomass_tons: 5000000.0,
  wetland_carbon_tons: 4567890.5,
  last_updated: '2024-01-15T12:00:00Z',
  cached: true
};

/**
 * Mock fire data for testing
 */
export const mockFireData = [
  {
    latitude: 29.7604,
    longitude: -95.3698,
    confidence: 85.5,
    brightness: 325.0,
    scan_time: '2024-01-15T12:00:00Z',
    satellite: 'VIIRS_NOAA20',
    frp: 15.5
  },
  {
    latitude: 30.2672,
    longitude: -97.7431,
    confidence: 92.3,
    brightness: 340.5,
    scan_time: '2024-01-15T13:00:00Z',
    satellite: 'VIIRS_NOAA20',
    frp: 22.1
  }
];

/**
 * Mock user data for testing
 */
export const mockUser = {
  user_id: 'test_user_123',
  username: 'testuser',
  email: 'test@example.com',
  isAuthenticated: true
};

/**
 * Mock authentication token
 */
export const mockAuthToken = 'mock_jwt_token_12345';

/**
 * Mock fetch responses
 */
export const mockFetch = {
  success: (data) => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data }),
    text: async () => JSON.stringify({ success: true, data })
  }),
  error: (message = 'Error', status = 500) => ({
    ok: false,
    status,
    json: async () => ({ success: false, error: message }),
    text: async () => JSON.stringify({ success: false, error: message })
  })
};

/**
 * Mock localStorage
 */
export const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; }
  };
})();

/**
 * Mock Mapbox GL
 */
export const mockMapboxGL = {
  Map: jest.fn(() => ({
    on: jest.fn(),
    remove: jest.fn(),
    addSource: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    removeSource: jest.fn(),
    getSource: jest.fn(),
    setLayoutProperty: jest.fn(),
    setPaintProperty: jest.fn(),
    flyTo: jest.fn(),
    fitBounds: jest.fn()
  })),
  Marker: jest.fn(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    remove: jest.fn()
  })),
  Popup: jest.fn(() => ({
    setHTML: jest.fn().mockReturnThis(),
    setLngLat: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    remove: jest.fn()
  }))
};

/**
 * Wait for async operations
 */
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Create mock service
 */
export const createMockService = (methods = {}) => {
  const defaultMethods = {
    fetch: jest.fn(() => Promise.resolve({})),
    get: jest.fn(() => Promise.resolve({})),
    post: jest.fn(() => Promise.resolve({})),
    put: jest.fn(() => Promise.resolve({})),
    delete: jest.fn(() => Promise.resolve({}))
  };
  return { ...defaultMethods, ...methods };
};

/**
 * Mock performance.now() for testing
 */
export const mockPerformance = {
  now: jest.fn(() => Date.now())
};

/**
 * Test IDs for consistent querying
 */
export const TEST_IDS = {
  MAP: 'texas-map',
  CARBON_PANEL: 'carbon-panel',
  CARBON_BUTTON: 'carbon-button',
  FIRE_MAP: 'fire-map',
  FIRE_PANEL: 'fire-panel',
  LAYER_SELECTOR: 'layer-selector',
  SEARCH_BAR: 'search-bar',
  USER_MENU: 'user-menu',
  LOADING_SPINNER: 'loading-spinner'
};

/**
 * Mock window.matchMedia
 */
export const mockMatchMedia = (matches = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    }))
  });
};

/**
 * Custom matchers
 */
export const customMatchers = {
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`
    };
  },
  toHaveValidGeoJson(received) {
    const pass = 
      received &&
      received.type === 'FeatureCollection' &&
      Array.isArray(received.features);
    return {
      pass,
      message: () =>
        pass
          ? 'expected GeoJSON to be invalid'
          : 'expected valid GeoJSON FeatureCollection'
    };
  }
};

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

