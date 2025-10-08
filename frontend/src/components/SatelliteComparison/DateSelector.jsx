/**
 * Date Selector Component
 * Allows users to select two dates for comparison
 */

import React, { useState, useEffect } from 'react';
import { 
  FaCalendarAlt, 
  FaClock, 
  FaExclamationTriangle, 
  FaInfoCircle, 
  FaArrowLeft, 
  FaArrowRight 
} from 'react-icons/fa';
import satelliteComparisonService from '../../services/satelliteComparisonService';
import './DateSelector.css';

const DateSelector = ({ location, onDateSubmit, onBack }) => {
  const [date1, setDate1] = useState('');
  const [date2, setDate2] = useState('');
  const [errors, setErrors] = useState([]);
  const [daysBetween, setDaysBetween] = useState(0);

  // Set default dates (1 year ago and today)
  useEffect(() => {
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    setDate2(satelliteComparisonService.formatDate(today));
    setDate1(satelliteComparisonService.formatDate(oneYearAgo));
  }, []);

  // Calculate days between dates
  useEffect(() => {
    if (date1 && date2) {
      try {
        const days = satelliteComparisonService.daysBetween(date1, date2);
        setDaysBetween(days);
      } catch {
        setDaysBetween(0);
      }
    }
  }, [date1, date2]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors([]);

    if (!date1 || !date2) {
      setErrors(['Please select both dates']);
      return;
    }

    // Validate dates
    const validation = satelliteComparisonService.validateDateRange(date1, date2);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    // Submit dates
    onDateSubmit(date1, date2);
  };

  // Get min and max dates for input
  const minDate = '2016-01-01'; // Planet Labs data starts around 2016
  const maxDate = satelliteComparisonService.formatDate(new Date());

  return (
    <div className="date-selector">
      <form onSubmit={handleSubmit} className="date-form">
        
        {/* Date 1 Input */}
        <div className="date-input-group">
          <label htmlFor="date1" className="date-label">
            <FaCalendarAlt className="label-icon" />
            <span className="label-text">First Date (Before)</span>
          </label>
          <input
            type="date"
            id="date1"
            value={date1}
            onChange={(e) => setDate1(e.target.value)}
            min={minDate}
            max={maxDate}
            className="date-input"
            required
          />
          {date1 && (
            <div className="date-preview">
              {new Date(date1).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          )}
        </div>

        {/* Time arrow */}
        {date1 && date2 && (
          <div className="date-separator">
            <div className="separator-line"></div>
            <div className="separator-badge">
              <FaClock className="badge-icon" />
              <span className="badge-text">
                {daysBetween > 0 ? `${daysBetween} days` : 'Invalid range'}
              </span>
            </div>
            <div className="separator-line"></div>
          </div>
        )}

        {/* Date 2 Input */}
        <div className="date-input-group">
          <label htmlFor="date2" className="date-label">
            <FaCalendarAlt className="label-icon" />
            <span className="label-text">Second Date (After)</span>
          </label>
          <input
            type="date"
            id="date2"
            value={date2}
            onChange={(e) => setDate2(e.target.value)}
            min={minDate}
            max={maxDate}
            className="date-input"
            required
          />
          {date2 && (
            <div className="date-preview">
              {new Date(date2).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          )}
        </div>

        {/* Error messages */}
        {errors.length > 0 && (
          <div className="date-errors">
            {errors.map((error, index) => (
              <div key={index} className="error-item">
                <FaExclamationTriangle className="error-icon" />
                <span className="error-text">{error}</span>
              </div>
            ))}
          </div>
        )}

        {/* Info box */}
        <div className="date-info-box">
          <FaInfoCircle className="info-icon" />
          <div className="info-content">
            <h4>Date Selection Tips</h4>
            <ul>
              <li>Select dates at least a few months apart for visible changes</li>
              <li>Imagery is available from January 2016 onwards</li>
              <li>The system will find the closest available cloud-free images</li>
              <li>Images within ±7 days of your selected dates will be matched</li>
            </ul>
          </div>
        </div>

        {/* Action buttons */}
        <div className="date-actions">
          <button
            type="button"
            onClick={onBack}
            className="back-btn"
          >
            <FaArrowLeft /> Back
          </button>
          <button
            type="submit"
            className="submit-btn"
            disabled={!date1 || !date2 || daysBetween <= 0}
          >
            Compare Images <FaArrowRight />
          </button>
        </div>
      </form>

      {/* Quick date presets */}
      <div className="date-presets">
        <h4 className="presets-title">Quick Select:</h4>
        <div className="preset-buttons">
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              const threeMonthsAgo = new Date();
              threeMonthsAgo.setMonth(today.getMonth() - 3);
              setDate1(satelliteComparisonService.formatDate(threeMonthsAgo));
              setDate2(satelliteComparisonService.formatDate(today));
            }}
            className="preset-btn"
          >
            3 Months
          </button>
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              const sixMonthsAgo = new Date();
              sixMonthsAgo.setMonth(today.getMonth() - 6);
              setDate1(satelliteComparisonService.formatDate(sixMonthsAgo));
              setDate2(satelliteComparisonService.formatDate(today));
            }}
            className="preset-btn"
          >
            6 Months
          </button>
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              const oneYearAgo = new Date();
              oneYearAgo.setFullYear(today.getFullYear() - 1);
              setDate1(satelliteComparisonService.formatDate(oneYearAgo));
              setDate2(satelliteComparisonService.formatDate(today));
            }}
            className="preset-btn"
          >
            1 Year
          </button>
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              const twoYearsAgo = new Date();
              twoYearsAgo.setFullYear(today.getFullYear() - 2);
              setDate1(satelliteComparisonService.formatDate(twoYearsAgo));
              setDate2(satelliteComparisonService.formatDate(today));
            }}
            className="preset-btn"
          >
            2 Years
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateSelector;

