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
  const [useWebSocket, setUseWebSocket] = useState(false); // Changed to false - HTTP is now primary
  const [connectionState, setConnectionState] = useState('http_fallback'); // Changed to 'http_fallback' - HTTP is now primary
  const [messagesRendered, setMessagesRendered] = useState(false);
  const ws = useRef(null);
  const wsOpenedAtRef = useRef(null);
  const streamingBuffer = useRef("");
  const abortControllerRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;

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
    
    // Set a timeout to ensure welcome message appears even if history fetch hangs
    const historyTimeout = setTimeout(() => {
      setMessages((currentMessages) => {
        if (currentMessages.length === 0) {
          log("⏰ History fetch timeout. Setting default welcome message.");
          return [{ 
            role: "assistant", 
            text: "Hello! I'm TexasForestGuide, your assistant for forestry, agriculture, and environmental topics in Texas. How can I help you today?" 
          }];
        }
        return currentMessages;
      });
    }, 3000); // 3 second timeout for history
    
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
        clearTimeout(historyTimeout);
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
        clearTimeout(historyTimeout);
        log("Failed to fetch chat history:", err);
        setMessages([{ 
          role: "assistant", 
          text: "Hello! I'm TexasForestGuide, your assistant for forestry, agriculture, and environmental topics in Texas. How can I help you today?" 
        }]);
      });
    
    return () => clearTimeout(historyTimeout);
  }, [isOpen]);

  // WebSocket connection with automatic reconnection
  const connectWebSocket = useCallback(() => {
    if (!useWebSocket) {
      log("❌ WebSocket disabled, using HTTP fallback");
      setConnectionState('http_fallback');
      return;
    }

    // Prevent creating multiple connections - STRICT CHECK
    if (ws.current) {
      const state = ws.current.readyState;
      if (state === WebSocket.OPEN) {
        log("⚡ WebSocket already OPEN, skipping connection attempt");
        return;
      } else if (state === WebSocket.CONNECTING) {
        log("⚡ WebSocket already CONNECTING, skipping connection attempt");
        return;
      } else {
        log(`   Previous WebSocket in state ${state}, creating new connection`);
        // Clean up old connection
        ws.current.onopen = null;
        ws.current.onmessage = null;
        ws.current.onclose = null;
        ws.current.onerror = null;
        ws.current = null;
      }
    }
    
    log(`🔌 Creating new WebSocket connection (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
    log(`   URL: ${WS_URL}`);
    
    try {
      const newWs = new WebSocket(WS_URL);
      ws.current = newWs;

      newWs.onopen = () => {
        // Verify this is still the current WebSocket
        if (ws.current !== newWs) {
          log("⚠️ Opened WebSocket is not current, ignoring");
          newWs.close(1000, "Stale connection");
          return;
        }
        
        log("✅ WebSocket connected successfully!");
        log("   Ready State:", newWs.readyState);
        log("   Connection URL:", WS_URL);
        
        // Track when this WebSocket opened
        wsOpenedAtRef.current = Date.now();
        
        // Clear the connection timeout since we successfully connected
        if (connectionTimeoutRef.current) {
          log("   Clearing connection timeout");
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        
        reconnectAttemptsRef.current = 0; // Reset reconnect counter on success
        setConnectionState('connected');
      };

      newWs.onmessage = (event) => {
        // Verify this is still the current WebSocket
        if (ws.current !== newWs) {
          log("⚠️ Message from stale WebSocket, ignoring");
          return;
        }
        
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

      newWs.onerror = (error) => {
        // Verify this is still the current WebSocket
        if (ws.current !== newWs) {
          log("⚠️ Error from stale WebSocket, ignoring");
          return;
        }
        
        log("❌ WebSocket error occurred");
        log("   Error type:", error.type);
        log("   Error target readyState:", error.target?.readyState);
        log("   This usually means:");
        log("   - Backend server not running");
        log("   - WebSocket endpoint not available");
        log("   - Network/firewall blocking connection");
        log("   - CORS or connection refused");
        
        setIsTyping(false);
        setLoading(false);
        // Don't immediately disable - let onclose handle reconnection
      };

      newWs.onclose = (event) => {
        // Verify this is still the current WebSocket
        if (ws.current !== newWs) {
          log("⚠️ Close event from stale WebSocket, ignoring");
          return;
        }
        
        log("❌ WebSocket closed - Code:", event.code, "Reason:", event.reason || 'none', "WasClean:", event.wasClean);
        log("   Common codes: 1000=Normal, 1001=Going Away, 1006=Abnormal, 1011=Server Error");
        
        // Clear the current ws reference
        if (ws.current === newWs) {
          ws.current = null;
        }
        
        setIsTyping(false);
        setLoading(false);
        
        // Only attempt reconnection for abnormal closures and if under max attempts
        // Code 1000 is normal closure, don't reconnect
        if (event.code !== 1000 && !event.wasClean && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 5000); // Exponential backoff
          log(`🔄 Abnormal closure detected. Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          // Clear any existing reconnect timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          log("❌ Max reconnection attempts reached. Switching to HTTP fallback.");
          setMessages((msgs) => [
            ...msgs,
            { role: "assistant", text: "⚠️ Connection unstable. Switched to HTTP mode for reliability." },
          ]);
          setUseWebSocket(false);
          setConnectionState('http_fallback');
        } else if (event.code === 1000) {
          log("✅ Normal WebSocket closure (code 1000)");
        }
      };
    } catch (error) {
      log("❌ Failed to create WebSocket:", error);
      setUseWebSocket(false);
      setConnectionState('http_fallback');
    }
  }, [useWebSocket, updateStreamingMessage]);

  // WebSocket setup effect - STABLE, only depends on isOpen
  useEffect(() => {
    if (!isOpen) {
      log("❌ Component not open, skipping WebSocket");
      return;
    }
    
    // Skip WebSocket entirely when HTTP is primary
    if (!useWebSocket) {
      log("✅ HTTP mode is primary - WebSocket disabled");
      setConnectionState('http_fallback');
      return;
    }
    
    log("🎬 WebSocket effect starting...");
    
    // Set initial connecting state
    setConnectionState('connecting');
    
    // Connect when component opens
    connectWebSocket();
    
    // Set a timeout to fallback to HTTP if WebSocket takes too long
    // This timeout will be cleared when connection succeeds (in onopen handler)
    connectionTimeoutRef.current = setTimeout(() => {
      log("⏰ WebSocket connection timeout (10s). Checking state...");
      
      // Only switch to HTTP if still in connecting state AND WebSocket hasn't opened
      if (ws.current) {
        const state = ws.current.readyState;
        log(`   Current WebSocket state: ${state} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);
        
        if (state === WebSocket.CONNECTING || state === WebSocket.CLOSED) {
          log("   Switching to HTTP fallback due to timeout");
          setConnectionState('http_fallback');
          setUseWebSocket(false);
          
          // Clean up the failed WebSocket
          if (ws.current) {
            try {
              ws.current.onopen = null;
              ws.current.onmessage = null;
              ws.current.onclose = null;
              ws.current.onerror = null;
              if (state === WebSocket.CONNECTING) {
                ws.current.close(1000, "Connection timeout");
              }
            } catch (e) {
              log("   Error cleaning up timed-out WebSocket:", e);
            }
            ws.current = null;
          }
        } else if (state === WebSocket.OPEN) {
          log("   WebSocket is OPEN, timeout ignored");
        }
      } else {
        log("   No WebSocket instance, switching to HTTP fallback");
        setConnectionState('http_fallback');
        setUseWebSocket(false);
      }
    }, 10000); // Increased to 10 seconds to give more time

    return () => {
      log("🧹 WebSocket effect cleanup - closing connection");
      
      // Clear connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      
      // Clear any pending reconnection attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Close WebSocket connection properly
      if (ws.current) {
        const currentWs = ws.current;
        const readyState = currentWs.readyState;
        
        log(`   Closing WebSocket (readyState: ${readyState})`);
        
        // Check how long the WebSocket has been open
        if (wsOpenedAtRef.current) {
          const openDuration = Date.now() - wsOpenedAtRef.current;
          log(`   WebSocket was open for ${openDuration}ms`);
          
          if (openDuration < 1000) {
            log(`   ⚠️ WARNING: Closing WebSocket that was only open for ${openDuration}ms`);
            log(`   This might indicate a component lifecycle issue`);
          }
        }
        
        // Remove event handlers to prevent reconnection attempts during cleanup
        currentWs.onopen = null;
        currentWs.onmessage = null;
        currentWs.onclose = null;
        currentWs.onerror = null;
        
        // Only close if not already closed
        if (readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING) {
          try {
            currentWs.close(1000, "Component unmounted");
          } catch (e) {
            log("   Error closing WebSocket:", e);
          }
        }
        
        ws.current = null;
        wsOpenedAtRef.current = null;
      }
      
      // Reset reconnect counter and state
      reconnectAttemptsRef.current = 0;
      setConnectionState('connecting');
      setMessagesRendered(false);
    };
  }, [isOpen]); // ONLY depends on isOpen - connectWebSocket is stable via useCallback

  // Track when messages are loaded into state
  // Note: We check if messages are in state, not physically rendered in DOM
  // because the DOM elements only render AFTER the loader is hidden
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to ensure React has processed the state update
      const timer = setTimeout(() => {
        log(`✅ ${messages.length} message(s) loaded into state`);
        setMessagesRendered(true);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [messages]);

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

  // Show loader until ALL conditions are met:
  // 1. Messages loaded into state
  // 2. Messages actually rendered in DOM
  // 3. Connection established (WebSocket or HTTP fallback)
  const hasMessages = messages.length > 0;
  const isConnectionReady = connectionState === 'connected' || connectionState === 'http_fallback';
  const isFullyReady = hasMessages && messagesRendered && isConnectionReady;

  // Determine loader message based on what's pending
  const getLoaderMessage = () => {
    if (!hasMessages) {
      return "Loading chat history...";
    } else if (!messagesRendered) {
      return "Rendering messages...";
    } else if (!isConnectionReady) {
      return "Establishing secure connection...";
    }
    return "Preparing chatbot...";
  };

  return (
    <div className="texas-chatbot-overlay">
      <div className="texas-chatbot-container">
        {!isFullyReady && (
          <div className="chatbot-connection-loader">
            <div className="loader-content">
              <div className="loader-spinner">
                <FaLeaf className="spinner-icon" />
              </div>
              <h3 className="loader-title">Connecting to TexasForestGuide</h3>
              <p className="loader-message">{getLoaderMessage()}</p>
              <div className="loader-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        
        {isFullyReady && (
          <>
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
        </>
        )}
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
                style={{color: "#abed80"}}
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