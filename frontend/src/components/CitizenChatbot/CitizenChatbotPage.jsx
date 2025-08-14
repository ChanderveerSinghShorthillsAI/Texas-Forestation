/**
 * Standalone Citizen Chatbot Page for Texas Forestation
 * 
 * Simple wrapper around the original TexasCitizenChatbot component
 * with login page background and navigation
 */

import React, { useCallback, useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft } from "react-icons/fa";
import TexasCitizenChatbot from "./TexasCitizenChatbot";
import "./CitizenChatbotPage.css";

export default function CitizenChatbotPage() {
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Open chat automatically when page loads (like the original ChatButton)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsChatOpen(true);
    }, 100); // Small delay to ensure proper mounting
    
    return () => clearTimeout(timer);
  }, []);

  // Navigate back to login - useCallback to prevent re-renders
  const handleBackToLogin = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  return (
    <div className="chatbot-page">
      {/* Background with same image as login */}
      <div 
        className="chatbot-background"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL}/login/loginBgImage.png)`
        }}
      >
        <div className="chatbot-overlay">
          {/* Back Button */}
          <button 
            className="back-button-floating"
            onClick={handleBackToLogin}
            title="Back to Login"
          >
            <FaArrowLeft />
            <span>Back to Login</span>
          </button>

          {/* Original Chatbot Component */}
          <TexasCitizenChatbot 
            isOpen={isChatOpen} 
            onClose={handleBackToLogin}
          />
        </div>
      </div>
    </div>
  );
} 