"""
Authentication Routes for Texas Forestation Login System

This module defines all API routes related to authentication including:
- Login endpoint
- Token validation
- User information
- Logout functionality
"""

import logging
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from typing import Dict, Any

from .auth_models import LoginRequest, LoginResponse, AuthErrorResponse, TokenValidationResponse, UserInfo
from .auth_service import auth_service
from .auth_middleware import get_current_user, get_current_user_optional

# Setup logging
logger = logging.getLogger(__name__)

# Create router for authentication routes
router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
    responses={
        401: {"model": AuthErrorResponse, "description": "Authentication failed"},
        500: {"model": AuthErrorResponse, "description": "Internal server error"}
    }
)


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(login_request: LoginRequest) -> LoginResponse:
    """
    Authenticate user and return JWT token.
    
    This endpoint validates user credentials and returns a JWT token
    that can be used for subsequent authenticated requests.
    
    Args:
        login_request: Login credentials (username and password)
        
    Returns:
        LoginResponse: JWT token and user information
        
    Raises:
        HTTPException: If credentials are invalid
    """
    try:
        logger.info(f"🔐 Login attempt for user: {login_request.username}")
        
        # Perform login through auth service
        login_response = auth_service.login_user(
            username=login_request.username,
            password=login_request.password
        )
        
        logger.info(f"✅ Login successful for user: {login_request.username}")
        return login_response
        
    except HTTPException as e:
        logger.warning(f"❌ Login failed for user {login_request.username}: {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during login for user {login_request.username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login service temporarily unavailable"
        )


@router.post("/validate-token", response_model=TokenValidationResponse, status_code=status.HTTP_200_OK)
async def validate_token(current_user: UserInfo = get_current_user_optional()) -> TokenValidationResponse:
    """
    Validate the current JWT token and return user information.
    
    This endpoint checks if a JWT token is valid and returns
    the associated user information.
    
    Returns:
        TokenValidationResponse: Token validation result and user info
    """
    try:
        if current_user:
            logger.debug(f"✅ Token validation  successful for user: {current_user.username}")
            return TokenValidationResponse(
                is_valid=True,
                user=current_user,
                expires_in=1800  # Default expiry info - could be enhanced
            )
        else:
            logger.debug("❌ Token validation failed: invalid or missing token")
            return TokenValidationResponse(
                is_valid=False,
                user=None,
                expires_in=None
            )
            
    except Exception as e:
        logger.error(f"Error during token validation: {e}")
        return TokenValidationResponse(
            is_valid=False,
            user=None,
            expires_in=None
        )


@router.get("/me", response_model=UserInfo, status_code=status.HTTP_200_OK)
async def get_current_user_info(current_user: UserInfo = get_current_user()) -> UserInfo:
    """
    Get current authenticated user information.
    
    This endpoint returns information about the currently authenticated user.
    Requires a valid JWT token.
    
    Returns:
        UserInfo: Current user information
        
    Raises:
        HTTPException: If user is not authenticated
    """
    try:
        logger.debug(f"ℹ️ User info requested for: {current_user.username}")
        return current_user
        
    except Exception as e:
        logger.error(f"Error getting user info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not retrieve user information"
        )


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(current_user: UserInfo = get_current_user()) -> Dict[str, str]:
    """
    Logout the current user.
    
    Since we're using stateless JWT tokens, logout is mainly handled
    on the client side by removing the token. This endpoint serves
    as a confirmation and for logging purposes.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Dict: Logout confirmation message
    """
    try:
        logger.info(f"🚪 User logout: {current_user.username}")
        
        return {
            "message": "Logout successful",
            "detail": "Please remove the authentication token from your client"
        }
        
    except Exception as e:
        logger.error(f"Error during logout: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )


@router.get("/status", status_code=status.HTTP_200_OK)
async def auth_status() -> Dict[str, Any]:
    """
    Get authentication service status.
    
    This endpoint provides information about the authentication service
    status and can be used for health checks.
    
    Returns:
        Dict: Authentication service status information
    """
    try:
        return {
            "service": "Texas Forestation Authentication",
            "status": "operational",
            "version": "1.0.0",
            "features": {
                "jwt_auth": True,
                "single_user": True,
                "token_expiry": "30 minutes"
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting auth status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not retrieve authentication status"
        )


@router.get("/check", status_code=status.HTTP_200_OK)
async def check_auth(current_user: UserInfo = get_current_user_optional()) -> Dict[str, Any]:
    """
    Quick authentication check endpoint.
    
    This endpoint provides a simple way to check if a user is authenticated
    without requiring authentication (returns authentication status).
    
    Returns:
        Dict: Authentication check result
    """
    try:
        is_authenticated = current_user is not None
        
        result = {
            "is_authenticated": is_authenticated,
            "timestamp": auth_service.get_current_user.__module__  # Just for API response
        }
        
        if is_authenticated and current_user:
            result["user"] = {
                "username": current_user.username,
                "login_time": current_user.login_time.isoformat() if current_user.login_time else None
            }
            logger.debug(f"✅ Auth check: User {current_user.username} is authenticated")
        else:
            logger.debug("ℹ️ Auth check: No authenticated user")
        
        return result
        
    except Exception as e:
        logger.error(f"Error during auth check: {e}")
        return {
            "is_authenticated": False,
            "error": "Authentication check failed"
        }


# Note: Exception handlers are handled by the main FastAPI app
# APIRouter doesn't support exception handlers directly 