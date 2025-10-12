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
  // Start with chat open since this is a dedicated chatbot page
  const [isChatOpen] = useState(true);

  // Navigate back to login - useCallback to prevent re-renders
  const handleBackToLogin = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  return (
    <div className="chatbot-page">
      {/* Beautiful animated background with image overlay */}
      <div 
        className="chatbot-background"
        style={{
          backgroundImage: `
            linear-gradient(
              135deg,
              rgba(26, 60, 35, 0.55) 0%,
              rgba(45, 80, 22, 0.5) 25%,
              rgba(62, 107, 31, 0.45) 50%,
              rgba(45, 80, 22, 0.5) 75%,
              rgba(26, 60, 35, 0.55) 100%
            ),
            url(${process.env.PUBLIC_URL}/login/loginBgImage.png)
          `,
          backgroundSize: '400% 400%, cover',
          backgroundPosition: '0% 50%, center center'
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