"""
Authentication Middleware for Texas Forestation Login System

This module provides middleware and dependency injection for protecting routes
and extracting current user information from JWT tokens.
"""

import logging
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Request

from .auth_service import auth_service
from .auth_models import UserInfo

# Setup logging
logger = logging.getLogger(__name__)

# Security scheme for JWT Bearer tokens
security = HTTPBearer()


class AuthenticationMiddleware:
    """
    Authentication middleware class for handling JWT token validation
    and user authentication across the application.
    """
    
    def __init__(self):
        """Initialize the authentication middleware"""
        logger.info("🛡️ Authentication Middleware initialized")
    
    def extract_token_from_header(self, authorization: str) -> Optional[str]:
        """
        Extract JWT token from Authorization header.
        
        Args:
            authorization: Authorization header value
            
        Returns:
            str: JWT token if found, None otherwise
        """
        try:
            if not authorization:
                return None
            
            # Handle both "Bearer token" and "token" formats
            if authorization.startswith("Bearer "):
                return authorization[7:]  # Remove "Bearer " prefix
            else:
                return authorization
                
        except Exception as e:
            logger.error(f"Error extracting token from header: {e}")
            return None
    
    def get_current_user_optional(self, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[UserInfo]:
        """
        Get current user from JWT token (optional - returns None if no valid token).
        
        This is useful for endpoints that can work with or without authentication.
        
        Args:
            credentials: HTTP authorization credentials
            
        Returns:
            UserInfo: Current user if token is valid, None otherwise
        """
        try:
            if not credentials:
                return None
            
            token = credentials.credentials
            if not token:
                return None
            
            user = auth_service.get_current_user(token)
            if user:
                logger.debug(f"✅ Optional auth: User found: {user.username}")
            else:
                logger.debug("ℹ️ Optional auth: No valid user found")
            
            return user
            
        except Exception as e:
            logger.error(f"Error in optional user authentication: {e}")
            return None
    
    def get_current_user_required(self, credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserInfo:
        """
        Get current user from JWT token (required - raises exception if no valid token).
        
        This should be used for protected endpoints that require authentication.
        
        Args:
            credentials: HTTP authorization credentials
            
        Returns:
            UserInfo: Current user information
            
        Raises:
            HTTPException: If token is missing or invalid
        """
        try:
            if not credentials:
                logger.warning("Authentication required but no credentials provided")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            token = credentials.credentials
            if not token:
                logger.warning("Authentication required but no token provided")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication token required",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            user = auth_service.get_current_user(token)
            if not user:
                logger.warning("Invalid or expired authentication token")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            logger.debug(f"✅ Required auth: User authenticated: {user.username}")
            return user
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in required user authentication: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication error"
            )
    
    def verify_admin_access(self, current_user: UserInfo = Depends(lambda: auth_middleware.get_current_user_required)) -> UserInfo:
        """
        Verify that the current user has admin access.
        
        For this single-user system, any authenticated user is considered admin.
        
        Args:
            current_user: Current authenticated user
            
        Returns:
            UserInfo: Current user if they have admin access
            
        Raises:
            HTTPException: If user doesn't have admin access
        """
        try:
            # In this single-user system, the authenticated user is the admin
            if current_user and current_user.is_authenticated:
                logger.debug(f"✅ Admin access verified for user: {current_user.username}")
                return current_user
            
            logger.warning("Admin access denied: user not properly authenticated")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error verifying admin access: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authorization error"
            )


# Global middleware instance
auth_middleware = AuthenticationMiddleware()

# Convenience dependency functions for use in FastAPI routes
def get_current_user_optional() -> Optional[UserInfo]:
    """
    Dependency for optional user authentication.
    Returns None if no valid token is provided.
    """
    return Depends(auth_middleware.get_current_user_optional)

def get_current_user() -> UserInfo:
    """
    Dependency for required user authentication.
    Raises HTTPException if no valid token is provided.
    """
    return Depends(auth_middleware.get_current_user_required)

def require_admin() -> UserInfo:
    """
    Dependency for admin access requirement.
    Raises HTTPException if user doesn't have admin access.
    """
    return Depends(auth_middleware.verify_admin_access)


# Additional utility functions for manual token checking
def check_token_in_request(request: Request) -> Optional[UserInfo]:
    """
    Manually check for authentication token in request headers.
    
    This is useful for WebSocket connections or custom authentication scenarios.
    
    Args:
        request: FastAPI request object
        
    Returns:
        UserInfo: Current user if token is valid, None otherwise
    """
    try:
        # Check Authorization header
        authorization = request.headers.get("Authorization")
        if authorization:
            token = auth_middleware.extract_token_from_header(authorization)
            if token:
                user = auth_service.get_current_user(token)
                if user:
                    logger.debug(f"✅ Manual token check: User found: {user.username}")
                    return user
        
        # Check for token in query parameters (fallback for WebSocket)
        token = request.query_params.get("token")
        if token:
            user = auth_service.get_current_user(token)
            if user:
                logger.debug(f"✅ Manual token check (query): User found: {user.username}")
                return user
        
        logger.debug("ℹ️ Manual token check: No valid token found")
        return None
        
    except Exception as e:
        logger.error(f"Error in manual token check: {e}")
        return None


def is_authenticated(request: Request) -> bool:
    """
    Simple boolean check for authentication status.
    
    Args:
        request: FastAPI request object
        
    Returns:
        bool: True if user is authenticated, False otherwise
    """
    user = check_token_in_request(request)
    return user is not None and user.is_authenticated 