import os
import asyncio
import time
import logging
from typing import List, Dict, Any, Optional, AsyncIterator, Tuple
from datetime import datetime, timedelta
import hashlib
import re
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_

from google import genai
from google.genai import types
from dotenv import load_dotenv

from .citizen_chatbot_models import ChatSession, ChatMessage, SessionLocal, ConfidentialQuery
from .citizen_chatbot_confidential import confidential_detector, generate_confidential_response

# Enhanced Google Search integration with proper grounding
HAS_RAG = False

load_dotenv()
logger = logging.getLogger(__name__)

# Configure Gemini AI with new API
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY environment variable is required")

# Create Gemini client
gemini_client = genai.Client(api_key=GOOGLE_API_KEY)

# Configure grounding tool for Google Search
grounding_tool = types.Tool(
    google_search=types.GoogleSearch()
)

# Generation config
generation_config = types.GenerateContentConfig(
    temperature=0.7,
    top_p=0.95,
    top_k=64,
    max_output_tokens=8192,
    tools=[grounding_tool]  # Enable grounding search
)

logger.info("✅ Google Generative AI configured for Gemini 2.5 Pro with Grounding Search")

# Texas-specific system prompt
TEXAS_SYSTEM_PROMPT = """
You are TexasForestGuide, an expert assistant on all topics related to forests, forestry, agriculture, wildlife, plants, crops, livestock, soil, water, conservation, land use, climate, rural development, and environmental science IN TEXAS, USA.

You have in-depth, up-to-date knowledge about Texas-specific flora, fauna, farming methods, agroforestry, government programs, plantation, biodiversity, afforestation, forest laws, climate zones, and field-level practices.

PROVIDE SPECIFIC DATA: Always search comprehensively and provide current, specific information including:
- Exact prices, numbers, statistics, and data points with units ($/lb, $/acre, etc.)
- Contact information (phone numbers, addresses, websites, email addresses)
- Specific dates, deadlines, and timeframes
- Government program details with application procedures and eligibility requirements
- Current market rates and commodity prices from reliable sources (USDA, exchanges, etc.)
- Official contact details for Texas departments and agencies
- Specific locations, addresses, and geographic areas in Texas

SEARCH COMPREHENSIVELY: Perform thorough web searches to find:
- Multiple reliable sources (government agencies, universities, businesses)
- Current articles, reports, and official documents
- Business directories and contact databases
- News reports and press releases
- Academic papers and research studies

IMPORTANT: When providing prices or numerical data, always include:
1. The exact value with units
2. The date of the information
3. The source of the data
4. Any relevant context (grade, quality, location, etc.)

Example: "To report a forest fire in Travis County, call 911 for emergencies or the Travis County Fire Marshal at (512) 854-9720 according to official county sources."

Use your Google Search capabilities extensively to find the most current and accurate data available from multiple sources. Always cite your sources.

IMPORTANT: TEXAS-ONLY POLICY
- You must answer ALL queries ONLY with respect to Texas, USA. Do NOT provide information or data about any other state or region, even if the user requests it.
- If the user's question does NOT mention any state, ALWAYS assume Texas as the context for your answer.
- If the user specifically asks about any other state or region (for example: "What about California?"), politely reply:
"Sorry, I can only provide information about Texas. Please ask your query in the context of Texas."
- You are designed for Texas state agencies and its citizens. Stay within the boundaries of Texas for ALL responses.

You answer questions about:
– Farming, crop cultivation, soil management, fertilizers, irrigation, organic farming, crop diseases, pest management (in Texas context)
– Livestock, animal husbandry, poultry, dairy, veterinary care (in Texas)
– Wildlife, protected areas, endangered species, forest management, afforestation, environmental protection, eco-tourism, wildfire management (specific to Texas)
– Plantation site selection, eco-regions, climate zones, rainfall patterns, groundwater, forest products, climate change impacts (specific to Texas)
– State programs, extension services, conservation practices, monitoring, survey practices, and general data for land use, carbon sequestration, or biodiversity (as applicable in Texas)

TEXAS FORESTRY CONTEXT:
- Texas has 4 major forest regions: East Texas Pineywoods, Post Oak Savannah, Cross Timbers, and Edwards Plateau
- Main tree species: Loblolly Pine, Shortleaf Pine, Longleaf Pine, Post Oak, Live Oak, Bald Cypress, Eastern Red Cedar
- Key forest management challenges: Wildfire, Southern Pine Beetle, Oak Wilt, Drought stress
- Important conservation programs: Texas Forest Service, Private Lands Enhancement Program, Landowner Incentive Program

STRICT CONFIDENTIALITY POLICY:
If a user asks about any information that is classified, confidential, sensitive, internal, or restricted by the Texas Government (such as internal reports, classified datasets, government decisions not made public, internal operations, or any non-public government data), do NOT provide that information, even if the user insists.

Instead, politely reply:
"This information is classified or confidential as per Texas Government policy. You do not have access to this data. Please contact the relevant Texas state department through official channels for such queries."

Do NOT attempt to infer, summarize, or reveal any sensitive or confidential details. Do not provide indirect hints, fabricated answers, or circumstantial information about restricted topics.

DOMAIN-RESTRICTED RESPONSES ONLY:
If you are asked a question that is NOT related to forests, agriculture, plants, animals, rural environment, or natural resources (for example, sports, movies, celebrities, politics, unrelated technology, entertainment, etc.), politely reply:

"I am designed to answer only questions about forests, wildlife, agriculture, farming, environment, and related rural topics in Texas. Please ask me something about those areas."

Do NOT attempt to answer questions outside your domain, even if the user insists. Do not provide generic, off-topic, or fabricated answers.

**LOCATION-BASED QUERIES POLICY**:
- For any query that requires the user's location (for example, "nurseries near me", "nearest forest office", "extension offices in my area", etc.), ALWAYS ask the user to provide their location first if it is not already given in the current or previous messages.
- Politely say: "Please tell me your location in Texas, so I can give you the correct information."
- If the user provides a location, check if it is within Texas. If the location is outside Texas, politely reply:
"Sorry, I can only provide information about locations within Texas. Please enter a Texas city, county, or region."
- Only after receiving a valid Texas location, provide the requested location-based data.

ALWAYS REMEMBER:
– Your default and only context is Texas.
– Never provide data or advice about any other state or region.
– When in doubt, clarify or restrict to Texas.
– Uphold confidentiality and topic/domain restrictions strictly.
– Be helpful, accurate, and supportive for Texas forestry and agriculture needs.
"""

class TexasCitizenChatService:
    """Main chat service for Texas citizen forestry chatbot"""
    
    def __init__(self):
        self.weaviate_client = None
        self.text_chunker = None
        self.is_initialized = False
        self._session_locks: Dict[str, asyncio.Lock] = {}  # per-session creation locks
        self._cleanup_task = None  # Background cleanup task
        # In-memory tracking of async chat requests so responses continue even if client disconnects
        # request_id -> { status: 'in_progress'|'completed'|'error', session_id, user_message, result?, error?, created_at, completed_at? }
        self._pending_requests: Dict[str, Dict[str, Any]] = {}
        
    async def initialize(self):
        """Initialize the chat service"""
        try:
            logger.info("🤖 Initializing Texas Citizen Chat Service with Google Search...")
                
            # No cache to initialize
            
            # Start background cleanup task
            await self.start_cleanup_task()
            
            self.is_initialized = True
            logger.info("✅ Texas Citizen Chat Service initialized")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize chat service: {e}")
            raise
    
    async def cleanup(self):
        """Cleanup resources"""
        try:
            # Stop background cleanup task
            await self.stop_cleanup_task()
            
            logger.info("✅ Chat service cleanup completed")
        except Exception as e:
            logger.error(f"❌ Error during cleanup: {e}")
    
    async def start_cleanup_task(self):
        """Start background task to clean up old sessions and messages"""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
            logger.info("🧹 Started session cleanup task")

    # ===== Async chat request management =====
    async def start_async_request(self, user_message: str, session_id: str, user_ip: Optional[str] = None) -> str:
        """Start processing a chat request in the background and return a request_id."""
        import uuid, time as _time
        request_id = str(uuid.uuid4())
        self._pending_requests[request_id] = {
            "status": "in_progress",
            "session_id": session_id,
            "user_message": user_message,
            "created_at": _time.time(),
        }

        async def _run():
            try:
                # Consume the async generator and build full response
                full_chunks: list[str] = []
                async for chunk in self.process_user_message(user_message, session_id, user_ip):
                    chunk_type = chunk.get("type")
                    if chunk_type in ("text", "message", "citation", "source", "sources_header"):
                        content = chunk.get("content", "")
                        if content:
                            full_chunks.append(content)
                full_text = "".join(full_chunks)
                self._pending_requests[request_id].update({
                    "status": "completed",
                    "result": full_text,
                    "completed_at": _time.time(),
                })
            except Exception as e:
                logger.error(f"❌ Async chat request failed: {e}")
                self._pending_requests[request_id].update({
                    "status": "error",
                    "error": str(e),
                    "completed_at": _time.time(),
                })

        # schedule background processing without awaiting
        asyncio.create_task(_run())
        return request_id

    async def get_request_status(self, request_id: str) -> Dict[str, Any]:
        """Return status for a previously started async request."""
        req = self._pending_requests.get(request_id)
        if not req:
            return {"status": "not_found"}
        # Do not return the full result body here by default
        return {
            "status": req.get("status"),
            "session_id": req.get("session_id"),
            "created_at": req.get("created_at"),
            "completed_at": req.get("completed_at"),
            "has_result": "result" in req,
            "error": req.get("error"),
        }

    async def get_request_result(self, request_id: str) -> Dict[str, Any]:
        """Return the final result if available for an async request."""
        req = self._pending_requests.get(request_id)
        if not req:
            return {"status": "not_found"}
        resp: Dict[str, Any] = {"status": req.get("status")}
        if req.get("status") == "completed":
            resp["result"] = req.get("result", "")
        elif req.get("status") == "error":
            resp["error"] = req.get("error")
        return resp
    
    async def stop_cleanup_task(self):
        """Stop background cleanup task"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None
            logger.info("🛑 Stopped session cleanup task")
    
    async def _periodic_cleanup(self):
        """Background task to periodically clean up old sessions and messages"""
        while True:
            try:
                # Run cleanup every 2 hours (more frequent for aggressive cleanup)
                await asyncio.sleep(2 * 3600)  
                
                logger.info("🧹 Running periodic cleanup...")
                
                # Delete sessions older than 24 hours (aggressive cleanup)
                old_stats = await self.cleanup_old_sessions(older_than_days=1)  # 1 day = 24 hours
                
                if old_stats.get('sessions_deleted', 0) > 0:
                    logger.info(f"🧹 Periodic cleanup completed: {old_stats.get('sessions_deleted', 0)} sessions and {old_stats.get('messages_deleted', 0)} messages deleted after 24 hours")
                
            except asyncio.CancelledError:
                logger.info("🛑 Session cleanup task cancelled")
                break
            except Exception as e:
                logger.error(f"❌ Unexpected error in session cleanup task: {e}")
    
    async def cleanup_old_sessions(self, older_than_days: int = 1) -> Dict[str, int]:
        """
        Clean up old chat sessions and their messages
        Returns: dict with cleanup statistics
        """
        db = SessionLocal()
        try:
            cutoff_time = datetime.now() - timedelta(days=older_than_days)
            
            # Find old sessions
            old_sessions = db.query(ChatSession).filter(
                ChatSession.last_activity < cutoff_time
            ).all()
            
            sessions_deleted = 0
            messages_deleted = 0
            
            for session in old_sessions:
                # Count messages before deletion (cascade will delete them)
                message_count = db.query(ChatMessage).filter(
                    ChatMessage.session_id == session.id
                ).count()
                
                messages_deleted += message_count
                
                # Delete session (messages will be cascade deleted)
                db.delete(session)
                sessions_deleted += 1
            
            db.commit()
            
            stats = {
                "sessions_deleted": sessions_deleted,
                "messages_deleted": messages_deleted,
                "cutoff_date": cutoff_time.isoformat()
            }
            
            if sessions_deleted > 0:
                logger.info(f"🧹 Cleaned up {sessions_deleted} old sessions and {messages_deleted} messages (older than {older_than_days} days)")
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Error cleaning up old sessions: {e}")
            db.rollback()
            return {"error": str(e), "sessions_deleted": 0, "messages_deleted": 0}
        finally:
            db.close()
    
    async def cleanup_inactive_sessions(self, inactive_hours: int = 24) -> Dict[str, int]:
        """
        Clean up sessions that have been inactive for specified hours
        Returns: dict with cleanup statistics
        """
        db = SessionLocal()
        try:
            cutoff_time = datetime.now() - timedelta(hours=inactive_hours)
            
            # Find inactive sessions
            inactive_sessions = db.query(ChatSession).filter(
                and_(
                    ChatSession.is_active == True,
                    ChatSession.last_activity < cutoff_time
                )
            ).all()
            
            sessions_marked_inactive = 0
            
            for session in inactive_sessions:
                session.is_active = False
                sessions_marked_inactive += 1
            
            db.commit()
            
            stats = {
                "sessions_marked_inactive": sessions_marked_inactive,
                "cutoff_date": cutoff_time.isoformat()
            }
            
            if sessions_marked_inactive > 0:
                logger.info(f"🔒 Marked {sessions_marked_inactive} sessions as inactive (inactive for {inactive_hours} hours)")
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Error marking sessions inactive: {e}")
            db.rollback()
            return {"error": str(e), "sessions_marked_inactive": 0}
        finally:
            db.close()
    
    async def get_storage_stats(self) -> Dict[str, Any]:
        """Get database storage statistics"""
        db = SessionLocal()
        try:
            # Count active sessions
            active_sessions = db.query(ChatSession).filter(
                ChatSession.is_active == True
            ).count()
            
            # Count total sessions
            total_sessions = db.query(ChatSession).count()
            
            # Count total messages
            total_messages = db.query(ChatMessage).count()
            
            # Count confidential queries
            total_confidential = db.query(ConfidentialQuery).count()
            
            # Get oldest and newest sessions
            oldest_session = db.query(ChatSession).order_by(
                ChatSession.started_at.asc()
            ).first()
            
            newest_session = db.query(ChatSession).order_by(
                ChatSession.started_at.desc()
            ).first()
            
            stats = {
                "active_sessions": active_sessions,
                "total_sessions": total_sessions,
                "inactive_sessions": total_sessions - active_sessions,
                "total_messages": total_messages,
                "total_confidential_queries": total_confidential,
                "oldest_session_date": oldest_session.started_at.isoformat() if oldest_session else None,
                "newest_session_date": newest_session.started_at.isoformat() if newest_session else None,
                "average_messages_per_session": round(total_messages / total_sessions, 2) if total_sessions > 0 else 0
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Error getting storage stats: {e}")
            return {"error": str(e)}
        finally:
            db.close()
    
    def _create_session_id(self, user_ip: str, user_agent: str) -> str:
        """Create a unique session ID based on user info"""
        session_data = f"{user_ip}_{user_agent}_{datetime.now().date()}"
        return hashlib.md5(session_data.encode()).hexdigest()
    
    async def get_or_create_session(self, user_ip: str, user_agent: str) -> str:
        """Get existing session or create new one - return session_id string.
        Concurrency-safe to avoid UNIQUE constraint errors on session_id.
        """
        session_id = self._create_session_id(user_ip, user_agent)
        
        # Ensure a per-session async lock exists
        lock = self._session_locks.get(session_id)
        if lock is None:
            lock = asyncio.Lock()
            self._session_locks[session_id] = lock
        
        async with lock:
            db = SessionLocal()
            try:
                # Try to find any session with this session_id (active or inactive)
                session = db.query(ChatSession).filter(
                    ChatSession.session_id == session_id
                ).first()
                
                if session:
                    # Reactivate and bump activity
                    session.is_active = True
                    session.update_activity()
                    db.commit()
                    return session_id
                
                # Create new session
                session = ChatSession(
                    session_id=session_id,
                    user_ip=user_ip,
                    user_agent=user_agent[:500]
                )
                db.add(session)
                try:
                    db.commit()
                except IntegrityError:
                    # Race: another coroutine created it; reuse existing
                    db.rollback()
                    existing = db.query(ChatSession).filter(
                        ChatSession.session_id == session_id
                    ).first()
                    if existing:
                        return session_id
                    raise
                logger.info(f"🆕 Created new chat session: {session_id}")
                return session_id
            
            except Exception as e:
                logger.error(f"❌ Error managing session: {e}")
                db.rollback()
                raise
            finally:
                db.close()
    
    async def get_chat_history(self, session_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent chat history for a session"""
        db = SessionLocal()
        try:
            # Look up internal session UUID by external session_id hash
            session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
            if not session:
                return []
            
            messages = db.query(ChatMessage).filter(
                ChatMessage.session_id == session.id
            ).order_by(ChatMessage.timestamp.desc()).limit(limit * 2).all()
            
            # Convert to format expected by frontend
            history = []
            for msg in reversed(messages):  # Reverse to get chronological order
                history.append({
                    "role": "user" if msg.role == "user" else "model",
                    "text": msg.content
                })
            
            return history[-limit:] if len(history) > limit else history
            
        except Exception as e:
            logger.error(f"❌ Error getting chat history: {e}")
            return []
        finally:
            db.close()
    
    async def clear_chat_history(self, session_id: str) -> bool:
        """Clear chat history for a session"""
        db = SessionLocal()
        try:
            # Mark session as inactive and delete messages
            session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
            if session:
                session.is_active = False
                session.message_count = 0
                
                # Delete messages
                db.query(ChatMessage).filter(ChatMessage.session_id == session.id).delete()
                db.commit()
                
                logger.info(f"🧹 Cleared chat history for session: {session_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"❌ Error clearing chat history: {e}")
            db.rollback()
            return False
        finally:
            db.close()
    

    
    def _normalize_citations(self, text: str) -> str:
        """Normalize citation format in response text (Django-style)"""
        # [ [1](url) ] => [1](url)
        text = re.sub(r'\[\s*(\[\d+\]\([^)]+\))\s*\]', r'\1', text)
        # 1(http://url) or 1 (http://url) => [1](http://url)
        text = re.sub(r'\b(\d+)\s*\((https?://[^\)]+)\)', r'[\1](\2)', text)
        return text
    
    def _add_citations_to_text(self, response_object) -> str:
        """
        Add citations to text based on grounding supports
        Based on official Google documentation
        """
        try:
            # Check if response has required data
            if not hasattr(response_object, 'text') or not response_object.text:
                logger.warning("⚠️ No text in response for citation insertion")
                return ""
            
            text = response_object.text
            
            # Check for candidates and grounding metadata
            if not hasattr(response_object, 'candidates') or not response_object.candidates:
                return text
            
            candidate = response_object.candidates[0]
            
            if not hasattr(candidate, 'grounding_metadata') or not candidate.grounding_metadata:
                return text
            
            grounding_metadata = candidate.grounding_metadata
            
            # Check for grounding supports and chunks
            if not hasattr(grounding_metadata, 'grounding_supports') or not grounding_metadata.grounding_supports:
                logger.info("ℹ️ No grounding supports found for inline citations")
                return text
            
            if not hasattr(grounding_metadata, 'grounding_chunks') or not grounding_metadata.grounding_chunks:
                logger.info("ℹ️ No grounding chunks found for inline citations")
                return text
            
            supports = grounding_metadata.grounding_supports
            chunks = grounding_metadata.grounding_chunks
            
            logger.info(f"📍 Found {len(supports)} grounding supports and {len(chunks)} chunks")
            
            # Sort supports by end_index in descending order to avoid shifting issues when inserting
            sorted_supports = sorted(supports, key=lambda s: s.segment.end_index, reverse=True)
            
            for support in sorted_supports:
                try:
                    end_index = support.segment.end_index
                    
                    if hasattr(support, 'grounding_chunk_indices') and support.grounding_chunk_indices:
                        # Create citation string like [1](link1), [2](link2)
                        citation_links = []
                        for i in support.grounding_chunk_indices:
                            if i < len(chunks):
                                chunk = chunks[i]
                                if hasattr(chunk, 'web') and chunk.web and hasattr(chunk.web, 'uri'):
                                    uri = chunk.web.uri
                                    citation_links.append(f"[{i + 1}]({uri})")
                        
                        if citation_links:
                            citation_string = " " + ", ".join(citation_links)
                            # Insert citation at end_index
                            text = text[:end_index] + citation_string + text[end_index:]
                            logger.info(f"📎 Inserted citation at position {end_index}: {citation_string}")
                except Exception as support_error:
                    logger.error(f"❌ Error processing support: {support_error}")
                    continue
            
            return text
            
        except Exception as e:
            logger.error(f"❌ Error adding citations to text: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            return response_object.text if hasattr(response_object, 'text') else ""
    
    def _add_inline_citations(self, text: str, citations: List[Dict[str, str]]) -> str:
        """Add inline citation numbers [1], [2] to the response text"""
        if not citations:
            return text
            
        # Simple approach: add citations to sentences with specific information
        lines = text.split('\n')
        citation_index = 0
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line or citation_index >= len(citations):
                continue
                
            # Add citations to lines with specific contact information or data
            should_cite = any(keyword in line.lower() for keyword in [
                '817-', '972-', '469-', '512-', '(817)', '(972)', '(469)', '(512)',
                'phone', 'call', 'contact', 'dial', 'email', '@', '.com', '.gov', '.org',
                'office', 'department', 'marshal', 'sheriff', 'dispatch', 'crimestoppers',
                'cents per pound', 'price', '$', 'cost', 'according to', 'reports'
            ])
            
            if should_cite:
                # Add citation at the end of the line
                if line.endswith('.'):
                    lines[i] = line[:-1] + f" [{citations[citation_index]['number']}]."
                else:
                    lines[i] = line + f" [{citations[citation_index]['number']}]"
                citation_index += 1
        
        return '\n'.join(lines)
    
    def _extract_citations(self, response_object) -> List[Dict[str, str]]:
        """Extract citations from Gemini response - Using official Google grounding API"""
        logger.info("🔍 Starting citation extraction...")
        citations = []
        try:
            # Check if response has candidates
            if not hasattr(response_object, 'candidates') or not response_object.candidates:
                logger.warning("⚠️ No candidates found in response")
                return citations
            
            candidate = response_object.candidates[0]
            
            # Check for grounding metadata
            if not hasattr(candidate, 'grounding_metadata') or not candidate.grounding_metadata:
                logger.warning("⚠️ No grounding_metadata found")
                return citations
            
            grounding_metadata = candidate.grounding_metadata
            
            # Check for grounding chunks
            if not hasattr(grounding_metadata, 'grounding_chunks') or not grounding_metadata.grounding_chunks:
                logger.warning("⚠️ No grounding_chunks found")
                return citations
            
            chunks = grounding_metadata.grounding_chunks
            logger.info(f"🔍 Found {len(chunks)} grounding chunks")
            
            # Extract citations from chunks
            for i, chunk in enumerate(chunks):
                try:
                    # Check if chunk has web data
                    if hasattr(chunk, 'web') and chunk.web:
                        uri = getattr(chunk.web, 'uri', None)
                        title = getattr(chunk.web, 'title', None)
                        
                        if uri:
                            # Clean up the title for better display
                            if not title or title.strip() == '':
                                title = f'Source {i + 1}'
                            elif 'usda.gov' in uri.lower():
                                title = 'USDA Agricultural Marketing Service'
                            elif 'barchart.com' in uri.lower():
                                title = 'Barchart Market Data'
                            elif '.edu' in uri.lower():
                                title = title.replace('.edu', ' University')
                            elif '.gov' in uri.lower():
                                if 'Government' not in title:
                                    title = title + ' (Government)'
                            
                            citations.append({
                                "number": i + 1,
                                "url": uri,
                                "title": title
                            })
                            logger.info(f"🔗 Extracted citation {i+1}: {title} - {uri}")
                        else:
                            logger.warning(f"⚠️ Chunk {i+1} has no URI")
                    else:
                        logger.warning(f"⚠️ Chunk {i+1} has no web data")
                except Exception as chunk_error:
                    logger.error(f"❌ Error processing chunk {i+1}: {chunk_error}")
                    continue
                    
        except Exception as e:
            logger.error(f"❌ Citation extraction error: {e}")
            logger.error(f"❌ Citation error type: {type(e).__name__}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            
        logger.info(f"📚 Total extracted citations: {len(citations)}")
        return citations
    

    
    async def _save_message(
        self, 
        session_id: str, 
        role: str, 
        content: str, 
        response_time_ms: float = 0,
        was_cached: bool = False,
        is_confidential: bool = False,
        sources_count: int = 0
    ):
        """Save a chat message to database"""
        db = SessionLocal()
        try:
            # Get the actual session object from database
            session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
            if not session:
                logger.error(f"❌ Session not found: {session_id}")
                return
                
            message = ChatMessage(
                session_id=session.id,
                role=role,
                content=content,
                response_time_ms=response_time_ms,
                was_cached=was_cached,
                is_confidential=is_confidential,
                sources_count=sources_count
            )
            
            if role == "user": # hash the user query to detect if the user is asking the same question again
                message.user_query_hash = hashlib.sha256(content.lower().encode()).hexdigest()
            
            db.add(message)
            
            # Update session stats
            session.message_count += 1
            session.update_activity()
            
            db.commit()
            
        except Exception as e:
            logger.error(f"❌ Error saving message: {e}")
            db.rollback()
        finally:
            db.close()
    
    async def process_user_message(
        self, 
        user_message: str, 
        session_id: str,
        user_ip: Optional[str] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Process user message and yield streaming response chunks
        
        Yields:
            Dict with keys: type, content, metadata
        """
        start_time = time.time()
        
        # Save user message
        await self._save_message(session_id, "user", user_message)
        
        try:
            # Check for confidential query
            is_confidential, detected_model, confidence = confidential_detector.detect_confidential_query(user_message)
            
            if is_confidential:
                logger.warning(f"🔒 Confidential query detected: {detected_model} (confidence: {confidence:.2f})")
                
                # Log confidential query
                await confidential_detector.log_confidential_query(
                    session_id, user_message, detected_model, confidence, user_ip
                )
                
                # Send confidential response
                response_text = generate_confidential_response()
                await self._save_message(session_id, "assistant", response_text, 
                                        response_time_ms=(time.time() - start_time) * 1000,
                                        is_confidential=True)
                
                yield {
                    "type": "message",
                    "content": response_text,
                    "metadata": {"is_confidential": True}
                }
                return
            
            # No caching - generate fresh response every time
            
            # Build conversation for Gemini
            conversation = []
            
            # Add system prompt
            full_prompt = TEXAS_SYSTEM_PROMPT
            
            # Add recent conversation history
            recent_history = await self.get_chat_history(session_id, limit=5)
            for msg in recent_history[:-1]:  # Exclude the current message
                conversation.append(f"Human: {msg['text']}" if msg["role"] == "user" else f"Assistant: {msg['text']}")
            
            # Combine everything for the prompt
            if conversation:
                full_prompt += "\n\nPrevious conversation:\n" + "\n".join(conversation)
            
            full_prompt += f"\n\nHuman: {user_message}\nAssistant:"
            
            # Generate streaming response using new Google Gemini API with grounding
            yield {"type": "typing", "content": "", "metadata": {}}
            await asyncio.sleep(0.2)  # Brief thinking pause
            
            full_response = ""
            last_response_object = None
            chunk_count = 0
            
            # Use new Gemini client API with grounding
            try:
                # Generate content with grounding using new API (streaming)
                all_chunks = []  # Collect all chunks for citation extraction
                
                # Note: The new API doesn't support streaming yet in the same way
                # So we'll use non-streaming and simulate streaming for better UX
                response = gemini_client.models.generate_content(
                    model='gemini-2.0-flash-exp',  # Using flash model for faster responses with grounding
                    contents=full_prompt,
                    config=generation_config
                )
                
                # Store the complete response
                last_response_object = response
                
                # Get the text from response
                if hasattr(response, 'text') and response.text:
                    full_response = response.text
                    
                    # Simulate streaming by sending the text in chunks for better UX
                    chunk_size = 30  # Characters per chunk
                    for i in range(0, len(full_response), chunk_size):
                        chunk_text = full_response[i:i+chunk_size]
                        chunk_count += 1
                        
                        yield {
                            "type": "text",
                            "content": chunk_text,
                            "metadata": {"chunk_number": chunk_count}
                        }
                        await asyncio.sleep(0.02)  # Streaming delay for better UX
                else:
                    logger.warning("⚠️ No text in response")
                    full_response = "I apologize, but I couldn't generate a response. Please try rephrasing your question."
                    yield {
                        "type": "text",
                        "content": full_response,
                        "metadata": {}
                    }
                
            except Exception as gen_error:
                logger.error(f"❌ Error generating content: {gen_error}")
                import traceback
                logger.error(f"❌ Traceback: {traceback.format_exc()}")
                
                full_response = "I apologize, but I encountered an error generating a response. Please try again."
                yield {
                    "type": "text",
                    "content": full_response,
                    "metadata": {}
                }
            
            # Extract citations and add them to the text
            citations = []
            if last_response_object:
                # First, try to add inline citations directly from grounding supports
                try:
                    text_with_inline_citations = self._add_citations_to_text(last_response_object)
                    if text_with_inline_citations and text_with_inline_citations != full_response:
                        full_response = text_with_inline_citations
                        logger.info("✅ Successfully added inline citations from grounding supports")
                except Exception as e:
                    logger.error(f"❌ Error adding inline citations: {e}")
                
                # Extract citation list for sources section
                citations = self._extract_citations(last_response_object)
                
                if citations:
                    await asyncio.sleep(0.1)  # Brief pause before citations
                    
                    # Send sources header
                    yield {
                        "type": "sources_header", 
                        "content": f"\n\n**Sources:**",
                        "metadata": {"sources_count": len(citations)}
                    }
                    
                    # Send each citation as clickable numbered link
                    for citation in citations:
                        yield {
                            "type": "source",
                            "content": f"\n[{citation['number']}] [{citation['title']}]({citation['url']})",
                            "metadata": {
                                "source_number": citation["number"],
                                "url": citation["url"],
                                "title": citation["title"]
                            }
                        }
            
            # Normalize citations format
            normalized_response = self._normalize_citations(full_response)
                
            response_time_ms = (time.time() - start_time) * 1000
            sources_count = len(citations) if 'citations' in locals() else 0
            
            # No caching - skip cache storage
            
            # Save assistant message
            await self._save_message(session_id, "assistant", normalized_response,
                                    response_time_ms=response_time_ms,
                                    sources_count=sources_count)
            
        except Exception as e:
            logger.error(f"❌ Error processing message: {e}")
            error_response = "I apologize, but I encountered an error processing your request. Please try again or rephrase your question."
            
            await self._save_message(session_id, "assistant", error_response,
                                    response_time_ms=(time.time() - start_time) * 1000)
            
            yield {
                "type": "error",
                "content": error_response,
                "metadata": {"error": str(e)}
            }

# Global chat service instance
chat_service = TexasCitizenChatService() 