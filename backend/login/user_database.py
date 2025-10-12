"""
User Database Service for Texas Forestation Authentication System

Professional database service with connection management, 
error handling, and user operations for PostgreSQL
"""

import os
import sys
import logging
from typing import Optional, List
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from contextlib import contextmanager

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from postgres_config import get_database_url

from .user_models import Base, User

logger = logging.getLogger(__name__)

class UserDatabaseService:
    """
    Professional database service for user management
    
    Provides secure user operations with proper error handling,
    connection management, and transaction support.
    """
    
    def __init__(self, db_path: str = None):
        """
        Initialize database service
        
        Args:
            db_path: Deprecated parameter, kept for backwards compatibility
        """
        self.engine = None
        self.Session = None
        self._initialize_database()
    
    def _initialize_database(self):
        """Initialize database connection and create tables"""
        try:
            # Create SQLAlchemy engine for PostgreSQL with connection pooling
            database_url = get_database_url()
            self.engine = create_engine(
                database_url,
                pool_pre_ping=True,  # Verify connections before use
                pool_recycle=300,    # Recycle connections every 5 minutes
                pool_size=10,
                max_overflow=20,
                echo=False           # Set to True for SQL debugging
            )
            
            # Create session factory
            self.Session = sessionmaker(bind=self.engine)
            
            # Create tables if they don't exist
            self._create_tables()
            
            logger.info("✅ User database service initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize user database: {e}")
            raise
    
    def _create_tables(self):
        """Create user tables in the database"""
        try:
            # Create all tables defined in the Base metadata
            Base.metadata.create_all(self.engine)
            logger.info("✅ User tables created/verified successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to create user tables: {e}")
            raise
    
    @contextmanager
    def get_session(self):
        """
        Context manager for database sessions with automatic cleanup
        
        Yields:
            Session: SQLAlchemy session
        """
        session = self.Session()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            session.close()
    
    def create_user(self, username: str, password: str) -> Optional[User]:
        """
        Create a new user with hashed password
        
        Args:
            username: Unique username
            password: Plain text password (will be hashed)
            
        Returns:
            User object if created successfully, None otherwise
        """
        try:
            with self.get_session() as session:
                # Check if user already exists
                existing_user = session.query(User).filter_by(username=username).first()
                if existing_user:
                    logger.warning(f"User '{username}' already exists")
                    return None
                
                # Create new user
                user = User(username=username, password=password)
                session.add(user)
                session.flush()  # Get the ID without committing
                
                # Store user data before expunging
                user_id = user.id
                user_username = user.username
                user_created_at = user.created_at
                user_is_active = user.is_active
                
                # Expunge to make it detached but usable
                session.expunge(user)
                
                logger.info(f"✅ Created user: {user_username} (ID: {user_id})")
                return user
                
        except IntegrityError as e:
            logger.error(f"❌ Username '{username}' already exists: {e}")
            return None
        except SQLAlchemyError as e:
            logger.error(f"❌ Database error creating user '{username}': {e}")
            return None
        except Exception as e:
            logger.error(f"❌ Unexpected error creating user '{username}': {e}")
            return None
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        """
        Retrieve user by username
        
        Args:
            username: Username to search for
            
        Returns:
            User object if found, None otherwise
        """
        try:
            with self.get_session() as session:
                user = session.query(User).filter_by(username=username).first()
                if user:
                    # Detach from session to avoid lazy loading issues
                    session.expunge(user)
                return user
                
        except SQLAlchemyError as e:
            logger.error(f"❌ Database error retrieving user '{username}': {e}")
            return None
        except Exception as e:
            logger.error(f"❌ Unexpected error retrieving user '{username}': {e}")
            return None
    
    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """
        Retrieve user by ID
        
        Args:
            user_id: User ID to search for
            
        Returns:
            User object if found, None otherwise
        """
        try:
            with self.get_session() as session:
                user = session.query(User).filter_by(id=user_id).first()
                if user:
                    session.expunge(user)
                return user
                
        except SQLAlchemyError as e:
            logger.error(f"❌ Database error retrieving user ID {user_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"❌ Unexpected error retrieving user ID {user_id}: {e}")
            return None
    
    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """
        Authenticate user with username and password
        
        Args:
            username: Username to authenticate
            password: Plain text password
            
        Returns:
            User object if authentication successful, None otherwise
        """
        try:
            with self.get_session() as session:
                user = session.query(User).filter_by(username=username).first()
                
                if not user:
                    logger.warning(f"Authentication failed: User '{username}' not found")
                    return None
                
                if not user.is_active:
                    logger.warning(f"Authentication failed: User '{username}' is deactivated")
                    return None
                
                if user.is_account_locked():
                    logger.warning(f"Authentication failed: User '{username}' account is locked")
                    user.record_login_failure()
                    return None
                
                if user.verify_password(password):
                    user.record_login_success()
                    session.expunge(user)
                    logger.info(f"✅ Authentication successful for user '{username}'")
                    return user
                else:
                    user.record_login_failure()
                    logger.warning(f"❌ Authentication failed for user '{username}': Invalid password")
                    return None
                    
        except SQLAlchemyError as e:
            logger.error(f"❌ Database error during authentication for '{username}': {e}")
            return None
        except Exception as e:
            logger.error(f"❌ Unexpected error during authentication for '{username}': {e}")
            return None
    
    def update_user_password(self, username: str, new_password: str) -> bool:
        """
        Update user password
        
        Args:
            username: Username to update
            new_password: New plain text password
            
        Returns:
            True if updated successfully, False otherwise
        """
        try:
            with self.get_session() as session:
                user = session.query(User).filter_by(username=username).first()
                if not user:
                    logger.warning(f"Cannot update password: User '{username}' not found")
                    return False
                
                user.update_password(new_password)
                logger.info(f"✅ Password updated for user '{username}'")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"❌ Database error updating password for '{username}': {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error updating password for '{username}': {e}")
            return False
    
    def deactivate_user(self, username: str) -> bool:
        """
        Deactivate user account
        
        Args:
            username: Username to deactivate
            
        Returns:
            True if deactivated successfully, False otherwise
        """
        try:
            with self.get_session() as session:
                user = session.query(User).filter_by(username=username).first()
                if not user:
                    logger.warning(f"Cannot deactivate: User '{username}' not found")
                    return False
                
                user.is_active = False
                logger.info(f"✅ User '{username}' deactivated")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"❌ Database error deactivating user '{username}': {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error deactivating user '{username}': {e}")
            return False
    
    def get_all_users(self) -> List[User]:
        """
        Get all users in the system
        
        Returns:
            List of User objects
        """
        try:
            with self.get_session() as session:
                users = session.query(User).all()
                # Detach all users from session
                for user in users:
                    session.expunge(user)
                return users
                
        except SQLAlchemyError as e:
            logger.error(f"❌ Database error retrieving all users: {e}")
            return []
        except Exception as e:
            logger.error(f"❌ Unexpected error retrieving all users: {e}")
            return []
    
    def get_user_count(self) -> int:
        """
        Get total number of users
        
        Returns:
            Number of users in the system
        """
        try:
            with self.get_session() as session:
                count = session.query(User).count()
                return count
                
        except SQLAlchemyError as e:
            logger.error(f"❌ Database error getting user count: {e}")
            return 0
        except Exception as e:
            logger.error(f"❌ Unexpected error getting user count: {e}")
            return 0
    
    def health_check(self) -> bool:
        """
        Check database connectivity and health
        
        Returns:
            True if database is healthy, False otherwise
        """
        try:
            with self.get_session() as session:
                # Simple query to test connectivity
                result = session.execute(text("SELECT 1")).scalar()
                return result == 1
                
        except Exception as e:
            logger.error(f"❌ Database health check failed: {e}")
            return False


# Global database service instance
user_db_service = UserDatabaseService() 