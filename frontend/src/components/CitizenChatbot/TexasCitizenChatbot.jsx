import React, { useState, useRef, useEffect, useCallback } from "react";
import "./TexasCitizenChatbot.css";
import { FaPaperPlane, FaUserShield, FaTimes, FaLeaf } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const REACT_APP_BASE_URL = process.env.REACT_APP_BASE_URL || "http://localhost:8000";
const WS_BASE_URL = process.env.REACT_APP_WS_BASE_URL || "ws://localhost:8000";
const WS_URL = `${WS_BASE_URL}/ws/citizen_chatbot/`;
const HISTORY_URL = `${REACT_APP_BASE_URL}/api/citizen_chatbot/history/`;
const CLEAR_CHAT_URL = `${REACT_APP_BASE_URL}/api/citizen_chatbot/clear/`;
const HTTP_CHAT_URL = `${REACT_APP_BASE_URL}/api/citizen_chatbot/chat/stream/`;

// Utility: Log and also display as needed
function log(msg, ...args) {
  console.log(`[TexasCitizenChatbot] ${msg}`, ...args);
}

export default function TexasCitizenChatbot({ isOpen, onClose }) {
  // Component mount/unmount debugging
  useEffect(() => {
    log("🎬 TexasCitizenChatbot component MOUNTED");
    return () => {
      log("💀 TexasCitizenChatbot component UNMOUNTED");
    };
  }, []);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [useWebSocket, setUseWebSocket] = useState(true);
  const ws = useRef(null);
  const streamingBuffer = useRef("");
  const abortControllerRef = useRef(null);

  // For autoscroll
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Update streaming message (both for WS and HTTP)
  const updateStreamingMessage = useCallback((content) => {
    streamingBuffer.current += content;
    setMessages((msgs) => {
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant") {
        return [...msgs.slice(0, -1), { ...last, text: streamingBuffer.current }];
      } else {
        return [...msgs, { role: "assistant", text: streamingBuffer.current }];
      }
    });
  }, []);

  // Fetch chat history on mount
  useEffect(() => {
    if (!isOpen) return;
    
    log("Fetching chat history...");
    fetch(HISTORY_URL, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    })
      .then((res) => res.json())
      .then((data) => {
        log("Fetched chat history:", data);
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          setMessages([{ 
            role: "assistant", 
            text: "Hello! I'm TexasForestGuide, your assistant for forestry, agriculture, and environmental topics in Texas. How can I help you today?" 
          }]);
        }
      })
      .catch((err) => {
        log("Failed to fetch chat history:", err);
        setMessages([{ 
          role: "assistant", 
          text: "Hello! I'm TexasForestGuide, your assistant for forestry, agriculture, and environmental topics in Texas. How can I help you today?" 
        }]);
      });
  }, [isOpen]);

  // WebSocket setup (and auto-fallback to HTTP if failed)
  useEffect(() => {
    if (!isOpen || !useWebSocket) {
      log("❌ WebSocket effect skipped - isOpen:", isOpen, "useWebSocket:", useWebSocket);
      return;
    }
    
    // Prevent creating multiple connections
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      log("⚡ WebSocket already connected, skipping...");
      return;
    }
    
    log("🔌 Attempting to connect WebSocket...", WS_URL);
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      log("✅ WebSocket connected successfully!");
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        log("WS message received:", data);
        
        if (data.type && data.content) {
          if (data.type === "text" || data.type === "citation" || data.type === "source" || data.type === "sources_header") {
            setIsTyping(false);
            setLoading(false);
            updateStreamingMessage(data.content);
          } else if (data.type === "typing") {
            setIsTyping(true);
            setLoading(false);
          }
        } else if (data.message || data.type === "message") {
          setIsTyping(false);
          streamingBuffer.current = "";
          const messageText = data.message || data.content;
          setMessages((msgs) => {
            // Do NOT add if same as last assistant message
            if (
              msgs.length > 0 &&
              msgs[msgs.length - 1].role === "assistant" &&
              msgs[msgs.length - 1].text === messageText
            ) {
              return msgs;
            }
            return [...msgs, { role: "assistant", text: messageText }];
          });
          setLoading(false);
        } else if (data.error) {
          setIsTyping(false);
          streamingBuffer.current = "";
          setMessages((msgs) => [
            ...msgs,
            { role: "assistant", text: `❌ Error: ${data.error}` },
          ]);
          setLoading(false);
        }
      } catch (e) {
        log("Parse error on WebSocket message:", e);
        setIsTyping(false);
        setMessages((msgs) => [
          ...msgs,
          { role: "assistant", text: `Parse error: ${e.message}` },
        ]);
        setLoading(false);
      }
    };

    ws.current.onerror = (error) => {
      log("WebSocket error:", error);
      setIsTyping(false);
      setMessages((msgs) => [
        ...msgs,
        { role: "assistant", text: "❌ WebSocket error! Switching to HTTP fallback..." },
      ]);
      setUseWebSocket(false);
      setLoading(false);
    };

    ws.current.onclose = (event) => {
      log("❌ WebSocket closed - Code:", event.code, "Reason:", event.reason, "WasClean:", event.wasClean);
      setIsTyping(false);
      setUseWebSocket(false);
      setLoading(false);
    };

    return () => {
      log("🧹 WebSocket effect cleanup - closing connection");
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [isOpen]); // Removed useWebSocket and updateStreamingMessage from deps to prevent re-runs

  // Autoscroll logic
  useEffect(() => {
    if (autoScroll) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [messages, autoScroll]);

  function isUserAtBottom(el, threshold = 5) {
    return Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < threshold;
  }
  
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    let ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          setAutoScroll(isUserAtBottom(el));
          ticking = false;
        });
        ticking = true;
      }
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // HTTP Streaming fallback
  async function streamChatbotResponse(input, history, onChunk) {
    log("Sending HTTP fallback chat request...", input);
    try {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      const res = await fetch(HTTP_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, history }),
        signal: controller.signal,
      });
      
      if (!res.body) throw new Error("No HTTP stream body!");
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (value) {
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.type === "text" || data.type === "citation" || data.type === "source" || data.type === "sources_header") {
                onChunk(data.content);
              }
            } catch (e) {
              // Ignore malformed JSON lines
            }
          }
        }
        done = readerDone;
      }
      
      log("HTTP chat complete.");
    } catch (err) {
      log("HTTP chat error:", err);
      throw err;
    }
  }

  // Sending Messages (auto fallback)
  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    setAutoScroll(true);
    setLoading(true);
    setIsTyping(false);
    streamingBuffer.current = "";
    setMessages((msgs) => [...msgs, { role: "user", text: input }]);

    if (useWebSocket && ws.current && ws.current.readyState === WebSocket.OPEN) {
      log("Sending via WebSocket:", input);
      ws.current.send(JSON.stringify({ message: input }));
      setInput("");
      return;
    }

    // HTTP fallback (auto streaming)
    log("Using HTTP fallback...");
    let firstChunk = true;
    try {
      await streamChatbotResponse(input, messages, (chunk) => {
        updateStreamingMessage(chunk);
        if (firstChunk) {
          setLoading(false);
          firstChunk = false;
        }
      });
    } catch (err) {
      setMessages((msgs) => [
        ...msgs,
        { role: "assistant", text: "❌ Error: Could not connect to the server." },
      ]);
      setLoading(false);
    }
    setInput("");
    setLoading(false);
  }, [input, useWebSocket, messages, updateStreamingMessage]);

  // Clear chat history (start new chat)
  const clearChatHistory = useCallback(() => {
    log("Clearing chat history...");
    fetch(CLEAR_CHAT_URL, { 
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        log("Chat history cleared successfully:", data);
        streamingBuffer.current = "";
        setIsTyping(false);
        setMessages([{ 
          role: "assistant", 
          text: "Hello! I'm TexasForestGuide, your assistant for forestry, agriculture, and environmental topics in Texas. How can I help you today?" 
        }]);
        log("New chat started successfully");
      })
      .catch((err) => {
        log("Failed to clear chat history:", err);
        // Still reset the frontend even if backend call fails
        streamingBuffer.current = "";
        setIsTyping(false);
        setMessages([{ 
          role: "assistant", 
          text: "Hello! I'm TexasForestGuide, your assistant for forestry, agriculture, and environmental topics in Texas. How can I help you today?" 
        }]);
      });
  }, []);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return (
    <div className="texas-chatbot-overlay">
      <div className="texas-chatbot-container">
        <div className="texas-chatbot-header">
          <div className="header-title">
            <FaLeaf className="header-icon texas-icon" />
            <span>TexasForestGuide</span>
            {isTyping && (
              <span className="thinking-indicator">🤔 thinking...</span>
            )}
          </div>
          <div className="header-actions">
            <button
              onClick={clearChatHistory}
              className="clear-chat-btn"
              title="Start New Chat"
            >
              New Chat
            </button>
            <button
              className="close-chatbot-btn"
              onClick={onClose}
              title="Close Chat"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div 
          className="texas-chatbot-messages" 
          ref={messagesContainerRef}
        >
          {messages.map((m, idx) => (
            <ChatBubble key={idx} msg={m} />
          ))}
          {(loading || isTyping) && (
            <div className="chat-bubble assistant-bubble">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="texas-chatbot-input-area">
          <input
            type="text"
            placeholder="Ask me about Texas forestry, agriculture, or environment..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={loading || isTyping}
            className="chat-input"
          />
          <button
            onClick={handleSend}
            disabled={loading || isTyping || !input.trim()}
            className="send-btn"
            aria-label="Send"
          >
            <FaPaperPlane />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ msg }) {
  const bubbleClass = msg.role === "user" ? "user-bubble" : "assistant-bubble";
  let cleanText = msg.text;
  
  // Clean up any unwanted prefixes
  if (cleanText && cleanText.startsWith("thinking...")) {
    cleanText = cleanText.replace(/^thinking\.\.\./, "").trim();
  }
  
  return (
    <div className={`chat-bubble ${bubbleClass}`}>
      {msg.role === "user" ? (
        <span>{cleanText}</span>
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ node, ...props }) => (
              <a 
                {...props} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="chat-link"
              >
                {props.children}
              </a>
            ),
          }}
        >
          {cleanText}
        </ReactMarkdown>
      )}
    </div>
  );
} 