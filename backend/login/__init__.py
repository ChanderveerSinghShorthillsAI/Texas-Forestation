"""
Texas Forestation Authentication Package

This package provides complete authentication functionality including:
- JWT token-based authentication
- User login/logout
- Protected route middleware
- Authentication models and services
"""

from .auth_models import (
    LoginRequest,
    LoginResponse,
    UserInfo,
    TokenData,
    AuthErrorResponse,
    TokenValidationResponse
)

from .user_models import User, Base
from .user_database import user_db_service, UserDatabaseService

from .auth_service import auth_service, AuthenticationService
from .auth_middleware import (
    auth_middleware,
    get_current_user,
    get_current_user_optional,
    require_admin,
    check_token_in_request,
    is_authenticated
)
from .auth_routes import router as auth_router

__all__ = [
    # Models
    "LoginRequest",
    "LoginResponse",
    "UserInfo",
    "TokenData",
    "AuthErrorResponse",
    "TokenValidationResponse",

    # Database Models
    "User",
    "Base",

    # Database Services
    "user_db_service",
    "UserDatabaseService",

    # Services
    "auth_service",
    "AuthenticationService",

    # Middleware
    "auth_middleware",
    "get_current_user",
    "get_current_user_optional",
    "require_admin",
    "check_token_in_request",
    "is_authenticated",

    # Routes
    "auth_router"
]

__version__ = "1.0.0"
__author__ = "Texas Forestation Team" 