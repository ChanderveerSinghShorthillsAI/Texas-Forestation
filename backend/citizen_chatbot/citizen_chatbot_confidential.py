import re
import asyncio
from typing import Tuple, Optional, List, Dict, Any
from difflib import SequenceMatcher
from datetime import datetime, timedelta
import logging
from sqlalchemy.orm import Session

from .citizen_chatbot_models import ConfidentialQuery, SessionLocal

logger = logging.getLogger(__name__)

# Texas-specific confidential models (simplified like Django version)
CONFIDENTIAL_MODELS = [
    "ForestFireIncident",
    "WildlifeSurveyData", 
    "LandOwnershipData",
    "GovernmentLandData",
    "RestrictedAreaData",
    "InternalReports",
    "ClassifiedData"
]

# Keywords that trigger confidential detection for Texas forestry/agriculture
MODEL_KEYWORDS = {
    "ForestFireIncident": [
        "forest fire incident", "fire report", "wildfire data", "fire damage assessment",
        "fire investigation", "arson case", "fire cause analysis", "firefighting records",
        "fire department report", "emergency response data", "fire incident report"
    ],
    "WildlifeSurveyData": [
        "wildlife survey", "endangered species data", "animal population count", "species tracking",
        "wildlife monitoring", "habitat assessment", "animal movement data", "breeding records",
        "migration patterns", "species inventory", "conservation status report"
    ],
    "PestManagementRecord": [
        "pest management records", "pesticide application", "chemical treatment data", "pest outbreak",
        "insect control records", "disease management", "integrated pest management", "spray records",
        "pest monitoring data", "treatment effectiveness", "chemical usage report"
    ],
    "LandOwnershipData": [
        "land ownership", "property records", "deed information", "land title", "property boundaries",
        "ownership history", "land registry", "property tax records", "cadastral data",
        "land tenure", "property rights", "land use permits"
    ],
    "ConservationAgreement": [
        "conservation agreement", "easement data", "conservation contract", "land conservation",
        "private conservation", "stewardship agreement", "habitat conservation plan",
        "conservation easement", "wildlife corridor agreement", "protected area agreement"
    ],
    "TimberHarvestRecord": [
        "timber harvest", "logging records", "forest cutting", "tree removal permit", "harvest data",
        "timber sales", "logging operation", "cutting permit", "forest management plan",
        "silviculture records", "timber volume", "harvest scheduling"
    ],
    "WaterRightsData": [
        "water rights", "water allocation", "irrigation permits", "water usage rights", "water license",
        "riparian rights", "water appropriation", "groundwater rights", "surface water rights",
        "water permit", "water allocation agreement", "stream access rights"
    ],
    "GovernmentLandData": [
        "government land", "public land records", "federal land", "state land", "park boundaries",
        "public property", "government property", "federal forest", "state park data",
        "public domain land", "crown land", "municipal land"
    ],
    "EnvironmentalAssessment": [
        "environmental assessment", "environmental impact", "ecological study", "impact assessment",
        "environmental review", "habitat evaluation", "ecological assessment", "biodiversity study",
        "environmental monitoring", "ecosystem analysis", "conservation assessment"
    ],
    "CriticalHabitatData": [
        "critical habitat", "protected habitat", "sensitive area", "endangered habitat",
        "wildlife refuge", "protected ecosystem", "conservation area", "sensitive species habitat",
        "critical ecosystem", "protected species area", "restoration site"
    ],
    "PlantationProject": [
        "plantation project", "reforestation project", "afforestation plan", "tree planting project",
        "forest restoration", "seedling distribution", "nursery operations", "planting schedule",
        "plantation management", "tree establishment", "forest development project"
    ],
    "RestrictedAreaData": [
        "restricted area", "access restriction", "prohibited zone", "closed area", "restricted access",
        "security zone", "off-limits area", "protected zone", "restricted land", "no-access zone",
        "controlled area", "limited access"
    ],
    "BiodiversityReport": [
        "biodiversity report", "species diversity", "ecological diversity", "biodiversity assessment",
        "species richness", "ecosystem diversity", "biological inventory", "biodiversity monitoring",
        "species composition", "ecological survey", "biodiversity index"
    ],
    "AgricultureStatistics": [
        "agriculture statistics", "crop yield data", "farm production data", "agricultural census data",
        "livestock numbers", "farm income data", "agricultural productivity statistics", "crop area statistics",
        "farming statistics", "agricultural survey data", "production statistics", "confidential farm data",
        "private agricultural data", "restricted crop statistics", "internal farm reports"
    ],
    "OffenceData": ["offence", "fir", "case", "crime", "seized" , "offence data" , "data of ofence"],
    "ProjectShapefile": ["shapefile", "project kml", "project file" , "geojson", "project shapefile", "project geojson", "project kml", "project data"],
    "ProjectMonthlyProgress": ["monthly progress", "project status", "physical target", "budget utilization"  ],
    "BlockMaster": ["block", "legal status" , "block master", "block data", "block information" , "block dataset" , "block details", "block master data", "block master information", "block master dataset" , "data of block", "block details data", "block master details"],
    "ForestFireAlert": ["forest fire alert", "fire alert", "fire incident , forest fire data" , "forest fire dataset" , "data of forest fire " , "fire alert data", "fire incident data", "forest fire alert data", "forest fire incident data", "fire alert details", "fire incident details"],
    "ForestFireData": ["fire data", "fire incident data"," block fire" , "fire dataset" , "forest fire data", "fire incident dataset", "forest fire incident dataset", "fire data details", "fire incident details", "forest fire data details", "forest fire incident details"],
    "GeneratedPlan": ["generated plan", "plan document ", "plan file" ],
    "ProduceAuction": [
        "produce auction", "forest produce auction", "forest produce bidding", "auction details",
        "bidding amount", "auctioned produce", "produce auction data", "produce auction records",
        "auction depot", "produce bid", "auction product", "forest produce sale " , "auction" , "bidding" , "bid"
    ],
}

# Non-confidential patterns that should NOT trigger confidentiality detection
NON_CONFIDENTIAL_PATTERNS = [
    r'\bhow\b', r'\bwhat is\b', r'\bwhat are\b', r'\bwhere can\b', r'\bwhere to\b',
    r'\bcontact\b', r'\bemergency\b', r'\bhelpline\b', r'\bcomplain\b', r'\breport\b',
    r'\bpublic\b', r'\bgeneral\b', r'\binformation\b', r'\badvice\b', r'\btips\b',
    r'\bguidelines\b', r'\brecommendations\b', r'\bbest practices\b', r'\btraining\b',
    r'\beducation\b', r'\blearning\b', r'\bworkshop\b', r'\bseminar\b', r'\bsupported\b',
    r'\bhelp\b', r'\bprogram\b', r'\bprograms\b', r'\bassistance\b', r'\bguidance\b'
]

# Texas-specific location patterns that indicate public information requests
TEXAS_PUBLIC_PATTERNS = [
    r'\btexas\b', r'\btx\b', r'\baustin\b', r'\bhouston\b', r'\bdallas\b', r'\bsan antonio\b',
    r'\bfort worth\b', r'\bel paso\b', r'\bpublic forest\b', r'\bstate park\b', r'\bnational forest\b',
    r'\bpublic land\b', r'\bopen access\b', r'\bvisitor center\b', r'\btrail information\b'
]

class TexasConfidentialQueryDetector:
    """Detect confidential queries related to Texas forestry and agriculture"""
    
    def __init__(self, fuzzy_threshold: float = 0.85):
        self.fuzzy_threshold = fuzzy_threshold
        
    def _is_fuzzy_match(self, a: str, b: str) -> bool:
        """Check if two strings are similar enough to be considered a match"""
        return SequenceMatcher(None, a.lower(), b.lower()).ratio() > self.fuzzy_threshold
        
    def _check_non_confidential_patterns(self, query: str) -> bool:
        """Check if query matches non-confidential patterns"""
        query_lower = query.lower()
        
        # Check for general information request patterns
        for pattern in NON_CONFIDENTIAL_PATTERNS:
            if re.search(pattern, query_lower):
                return True
                
        # Check for Texas public information patterns
        for pattern in TEXAS_PUBLIC_PATTERNS:
            if re.search(pattern, query_lower):
                # If it's clearly about public Texas resources, likely not confidential
                if any(public_term in query_lower for public_term in 
                       ['public', 'visitor', 'trail', 'recreation', 'tourism', 'open']):
                    return True
                    
        return False
        
    def detect_confidential_query(self, user_query: str) -> Tuple[bool, Optional[str], float]:
        """
        Detect if a user query is asking for confidential information
        
        Returns:
            Tuple of (is_confidential, detected_model, confidence_score)
        """
        query = user_query.lower().strip()
        words = query.split()
        
        # First check if it's clearly a non-confidential request
        if self._check_non_confidential_patterns(query):
            return False, None, 0.0
            
        max_confidence = 0.0
        detected_model = None
        
        # Check each confidential model and its keywords
        for model, keywords in MODEL_KEYWORDS.items():
            model_confidence = 0.0
            
            for keyword in keywords:
                # Pattern-based matching (exact, plurals)
                patterns = [
                    r"\b" + re.escape(keyword) + r"\b",
                    r"\b" + re.escape(keyword) + r"s\b",
                    r"\b" + re.escape(keyword) + r"es\b",
                ]
                
                for pattern in patterns:
                    if re.search(pattern, query):
                        model_confidence = max(model_confidence, 0.9)
                        break
                
                # Fuzzy matching for each word in the query
                keyword_words = keyword.split()
                for query_word in words:
                    for keyword_word in keyword_words:
                        if self._is_fuzzy_match(query_word, keyword_word):
                            fuzzy_score = SequenceMatcher(None, query_word, keyword_word).ratio()
                            model_confidence = max(model_confidence, fuzzy_score * 0.8)
                            
                # Partial phrase matching
                if keyword in query:
                    model_confidence = max(model_confidence, 0.85)
                    
            # Update global maximum
            if model_confidence > max_confidence:
                max_confidence = model_confidence
                detected_model = model
                
        # Threshold for considering something confidential (raised to reduce false positives)
        is_confidential = max_confidence > 0.9
        
        return is_confidential, detected_model, max_confidence
        
    async def log_confidential_query(
        self, 
        session_id: str, 
        query: str, 
        detected_model: str, 
        confidence_score: float,
        user_ip: Optional[str] = None
    ):
        """Log a detected confidential query for monitoring"""
        db = SessionLocal()
        try:
            confidential_log = ConfidentialQuery(
                session_id=session_id,
                query_text=query,
                detected_model=detected_model,
                confidence_score=confidence_score,
                user_ip=user_ip
            )
            db.add(confidential_log)
            db.commit()
            
            logger.warning(f"🔒 Confidential query logged: model={detected_model}, confidence={confidence_score:.2f}")
            
        except Exception as e:
            logger.error(f"❌ Error logging confidential query: {e}")
            db.rollback()
        finally:
            db.close()
            
    async def get_confidential_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get statistics about confidential query attempts"""
        db = SessionLocal()
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)
            
            recent_queries = db.query(ConfidentialQuery).filter(
                ConfidentialQuery.timestamp >= cutoff_time
            ).all()
            
            # Group by detected model
            model_counts = {}
            for query in recent_queries:
                model = query.detected_model or "unknown"
                model_counts[model] = model_counts.get(model, 0) + 1
                
            return {
                "total_attempts": len(recent_queries),
                "time_period_hours": hours,
                "attempts_by_model": model_counts,
                "average_confidence": sum(q.confidence_score for q in recent_queries) / len(recent_queries) if recent_queries else 0,
                "recent_attempts": [
                    {
                        "timestamp": q.timestamp.isoformat(),
                        "model": q.detected_model,
                        "confidence": q.confidence_score,
                        "query_snippet": q.query_text[:50] + "..." if len(q.query_text) > 50 else q.query_text
                    }
                    for q in recent_queries[-10:]  # Last 10 attempts
                ]
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting confidential stats: {e}")
            return {"error": str(e)}
        finally:
            db.close()

# Global detector instance
confidential_detector = TexasConfidentialQueryDetector()

# Compatibility functions
async def is_query_confidential(user_query: str) -> Tuple[bool, Optional[str]]:
    """
    Check if query is confidential - compatibility function
    Returns (is_confidential, detected_model)
    """
    is_conf, model, confidence = confidential_detector.detect_confidential_query(user_query)
    return is_conf, model

def generate_confidential_response() -> str:
    """Generate standardized response for confidential queries"""
    return (
        "This information is classified or confidential as per Texas Government policy. "
        "You do not have access to this data. Please contact the relevant Texas state department "
        "through official channels for such queries. For general forestry and agriculture information "
        "in Texas, I'm happy to help with publicly available guidance and best practices."
    ) 