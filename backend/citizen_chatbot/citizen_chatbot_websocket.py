import json
import asyncio
import logging
from typing import Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState

from .citizen_chatbot_service import chat_service
from .citizen_chatbot_models import init_database

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for the citizen chatbot"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_sessions: Dict[str, str] = {}  # websocket_id -> session_id
    
    async def connect(self, websocket: WebSocket, connection_id: str):
        """Accept and store a new WebSocket connection"""
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        logger.info(f"🔌 WebSocket connected: {connection_id}")
        
        # Small delay to ensure connection is fully established before sending greeting
        # This helps prevent race conditions with client-side connection handling
        await asyncio.sleep(0.1)
        
        # Send initial greeting only if still connected
        if websocket.client_state == WebSocketState.CONNECTED:
            await self.send_message(connection_id, {
                "type": "message",
                "content": "Hello! I'm TexasForestGuide, your assistant for forestry, agriculture, and environmental topics in Texas. How can I help you today?",
                "metadata": {"is_greeting": True}
            })
        else:
            logger.warning(f"⚠️ WebSocket {connection_id} disconnected before greeting could be sent")
    
    def disconnect(self, connection_id: str):
        """Remove a WebSocket connection"""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        if connection_id in self.connection_sessions:
            del self.connection_sessions[connection_id]
        logger.info(f"🔌 WebSocket disconnected: {connection_id}")
    
    async def send_message(self, connection_id: str, message: Dict[str, Any]):
        """Send a message to a specific WebSocket connection"""
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            if websocket.client_state == WebSocketState.CONNECTED:
                try:
                    await websocket.send_text(json.dumps(message))
                    return True
                except Exception as e:
                    logger.error(f"❌ Error sending WebSocket message: {e}")
                    self.disconnect(connection_id)
        return False
    
    async def send_error(self, connection_id: str, error_message: str):
        """Send an error message to a WebSocket connection"""
        await self.send_message(connection_id, {
            "type": "error",
            "content": error_message,
            "metadata": {}
        })

# Global connection manager
manager = ConnectionManager()

async def handle_websocket_connection(websocket: WebSocket):
    """
    Handle WebSocket connection for citizen chatbot
    This function should be called from your main FastAPI WebSocket endpoint
    """
    # Generate connection ID
    connection_id = f"ws_{id(websocket)}"
    
    try:
        # Initialize database if not already done
        init_database()
        
        # Initialize chat service if not already done
        if not chat_service.is_initialized:
            await chat_service.initialize()
        
        # Accept connection and send greeting
        await manager.connect(websocket, connection_id)
        
        # Get client info
        client_host = websocket.client.host if websocket.client else "unknown"
        user_agent = ""
        
        # Try to get user agent from headers
        if hasattr(websocket, 'headers'):
            user_agent = websocket.headers.get('user-agent', '')
        
        # Create or get chat session
        session_id = await chat_service.get_or_create_session(client_host, user_agent)
        manager.connection_sessions[connection_id] = session_id
        
        logger.info(f"🆕 WebSocket session created/retrieved: {session_id}")
        
        # Main message loop
        while True:
            try:
                # Wait for message from client
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                logger.info(f"📨 WebSocket message received: {message_data}")
                
                # Extract message content
                user_message = message_data.get('message', '').strip()
                if not user_message:
                    await manager.send_error(connection_id, "No message provided")
                    continue
                
                # Process message and stream response
                await process_chat_message(connection_id, user_message, session_id, client_host)
                
            except json.JSONDecodeError as e:
                logger.error(f"❌ Invalid JSON received: {e}")
                await manager.send_error(connection_id, "Invalid message format")
                
            except WebSocketDisconnect:
                logger.info(f"🔌 WebSocket client disconnected: {connection_id}")
                break
                
            except Exception as e:
                logger.error(f"❌ Error processing WebSocket message: {e}")
                await manager.send_error(connection_id, "Internal server error")
    
    except WebSocketDisconnect:
        logger.info(f"🔌 WebSocket connection closed: {connection_id}")
    except Exception as e:
        logger.error(f"❌ WebSocket connection error: {e}")
    finally:
        manager.disconnect(connection_id)

async def process_chat_message(connection_id: str, user_message: str, session_id: str, user_ip: str):
    """Process a chat message and stream the response via WebSocket"""
    try:
        # Process message through chat service
        async for response_chunk in chat_service.process_user_message(user_message, session_id, user_ip):
            # Send each chunk as it's generated
            success = await manager.send_message(connection_id, response_chunk)
            if not success:
                logger.warning(f"⚠️ Failed to send response chunk to {connection_id}")
                break
            
            # Small delay to prevent overwhelming the client
            await asyncio.sleep(0.01)
            
    except Exception as e:
        logger.error(f"❌ Error in process_chat_message: {e}")
        await manager.send_error(connection_id, f"Error processing message: {str(e)}")

async def handle_clear_history(connection_id: str):
    """Handle request to clear chat history"""
    try:
        if connection_id in manager.connection_sessions:
            session_id = manager.connection_sessions[connection_id]
            success = await chat_service.clear_chat_history(session_id)
            
            if success:
                await manager.send_message(connection_id, {
                    "type": "history_cleared",
                    "content": "Chat history has been cleared.",
                    "metadata": {"success": True}
                })
                
                # Send new greeting
                await manager.send_message(connection_id, {
                    "type": "message", 
                    "content": "Hello! I'm TexasForestGuide, your assistant for forestry, agriculture, and environmental topics in Texas. How can I help you today?",
                    "metadata": {"is_greeting": True}
                })
            else:
                await manager.send_error(connection_id, "Failed to clear chat history")
        else:
            await manager.send_error(connection_id, "No active session found")
            
    except Exception as e:
        logger.error(f"❌ Error clearing history: {e}")
        await manager.send_error(connection_id, "Error clearing chat history")

# Additional utility functions for WebSocket management

async def get_connection_stats() -> Dict[str, Any]:
    """Get statistics about active WebSocket connections"""
    return {
        "active_connections": len(manager.active_connections),
        "active_sessions": len(manager.connection_sessions),
        "connection_ids": list(manager.active_connections.keys())
    }

async def broadcast_message(message: Dict[str, Any], exclude_connection: str = None):
    """Broadcast a message to all active connections (admin feature)"""
    sent_count = 0
    for connection_id in list(manager.active_connections.keys()):
        if connection_id != exclude_connection:
            success = await manager.send_message(connection_id, message)
            if success:
                sent_count += 1
    
    logger.info(f"📢 Broadcasted message to {sent_count} connections")
    return sent_count

async def close_connection(connection_id: str, reason: str = "Connection closed by server"):
    """Close a specific WebSocket connection"""
    if connection_id in manager.active_connections:
        websocket = manager.active_connections[connection_id]
        try:
            await websocket.close(code=1000, reason=reason)
        except Exception as e:
            logger.error(f"❌ Error closing WebSocket {connection_id}: {e}")
        finally:
            manager.disconnect(connection_id)
        return True
    return False

async def send_typing_indicator(connection_id: str, is_typing: bool = True):
    """Send typing indicator to a specific connection"""
    await manager.send_message(connection_id, {
        "type": "typing" if is_typing else "stop_typing",
        "content": "",
        "metadata": {"is_typing": is_typing}
    }) 