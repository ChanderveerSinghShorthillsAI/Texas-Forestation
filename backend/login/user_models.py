"""
User Database Models for Texas Forestation Authentication System

Professional user management with SQLAlchemy models for spatial_data.db
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime
import hashlib
import secrets
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()

class User(Base):
    """
    User model for authentication system
    
    Professional user management with hashed passwords,
    session tracking, and security features.
    """
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    salt = Column(String(64), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)
    login_count = Column(Integer, default=0, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    last_failed_login = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __init__(self, username: str, password: str):
        """Initialize user with hashed password"""
        self.username = username
        self.salt = secrets.token_hex(32)  # 64 character salt
        self.password_hash = self._hash_password(password, self.salt)
        self.created_at = datetime.utcnow()
        self.password_changed_at = datetime.utcnow()
        
    @staticmethod
    def _hash_password(password: str, salt: str) -> str:
        """
        Hash password with salt using SHA-256
        
        Args:
            password: Plain text password
            salt: Cryptographically secure salt
            
        Returns:
            Hex-encoded hash string
        """
        # Combine password and salt
        password_salt = f"{password}{salt}".encode('utf-8')
        
        # Hash with SHA-256 (multiple rounds for security)
        hash_obj = hashlib.sha256(password_salt)
        for _ in range(10000):  # 10,000 rounds for security
            hash_obj = hashlib.sha256(hash_obj.digest())
        
        return hash_obj.hexdigest()
    
    def verify_password(self, password: str) -> bool:
        """
        Verify password against stored hash
        
        Args:
            password: Plain text password to verify
            
        Returns:
            True if password matches, False otherwise
        """
        return self.password_hash == self._hash_password(password, self.salt)
    
    def update_password(self, new_password: str) -> None:
        """
        Update user password with new hash
        
        Args:
            new_password: New plain text password
        """
        self.salt = secrets.token_hex(32)
        self.password_hash = self._hash_password(new_password, self.salt)
        self.password_changed_at = datetime.utcnow()
    
    def record_login_success(self) -> None:
        """Record successful login"""
        self.last_login = datetime.utcnow()
        self.login_count += 1
        self.failed_login_attempts = 0  # Reset failed attempts on success
    
    def record_login_failure(self) -> None:
        """Record failed login attempt"""
        self.failed_login_attempts += 1
        self.last_failed_login = datetime.utcnow()
    
    def is_account_locked(self, max_attempts: int = 50) -> bool:
        """
        Check if account is locked due to failed attempts
        
        Args:
            max_attempts: Maximum failed attempts before lockout
            
        Returns:
            True if account is locked, False otherwise
        """
        return self.failed_login_attempts >= max_attempts
    
    def to_dict(self) -> dict:
        """Convert user to dictionary for API responses"""
        return {
            'id': self.id,
            'username': self.username,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'login_count': self.login_count
        }
    
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', active={self.is_active})>" 