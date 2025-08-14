# Texas Citizen Chatbot

A comprehensive AI-powered chatbot system designed specifically for Texas forestry, agriculture, and environmental topics. This implementation includes real-time WebSocket communication with HTTP fallback, database-backed chat history, caching, and confidential query detection.

## Features

### 🤖 **AI-Powered Responses**
- **Gemini 2.5 Flash integration** for intelligent responses
- **Texas-specific knowledge** with focus on forestry and agriculture
- **RAG integration** using existing Weaviate knowledge base
- **Real-time streaming responses** for natural conversation flow

### 🔄 **Dual Communication Modes**
- **WebSocket support** for real-time chat with streaming
- **HTTP fallback** with streaming responses when WebSocket fails
- **Automatic failover** between communication modes

### 💾 **Persistent Storage**
- **SQLAlchemy database models** for chat sessions and messages
- **Session management** with automatic expiration
- **Chat history persistence** across sessions
- **Enhanced caching system** with database storage

### 🔒 **Security & Privacy**
- **Confidential query detection** for Texas-specific sensitive topics
- **Logging and monitoring** of confidential query attempts
- **Session-based isolation** for user privacy

### 🎨 **Modern UI/UX**
- **Texas-themed design** with forest green color scheme
- **Responsive layout** for mobile and desktop
- **Floating chat button** for easy access
- **Smooth animations** and typing indicators

## Architecture

```
Frontend (React)              Backend (FastAPI)
├── ChatButton.jsx           ├── main.py (WebSocket + HTTP endpoints)
├── TexasCitizenChatbot.jsx  ├── citizen_chatbot_service.py (Core logic)
└── CSS Styles               ├── citizen_chatbot_websocket.py (WebSocket handler)
                             ├── citizen_chatbot_http.py (HTTP endpoints)
                             ├── citizen_chatbot_models.py (Database models)
                             ├── citizen_chatbot_cache.py (Caching system)
                             └── citizen_chatbot_confidential.py (Security)
```

## Database Models

### ChatSession
- Session management with auto-expiration
- User tracking (IP, user agent)
- Message count and token usage statistics

### ChatMessage
- Individual messages with metadata
- Response time tracking
- Cache hit indicators
- Source count for citations

### ChatCache
- Database-backed caching with TTL
- Access statistics and optimization
- Automatic cleanup of expired entries

### ConfidentialQuery
- Logging of detected confidential queries
- Security monitoring and analysis

## API Endpoints

### WebSocket
- `ws://localhost:8000/ws/citizen_chatbot/` - Real-time chat

### HTTP Endpoints
- `POST /api/citizen_chatbot/chat/` - Non-streaming chat
- `POST /api/citizen_chatbot/chat/stream/` - Streaming chat (fallback)
- `GET /api/citizen_chatbot/history/` - Get chat history
- `POST /api/citizen_chatbot/clear/` - Clear chat history
- `GET /api/citizen_chatbot/health/` - Health check
- `GET /api/citizen_chatbot/stats/` - Admin statistics

## Environment Variables

Create a `.env` file in the backend directory:

```env
GOOGLE_API_KEY=your_gemini_api_key_here
DATABASE_URL=sqlite:///./texas_chatbot.db
REACT_APP_BASE_URL=http://localhost:8000
REACT_APP_WS_BASE_URL=ws://localhost:8000
```

## Installation & Setup

### Backend Setup

1. **Install dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Initialize database:**
   ```bash
   python citizen_chatbot_models.py
   ```

3. **Start the server:**
   ```bash
   python main.py
   ```

### Frontend Setup

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Start development server:**
   ```bash
   npm start
   ```

## Texas-Specific Features

### Geographic Scope
- **Texas-only responses** - Will not provide information about other states
- **Texas forestry regions** - East Texas Pineywoods, Post Oak Savannah, Cross Timbers, Edwards Plateau
- **Local species knowledge** - Loblolly Pine, Live Oak, Bald Cypress, etc.
- **Regional challenges** - Wildfire, Southern Pine Beetle, Oak Wilt, drought

### Confidential Data Protection
The system detects and blocks queries related to:
- Forest fire incident reports
- Wildlife survey data
- Pest management records
- Land ownership information
- Conservation agreements
- Timber harvest records
- Water rights data
- Government land data
- Environmental assessments
- Critical habitat data

### Knowledge Base Integration
- Integrates with existing Weaviate RAG system
- Uses Texas forestry and agriculture knowledge chunks
- Provides source citations for responses
- Falls back to Gemini's general knowledge when RAG unavailable

## Usage Examples

### Basic Chat
```javascript
// WebSocket
ws.send(JSON.stringify({
  message: "What trees grow best in East Texas?"
}));

// HTTP
fetch('/api/citizen_chatbot/chat/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "How do I manage oak wilt in Texas?",
    history: []
  })
});
```

### Admin Monitoring
```javascript
// Get statistics
fetch('/api/citizen_chatbot/stats/')
  .then(res => res.json())
  .then(stats => console.log(stats));

// Clear cache
fetch('/api/citizen_chatbot/admin/clear_cache/', {
  method: 'POST'
});
```

## Customization

### Adding New Confidential Topics
Edit `citizen_chatbot_confidential.py`:

```python
MODEL_KEYWORDS = {
    "NewConfidentialModel": [
        "keyword1", "keyword2", "phrase example"
    ],
    # ... existing models
}
```

### Modifying System Prompt
Edit `TEXAS_SYSTEM_PROMPT` in `citizen_chatbot_service.py` to adjust the AI's behavior and knowledge scope.

### Styling Customization
Modify the CSS files:
- `TexasCitizenChatbot.css` - Main chat interface
- `ChatButton.css` - Floating chat button

## Performance Optimization

### Caching Strategy
- **Database-backed cache** with configurable TTL
- **Access statistics** for cache optimization
- **Automatic cleanup** of expired entries
- **Memory-efficient** query hashing

### WebSocket Optimization
- **Connection pooling** and management
- **Automatic reconnection** handling
- **Graceful degradation** to HTTP fallback
- **Efficient message streaming**

## Monitoring & Analytics

### Built-in Statistics
- Total chat sessions and messages
- Cache hit rates and performance
- Confidential query attempts
- Response times and error rates

### Logging
- Comprehensive logging for debugging
- Security event logging
- Performance metrics tracking
- Error tracking and reporting

## Security Considerations

### Data Privacy
- Session-based user isolation
- No persistent user identification
- Automatic session expiration
- Secure confidential data handling

### Rate Limiting
- Implement rate limiting in production
- Monitor for abuse patterns
- Set appropriate session limits

## Production Deployment

### Recommended Configuration
- Use PostgreSQL instead of SQLite
- Implement proper logging infrastructure
- Set up monitoring and alerting
- Configure reverse proxy (nginx)
- Enable HTTPS and WSS

### Environment Variables for Production
```env
DATABASE_URL=postgresql://user:pass@localhost/texas_chatbot
GOOGLE_API_KEY=your_production_api_key
LOG_LEVEL=INFO
MAX_SESSIONS=1000
CACHE_TTL_HOURS=24
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if port 8000 is accessible
   - Verify CORS settings
   - Check proxy configuration

2. **Database Errors**
   - Run `python citizen_chatbot_models.py` to initialize
   - Check database permissions
   - Verify DATABASE_URL format

3. **No AI Responses**
   - Verify GOOGLE_API_KEY is set
   - Check API quota limits
   - Review service logs

4. **Cache Not Working**
   - Check database connectivity
   - Verify cache table creation
   - Review TTL settings

## Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update this README for any changes
4. Ensure Texas-specific scope is maintained

## License

This project is part of the Texas Forestation system and follows the same licensing terms. 