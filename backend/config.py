"""
Configuration settings for the Texas Plantation Plan Generator
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Application configuration"""
    
    # Google Gemini API Configuration
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
    
    # Weaviate Cloud Configuration
    WEAVIATE_CLUSTER_URL = os.getenv(
        "WEAVIATE_CLUSTER_URL",  
        "YOUR_NEW_CLUSTER_URL.weaviate.cloud"  # Replace with your new cluster URL
    )
    WEAVIATE_API_KEY = os.getenv(
        "WEAVIATE_API_KEY",
        "YOUR_NEW_API_KEY"  # Replace with your new API key
    )
    
    # Plan Generation Settings
    PLAN_GENERATION_MODEL = os.getenv("PLAN_GENERATION_MODEL", "gemini-1.5-flash")
    PLAN_GENERATION_MODEL_FALLBACK = os.getenv("PLAN_GENERATION_MODEL_FALLBACK", "gemini-1.5-flash")
    MAX_PLAN_PAGES = int(os.getenv("MAX_PLAN_PAGES", "25"))
    EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "384"))
    GEN_MAX_RETRIES = int(os.getenv("GEN_MAX_RETRIES", "3"))
    GEN_RETRY_BACKOFF_SECONDS = float(os.getenv("GEN_RETRY_BACKOFF_SECONDS", "2.0"))
    
    # PDF Generation Settings
    PDF_TEMPLATE_PATH = Path("templates")
    PDF_OUTPUT_PATH = Path("generated_plans")
    
    # RAG Settings
    RAG_TOP_K = int(os.getenv("RAG_TOP_K", "15"))
    RAG_SIMILARITY_THRESHOLD = float(os.getenv("RAG_SIMILARITY_THRESHOLD", "0.7"))
    
    # File paths
    KNOWLEDGE_BASE_PATH = Path("rag_texas_knowledge_base_detailed")
    
    @classmethod
    def validate_config(cls):
        """Validate that required configuration is present"""
        if not cls.GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY is required but not set")
        
        # Create directories if they don't exist
        cls.PDF_OUTPUT_PATH.mkdir(exist_ok=True)
        cls.PDF_TEMPLATE_PATH.mkdir(exist_ok=True)
        
        return True

# Create global config instance
config = Config() 