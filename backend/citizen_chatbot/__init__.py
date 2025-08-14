"""
Texas Citizen Chatbot Package

A comprehensive AI-powered chatbot system designed specifically for Texas forestry, 
agriculture, and environmental topics.

Components:
- citizen_chatbot_models: Database models and session management
- citizen_chatbot_service: Core chat service with AI integration
- citizen_chatbot_websocket: WebSocket handler for real-time communication
- citizen_chatbot_http: HTTP endpoints and fallback mechanisms
- citizen_chatbot_cache: Enhanced caching system
- citizen_chatbot_confidential: Security and confidential query detection
"""

__version__ = "1.0.0"
__author__ = "Texas Forestation Team"

# Import main components for easy access
from .citizen_chatbot_service import chat_service
from .citizen_chatbot_models import init_database

__all__ = [
    "chat_service",
    "init_database"
] 