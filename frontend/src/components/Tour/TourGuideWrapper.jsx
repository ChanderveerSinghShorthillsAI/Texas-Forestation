/**
 * Tour Guide Wrapper Component
 * Provides a reusable tour guide implementation with beautiful styling
 */

import { useEffect, useRef, useCallback } from 'react';
import { TourGuideClient } from '@sjmc11/tourguidejs';
import '@sjmc11/tourguidejs/src/scss/tour.scss';
import './TourGuide.css';

/**
 * Custom hook to initialize and manage tour guide
 * @param {Array} steps - Tour steps configuration
 * @param {Object} options - Tour guide options
 * @param {string} tourGroup - Tour group identifier
 * @param {boolean} autoStart - Whether to start tour automatically
 */
export const useTourGuide = (steps, options, tourGroup = 'tour', autoStart = false) => {
  const tourRef = useRef(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Prevent double initialization
    if (isInitializedRef.current) return;

    // Only initialize if steps are available
    if (!steps || steps.length === 0) return;

    try {
      // Initialize tour guide
      const tourGuide = new TourGuideClient({
        ...options,
        steps: steps,
        group: tourGroup,
      });

      tourRef.current = tourGuide;
      isInitializedRef.current = true;

      // Auto-start if enabled and tour not completed
      if (autoStart && !tourGuide.isFinished) {
        setTimeout(() => {
          tourGuide.start();
        }, 1000);
      }

      // Cleanup on unmount
      return () => {
        if (tourRef.current) {
          try {
            tourRef.current.exit();
          } catch (error) {
            console.warn('Error cleaning up tour guide:', error);
          }
        }
      };
    } catch (error) {
      console.error('Error initializing tour guide:', error);
    }
  }, [steps, options, tourGroup, autoStart]);

  const startTour = useCallback(() => {
    if (tourRef.current) {
      tourRef.current.start();
    }
  }, []);

  const exitTour = useCallback(() => {
    if (tourRef.current) {
      tourRef.current.exit();
    }
  }, []);

  const nextStep = useCallback(() => {
    if (tourRef.current) {
      tourRef.current.nextStep();
    }
  }, []);

  const prevStep = useCallback(() => {
    if (tourRef.current) {
      tourRef.current.prevStep();
    }
  }, []);

  const visitStep = useCallback((stepIndex) => {
    if (tourRef.current) {
      tourRef.current.visitStep(stepIndex);
    }
  }, []);

  const resetTour = useCallback(() => {
    if (tourRef.current && tourGroup) {
      // Clear localStorage for this tour group
      localStorage.removeItem(`tg-${tourGroup}-finished`);
      localStorage.removeItem(`tg-${tourGroup}-step`);
      // Restart tour
      tourRef.current.start();
    }
  }, [tourGroup]);

  return {
    startTour,
    exitTour,
    nextStep,
    prevStep,
    visitStep,
    resetTour,
    tourGuide: tourRef.current,
  };
};

export default useTourGuide;

