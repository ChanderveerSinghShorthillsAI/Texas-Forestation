from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float, Index
from sqlalchemy.orm import relationship, sessionmaker, declarative_base
from sqlalchemy import create_engine
from datetime import datetime, timedelta
import uuid
import os

Base = declarative_base()

class ChatSession(Base):
    """Chat session model to track user conversations"""
    __tablename__ = "chat_sessions"
    
    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(100), unique=True, nullable=False, index=True)
    user_ip = Column(String(50))
    user_agent = Column(String(500))
    started_at = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    message_count = Column(Integer, default=0)
    total_tokens_used = Column(Integer, default=0)
    
    # Relationship to messages
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = datetime.utcnow()
    
    def is_expired(self, hours=24):
        """Check if session is expired (default 24 hours)"""
        if not self.last_activity:
            return True
        return datetime.utcnow() - self.last_activity > timedelta(hours=hours)

class ChatMessage(Base):
    """Individual chat messages within a session"""
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(50), ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String(20), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    tokens_used = Column(Integer, default=0)
    response_time_ms = Column(Float)
    was_cached = Column(Boolean, default=False)
    is_confidential = Column(Boolean, default=False)
    
    # Additional metadata
    user_query_hash = Column(String(64))  # For cache lookup
    confidence_score = Column(Float)
    sources_count = Column(Integer, default=0)
    
    # Relationship to session
    session = relationship("ChatSession", back_populates="messages")
    
    # Add indexes for better query performance
    __table_args__ = (
        Index('idx_session_timestamp', 'session_id', 'timestamp'),
        Index('idx_role_timestamp', 'role', 'timestamp'),
        Index('idx_query_hash', 'user_query_hash'),
    )

class ChatCache(Base):
    """Cache table for storing frequent query responses scoped by session"""
    __tablename__ = "chat_cache"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    query_hash = Column(String(64), nullable=False, index=True)  # No longer unique globally
    session_id = Column(String(100), nullable=True, index=True)  # Session scope
    query_text = Column(Text, nullable=False)
    response_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime, default=datetime.utcnow)
    access_count = Column(Integer, default=1)
    ttl_hours = Column(Integer, default=24)  # Time to live in hours
    is_active = Column(Boolean, default=True)
    
    # Performance metadata
    original_response_time_ms = Column(Float)
    sources_count = Column(Integer, default=0)
    
    # Create composite unique constraint for query_hash + session_id
    __table_args__ = (
        Index('idx_query_session_unique', 'query_hash', 'session_id', unique=True),
    )
    
    def is_expired(self):
        """Check if cache entry is expired"""
        if not self.created_at or not self.ttl_hours:
            return True
        return datetime.utcnow() - self.created_at > timedelta(hours=self.ttl_hours)
    
    def update_access(self):
        """Update access statistics"""
        self.last_accessed = datetime.utcnow()
        self.access_count += 1

class ConfidentialQuery(Base):
    """Log confidential queries for monitoring and analysis"""
    __tablename__ = "confidential_queries"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(50), ForeignKey("chat_sessions.id"))
    query_text = Column(Text, nullable=False)
    detected_model = Column(String(100))  # Which confidential model was detected
    confidence_score = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user_ip = Column(String(50))
    
    # Relationship
    session = relationship("ChatSession")

# Database configuration
# Use absolute path to ensure single database file in backend root
if not os.getenv("DATABASE_URL"):
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(backend_dir, "texas_chatbot.db")
    DATABASE_URL = f"sqlite:///{db_path}"
else:
    DATABASE_URL = os.getenv("DATABASE_URL")

# Create engine and session factory
engine = create_engine(
    DATABASE_URL,
    echo=False,  # Set to True for SQL debugging
    pool_size=10,
    max_overflow=20
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_tables():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_database():
    """Initialize database with tables"""
    create_tables()
    print("✅ Database initialized successfully")

if __name__ == "__main__":
    init_database() 