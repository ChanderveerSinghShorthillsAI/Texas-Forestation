"""
Authentication Service for Texas Forestation Login System

This module provides all authentication-related functionality including:
- JWT token creation and validation
- Password verification
- User authentication
- Security utilities
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status

from .auth_models import UserInfo, TokenData, LoginResponse
from .user_database import user_db_service

# Setup logging
logger = logging.getLogger(__name__)

# JWT settings - Use environment variables for production security
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "texas_forestation_secret_key_2024_super_secure")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "30"))


class AuthenticationService:
    """
    Main authentication service class that handles all authentication operations.
    
    This service provides:
    - User authentication
    - JWT token generation and validation
    - Password verification
    - Security utilities
    """
    
    def __init__(self):
        """Initialize the authentication service"""
        logger.info("🔐 Authentication Service initialized")
    
    def verify_password(self, plain_password: str, username: str) -> bool:
        """
        Verify a user's password against database.
        
        Args:
            plain_password: The password to verify
            username: The username attempting to login
            
        Returns:
            bool: True if password is correct, False otherwise
        """
        try:
            # Get user from database
            user = user_db_service.get_user_by_username(username)
            if not user:
                logger.warning(f"❌ User '{username}' not found in database")
                return False
            
            if not user.is_active:
                logger.warning(f"❌ User '{username}' is deactivated")
                return False
            
            if user.is_account_locked():
                logger.warning(f"❌ User '{username}' account is locked due to failed attempts")
                return False
            
            # Verify password using database method
            is_valid = user.verify_password(plain_password)
            if is_valid:
                logger.info(f"✅ Password verified for user: {username}")
            else:
                logger.warning(f"❌ Invalid password attempt for user: {username}")
            
            return is_valid
            
        except Exception as e:
            logger.error(f"Error verifying password for '{username}': {e}")
            return False
    
    def authenticate_user(self, username: str, password: str) -> Optional[UserInfo]:
        """
        Authenticate a user with username and password using database.
        
        Args:
            username: Username to authenticate
            password: Password to verify
            
        Returns:
            UserInfo: User information if authentication successful, None otherwise
        """
        try:
            # Use database service for authentication
            user = user_db_service.authenticate_user(username, password)
            if not user:
                logger.warning(f"Authentication failed for user: {username}")
                return None
            
            # Create user info from database user
            user_info = UserInfo(
                username=user.username,
                is_authenticated=True,
                login_time=user.last_login
            )
            
            logger.info(f"✅ User authenticated successfully: {username} (Login #{user.login_count})")
            return user_info
            
        except Exception as e:
            logger.error(f"Error during authentication for '{username}': {e}")
            return None
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """
        Create a JWT access token.
        
        Args:
            data: Data to encode in the token
            expires_delta: Token expiration time (optional)
            
        Returns:
            str: Encoded JWT token
        """
        try:
            to_encode = data.copy()
            
            if expires_delta:
                expire = datetime.utcnow() + expires_delta
            else:
                expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            
            to_encode.update({"exp": expire, "iat": datetime.utcnow()})
            
            encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
            logger.info(f"🔑 Access token created for data: {data.get('sub', 'unknown')}")
            
            return encoded_jwt
            
        except Exception as e:
            logger.error(f"Error creating access token: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not create access token"
            )
    
    def verify_token(self, token: str) -> Optional[TokenData]:
        """
        Verify and decode a JWT token.
        
        Args:
            token: JWT token to verify
            
        Returns:
            TokenData: Decoded token data if valid, None otherwise
        """
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username: str = payload.get("sub")
            expires_at: Optional[datetime] = None
            
            if payload.get("exp"):
                expires_at = datetime.fromtimestamp(payload.get("exp"))
            
            if username is None:
                logger.warning("Token validation failed: no username in token")
                return None
            
            token_data = TokenData(username=username, expires_at=expires_at)
            logger.debug(f"✅ Token verified for user: {username}")
            
            return token_data
            
        except JWTError as e:
            logger.warning(f"JWT validation failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Error verifying token: {e}")
            return None
    
    def get_current_user(self, token: str) -> Optional[UserInfo]:
        """
        Get current user information from a JWT token.
        
        Args:
            token: JWT token
            
        Returns:
            UserInfo: Current user information if token is valid, None otherwise
        """
        try:
            token_data = self.verify_token(token)
            if token_data is None or token_data.username is None:
                return None
            
            # Verify user exists in database and is active
            user = user_db_service.get_user_by_username(token_data.username)
            if not user or not user.is_active:
                logger.warning(f"Token user '{token_data.username}' not found or inactive")
                return None
            
            user_info = UserInfo(
                username=user.username,
                is_authenticated=True,
                login_time=user.last_login
            )
            return user_info
            
        except Exception as e:
            logger.error(f"Error getting current user: {e}")
            return None
    
    def login_user(self, username: str, password: str) -> LoginResponse:
        """
        Complete login process for a user.
        
        Args:
            username: Username to login
            password: Password to verify
            
        Returns:
            LoginResponse: Complete login response with token and user info
            
        Raises:
            HTTPException: If authentication fails
        """
        try:
            # Authenticate user
            user = self.authenticate_user(username, password)
            if not user:
                logger.warning(f"Login failed for user: {username}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid username or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            # Create access token
            access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = self.create_access_token(
                data={"sub": user.username},
                expires_delta=access_token_expires
            )
            
            # Create login response
            login_response = LoginResponse(
                access_token=access_token,
                token_type="bearer",
                expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # Convert to seconds
                user=user
            )
            
            logger.info(f"🎉 Login successful for user: {username}")
            return login_response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error during login: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Login process failed"
            )
    
    def get_token_expiry_info(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Get token expiry information.
        
        Args:
            token: JWT token
            
        Returns:
            Dict with expiry information or None if token is invalid
        """
        try:
            token_data = self.verify_token(token)
            if not token_data or not token_data.expires_at:
                return None
            
            now = datetime.utcnow()
            expires_in_seconds = int((token_data.expires_at - now).total_seconds())
            
            return {
                "expires_at": token_data.expires_at.isoformat(),
                "expires_in_seconds": max(0, expires_in_seconds),
                "is_expired": expires_in_seconds <= 0
            }
            
        except Exception as e:
            logger.error(f"Error getting token expiry info: {e}")
            return None


# Global authentication service instance
auth_service = AuthenticationService() 