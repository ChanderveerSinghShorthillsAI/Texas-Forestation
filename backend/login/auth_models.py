"""
Authentication Models for Texas Forestation Login System

This module contains all Pydantic models used for authentication,
including login requests, responses, tokens, and user data.
"""

from pydantic import BaseModel, Field
from typing import Optional, TYPE_CHECKING
from datetime import datetime

if TYPE_CHECKING:
    pass


class LoginRequest(BaseModel):
    """Model for login request data"""
    username: str = Field(..., min_length=1, max_length=50, description="Username for authentication")
    password: str = Field(..., min_length=1, description="Password for authentication")
    
    class Config:
        json_schema_extra = {
            "example": {
                "username": "user1234",
                "password": "pass123456"
            }
        }


class UserInfo(BaseModel):
    """Model for user information"""
    username: str = Field(..., description="Username")
    is_authenticated: bool = Field(default=True, description="Authentication status")
    login_time: Optional[datetime] = Field(default=None, description="Login timestamp")
    
    class Config:
        json_schema_extra = {
            "example": {
                "username": "user1234",
                "is_authenticated": True,
                "login_time": "2024-01-15T10:30:00"
            }
        }


class LoginResponse(BaseModel):
    """Model for successful login response"""
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration time in seconds")
    user: UserInfo = Field(..., description="User information")
    
    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
                "token_type": "bearer",
                "expires_in": 1800,
                "user": {
                    "username": "user1234",
                    "is_authenticated": True,
                    "login_time": "2024-01-15T10:30:00"
                }
            }
        }


class TokenData(BaseModel):
    """Model for token payload data"""
    username: Optional[str] = None
    expires_at: Optional[datetime] = None


class AuthErrorResponse(BaseModel):
    """Model for authentication error responses"""
    detail: str = Field(..., description="Error message")
    error_code: str = Field(..., description="Error code for client handling")
    
    class Config:
        json_schema_extra = {
            "example": {
                "detail": "Invalid username or password",
                "error_code": "INVALID_CREDENTIALS"
            }
        }


class TokenValidationResponse(BaseModel):
    """Model for token validation response"""
    is_valid: bool = Field(..., description="Whether the token is valid")
    user: Optional[UserInfo] = Field(default=None, description="User info if token is valid")
    expires_in: Optional[int] = Field(default=None, description="Seconds until token expires")
    
    class Config:
        json_schema_extra = {
            "example": {
                "is_valid": True,
                "user": {
                    "username": "user1234",
                    "is_authenticated": True,
                    "login_time": "2024-01-15T10:30:00"
                },
                "expires_in": 1200
            }
        } 