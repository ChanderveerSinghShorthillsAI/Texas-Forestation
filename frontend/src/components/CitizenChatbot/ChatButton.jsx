import React, { useState } from "react";
import { FaComments, FaLeaf } from "react-icons/fa";
import TexasCitizenChatbot from "./TexasCitizenChatbot";
import "./ChatButton.css";

export default function ChatButton() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const handleOpenChat = () => {
    setIsChatOpen(true);
  };

  const handleCloseChat = () => {
    setIsChatOpen(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <>
      {/* Floating Chat Button */}
      <div className="chat-button-container">
        <button
          className="floating-chat-btn"
          onClick={handleOpenChat}
          title="Ask TexasForestGuide"
          aria-label="Open Texas forestry chatbot"
        >
          <FaLeaf className="chat-icon" />
          <span className="chat-tooltip">
            Ask about Texas forestry & agriculture
          </span>
        </button>
      </div>

      {/* Chat Modal */}
      <TexasCitizenChatbot 
        isOpen={isChatOpen} 
        onClose={handleCloseChat} 
      />
    </>
  );
} 