"""
Texas Plantation Plan Generation Service
Handles RAG-based plan generation using Weaviate and Google Gemini
"""
import os
import json
import logging
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import re

from pinecone import Pinecone, ServerlessSpec
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from io import BytesIO
import base64

from config import config

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# NEW: LangChain PromptTemplate and advanced ReportLab components
from langchain.prompts import PromptTemplate
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus.flowables import KeepTogether
from reportlab.platypus import ListFlowable, ListItem

class PlantationPlanService:
    """Service for generating comprehensive 10-year plantation plans"""
    
    def __init__(self):
        """Initialize the plantation plan service"""
        # Initialize SentenceTransformer for embeddings (same as before with Weaviate)
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.pinecone_client = None
        self.pinecone_index = None
        self.is_initialized = False
        # all-MiniLM-L6-v2 uses 384 dimensions
        self.current_embedding_dim: int = 384
        # Cancellation registry: request_id -> asyncio.Event
        self._cancellations: Dict[str, asyncio.Event] = {}
        # Plan storage: plan_id -> plan_data for preview functionality
        self._stored_plans: Dict[str, Dict[str, Any]] = {}
        # Progress tracking: request_id -> progress_data
        self._progress_store: Dict[str, Dict[str, Any]] = {}
        
        # Configure Gemini
        genai.configure(api_key=config.GOOGLE_API_KEY)
        self.model_primary_name = config.PLAN_GENERATION_MODEL
        self.model_fallback_name = config.PLAN_GENERATION_MODEL_FALLBACK
        self.model = genai.GenerativeModel(self.model_primary_name)
        
        # Ensure output directory exists
        config.PDF_OUTPUT_PATH.mkdir(parents=True, exist_ok=True)
        
        # NEW: Section templates to drive 25+ page output with scenario exploration
        self.section_templates = {
            "executive_and_site": PromptTemplate(
                input_variables=["coordinates", "coverage_data", "nearby_features", "kb_section", "facts_md", "target_pages"],
                template=(
                    "You are a senior ecological restoration and agricultural planning consultant for Texas.\n\n"
                    "LOCATION DETAILS:\n- Coordinates: {coordinates}\n- Coverage Data: {coverage_data}\n- Nearby Features: {nearby_features}\n\n"
                    "KNOWLEDGE BASE HIGHLIGHTS:{kb_section}\n\n"
                    "OBSERVED SITE FACTS (from spatial popup data):\n{facts_md}\n\n"
                    "TASK: Write an Executive Summary and Site Analysis baseline suitable for a government submission.\n"
                    "CONTENT REQUIREMENTS:\n"
                    "- Executive Summary with strategic objectives, expected outcomes, risks, innovation pathways, and clear success metrics.\n"
                    "- Site Analysis including soil, climate, water, vegetation, land use, accessibility, constraints, and permitting considerations.\n"
                    "- Provide quantitative estimates where possible.\n- For each major recommendation, include a short 'Because ... therefore ...' rationale citing specific observed facts.\n"
                    "- Include at least two small tables (site constraints and opportunities).\n"
                    "- Include an assumptions box and key risks table.\n"
                    "- Length target: {target_pages} pages (approx. 1,200–1,800 words).\n\n"
                    "Use clear Markdown headings (#, ##, ###). Do not leave placeholders or empty sections."
                ),
            ),
            "ten_year_plan": PromptTemplate(
                input_variables=["coordinates", "facts_md", "target_pages"],
                template=(
                    "Develop a detailed 10-year implementation plan for the Texas site at {coordinates}.\n"
                    "Break into phases: Years 1-2 (Foundation), 3-4 (Establishment), 5-6 (Growth), 7-8 (Optimization), 9-10 (Maturation).\n"
                    "For each phase provide: objectives, activities, deliverables, KPIs (with target values), resources, and dependencies.\n"
                    "Include community engagement, technology adoption, and monitoring elements.\n"
                    "Ground every key choice in the observed site facts below, explaining the rationale:\n{facts_md}\n"
                    "Include at least one table per phase summarizing KPIs and resources.\n"
                    "Length target: {target_pages} pages (approx. 1,500–2,000 words). Use Markdown headings."
                ),
            ),
            "species_and_agri": PromptTemplate(
                input_variables=["coordinates", "facts_md", "target_pages"],
                template=(
                    "Provide species selection and agricultural integration for the Texas site at {coordinates}.\n"
                    "Include: native tree species (timber, carbon, biodiversity), fast-growing species, drought-resistant crops,\n"
                    "agroforestry combinations, rotation schedules, seasonal calendar, and ecological considerations (pollinators, erosion control).\n"
                    "Reference USDA/TPWD/TFS sources where applicable.\n"
                    "Use the observed site facts to justify choices (soil type, pH, drainage class, rainfall, temperature, elevation, slope, water proximity):\n{facts_md}\n"
                    "Provide at least two tables (species mix and agroforestry combos) and a month-by-month calendar.\n"
                    "Length target: {target_pages} pages. Use Markdown headings."
                ),
            ),
            "economics": PromptTemplate(
                input_variables=["facts_md", "target_pages"],
                template=(
                    "Prepare an Economic Analysis: CAPEX/OPEX by year, revenue projections (timber, crops, carbon credits, eco-tourism),\n"
                    "employment impacts, ROI (NPV/IRR/Payback), and sensitivity analysis for key variables.\n"
                    "Provide tables where relevant using Markdown.\n"
                    "Reference site facts influencing costs/revenues (e.g., irrigation need from rainfall, soil fertility, access):\n{facts_md}\n"
                    "Include assumptions and a break-even analysis.\n"
                    "Length target: {target_pages} pages (1,000–1,500 words)."
                ),
            ),
            "employment_social": PromptTemplate(
                input_variables=["facts_md", "target_pages"],
                template=(
                    "Detail Employment & Social Impact: job categories, skill development, gender inclusion, community benefits,\n"
                    "infrastructure improvements, and social safeguards.\n"
                    "Explain how local context inferred from site facts shapes employment and community programs:\n{facts_md}\n"
                    "Include a staffing plan table for years 1–10.\n"
                    "Length target: {target_pages} pages."
                ),
            ),
            "environment_wildlife": PromptTemplate(
                input_variables=["facts_md", "target_pages"],
                template=(
                    "Describe Environmental Impact, Wildlife & Ecosystem Services: carbon sequestration quantification and methodology,\n"
                    "biodiversity enhancements, soil & water conservation, climate change mitigation, and ecosystem services.\n"
                    "Tailor measures to the observed site facts (e.g., erosion if slope high; drought adaptation if rainfall low):\n{facts_md}\n"
                    "Include a mitigation measures table and monitoring indicators.\n"
                    "Length target: {target_pages} pages."
                ),
            ),
            "risk_me": PromptTemplate(
                input_variables=["facts_md", "target_pages"],
                template=(
                    "Provide Risk Management and Monitoring & Evaluation framework: environmental, economic, social risks, mitigations,\n"
                    "KPIs, monitoring technologies (GIS, IoT, drones), and adaptive management.\n"
                    "Include risk rationales referencing site facts (e.g., wildfire risk or flood-prone).\n{facts_md}\n"
                    "Provide a risk register table with likelihood, impact, and owner.\n"
                    "Length target: {target_pages} pages."
                ),
            ),
            "timeline": PromptTemplate(
                input_variables=["facts_md", "target_pages"],
                template=(
                    "Provide a detailed timeline and milestones: month-by-month for years 1-2, quarterly for years 3-5, yearly for years 6-10,\n"
                    "including resource allocation and critical path.\n"
                    "Show dependencies caused by site facts (e.g., rainfall season timings).\n{facts_md}\n"
                    "Include a milestone table with responsible teams.\n"
                    "Length target: {target_pages} pages."
                ),
            ),
            "funding": PromptTemplate(
                input_variables=["facts_md", "target_pages"],
                template=(
                    "Provide Funding & Financing Strategy: grants, subsidies, private investment, green bonds, insurance, PES, impact investing.\n"
                    "Map sources to phases and activities. Reflect cost drivers from site facts.\n{facts_md}\n"
                    "Include a sources-and-uses table.\n"
                    "Length target: {target_pages} pages."
                ),
            ),
            "scenarios_appendix": PromptTemplate(
                input_variables=["facts_md", "target_pages"],
                template=(
                    "Explore scenarios (Conservative, Baseline, Ambitious) with outcomes for cost, revenue, carbon, biodiversity, and jobs.\n"
                    "Include best/worst-case, climate resilience notes, and an Appendix with references and assumptions.\n"
                    "Provide tables and bullet lists where appropriate. Length target: {target_pages} pages."
                    "Ground assumptions in the observed site facts where applicable:\n{facts_md}\n"
                ),
            ),
        }

    
    async def initialize(self):
        """Initialize connections to Pinecone"""
        try:
            # Initialize Pinecone client
            self.pinecone_client = Pinecone(api_key=config.PINECONE_API_KEY)
            
            # Get or create index
            index_name = config.PINECONE_INDEX_NAME
            existing_indexes = [idx.name for idx in self.pinecone_client.list_indexes()]
            
            if index_name not in existing_indexes:
                logger.info(f"🆕 Creating Pinecone index: {index_name}")
                self.pinecone_client.create_index(
                    name=index_name,
                    dimension=config.EMBEDDING_DIMENSION,
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud=config.PINECONE_CLOUD,
                        region=config.PINECONE_ENVIRONMENT
                    )
                )
                logger.info("✅ Created serverless index")
            else:
                logger.info(f"✅ Using existing index: {index_name}")
            
            # Connect to the index
            self.pinecone_index = self.pinecone_client.Index(index_name)
            
            # Test embedding model
            test_embedding = self.embedding_model.encode("test")
            logger.info(f"✅ Embedding model validated - dimension: {len(test_embedding)}")

            self.is_initialized = True
            logger.info("✅ Plantation Plan Service initialized successfully with Pinecone")

        except Exception as e:
            logger.error(f"❌ Failed to initialize Plantation Plan Service: {e}")
            raise


    async def cleanup(self):
        """Clean up resources"""
        # Pinecone client doesn't need explicit cleanup
        self.pinecone_client = None
        self.pinecone_index = None
        # Clear stored plans
        self._stored_plans.clear()
        logger.info("🛑 Pinecone client cleaned up")

    async def store_plan_for_preview(self, plan_data: Dict[str, Any]):
        """Store plan data for later preview and PDF generation"""
        plan_id = plan_data.get('id')
        if plan_id:
            self._stored_plans[plan_id] = plan_data
            logger.info(f"💾 Stored plan for preview: {plan_id}")

    async def get_stored_plan(self, plan_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve stored plan data by ID"""
        return self._stored_plans.get(plan_id)
    
    async def update_progress(self, request_id: str, progress_data: Dict[str, Any]):
        """Update progress for a request"""
        if request_id:
            self._progress_store[request_id] = {
                **progress_data,
                'timestamp': datetime.now().isoformat()
            }
    
    async def get_progress(self, request_id: str) -> Optional[Dict[str, Any]]:
        """Get progress data for a request"""
        return self._progress_store.get(request_id)


    def _format_spatial_data(self, spatial_data: Dict[str, Any]) -> Dict[str, str]:
        """Format spatial query results for prompt inclusion"""
        formatted_data = {}
        
        # Process coordinates (handle camelCase and snake_case)
        coords = None
        if 'clickCoordinates' in spatial_data:
            coords = spatial_data['clickCoordinates']
            formatted_data['coordinates'] = f"Latitude: {coords.get('lat', 'N/A')}, Longitude: {coords.get('lng', 'N/A')}"
        elif 'click_coordinates' in spatial_data:
            coords = spatial_data['click_coordinates']
            formatted_data['coordinates'] = f"Latitude: {coords.get('latitude', 'N/A')}, Longitude: {coords.get('longitude', 'N/A')}"
        
        # Process polygon data (coverage information)
        polygon_summary = []
        polygons = None
        if 'polygonData' in spatial_data:
            polygons = spatial_data['polygonData']
        elif 'polygon_matches' in spatial_data:
            polygons = spatial_data['polygon_matches']
        if polygons:
            for feature in polygons:
                layer_name = feature.get('layerName') or feature.get('layer_name') or feature.get('layer', 'Unknown Layer')
                properties = feature.get('properties', {})
                
                # Extract meaningful properties
                key_properties = []
                for key, value in properties.items():
                    if value and key.lower() not in ['objectid', 'fid', 'shape_leng', 'shape_area']:
                        key_properties.append(f"{key}: {value}")
                
                if key_properties:
                    polygon_summary.append(f"{layer_name} - {', '.join(key_properties[:3])}")
                else:
                    polygon_summary.append(f"{layer_name} - Coverage confirmed")
        
        formatted_data['coverage_data'] = "; ".join(polygon_summary) if polygon_summary else "No coverage data available"
        
        # Process nearest points data
        points_summary = []
        nearest = None
        if 'nearestPoints' in spatial_data:
            nearest = spatial_data['nearestPoints']
        elif 'nearest_points' in spatial_data:
            nearest = spatial_data['nearest_points']
        if nearest:
            for feature in nearest[:5]:  # Top 5 nearest
                layer_name = feature.get('layerName') or feature.get('layer_name') or 'Unknown Layer'
                distance = feature.get('distanceFormatted') or feature.get('distance_formatted') or 'Unknown distance'
                properties = feature.get('properties', {})
                
                # Extract meaningful properties
                key_properties = []
                for key, value in properties.items():
                    if value and key.lower() not in ['objectid', 'fid', 'shape_leng', 'shape_area']:
                        key_properties.append(f"{key}: {value}")
                
                point_info = f"{layer_name} ({distance})"
                if key_properties:
                    point_info += f" - {', '.join(key_properties[:2])}"
                
                points_summary.append(point_info)
        
        formatted_data['nearby_features'] = "; ".join(points_summary) if points_summary else "No nearby features found"
        
        # Add summary statistics
        formatted_data['data_summary'] = f"Coverage layers: {len(polygons or [])}, Nearby features: {len(nearest or [])}"
        
        return formatted_data

    def _extract_site_facts(self, spatial_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract key facts (soil, precipitation, climate, slope, elevation, ph, drainage, water proximity) from spatial properties."""
        def find_keys(props: Dict[str, Any], patterns: List[str]) -> List[str]:
            hits = []
            for k, v in props.items():
                kl = k.lower()
                if any(p in kl for p in patterns):
                    hits.append(f"{k}: {v}")
            return hits

        facts: Dict[str, List[str]] = {
            'Soil': [], 'Precipitation': [], 'Climate': [], 'pH': [], 'Drainage': [], 'Slope': [], 'Elevation': [], 'Water': [], 'Other': []
        }
        # Aggregate all properties
        def props_iter():
            # polygons
            if 'polygonData' in spatial_data:
                for f in spatial_data['polygonData']:
                    yield f.get('properties', {})
            if 'polygon_matches' in spatial_data:
                for f in spatial_data['polygon_matches']:
                    yield f.get('properties', {})
            # nearest points
            if 'nearestPoints' in spatial_data:
                for f in spatial_data['nearestPoints']:
                    yield f.get('properties', {})
            if 'nearest_points' in spatial_data:
                for f in spatial_data['nearest_points']:
                    yield f.get('properties', {})

        for props in props_iter():
            if not isinstance(props, dict):
                continue
            facts['Soil'] += find_keys(props, ['soil', 'loam', 'clay', 'sand', 'silt', 'texture'])
            facts['Precipitation'] += find_keys(props, ['precip', 'rain', 'rainfall', 'ppt', 'inches'])
            facts['Climate'] += find_keys(props, ['temp', 'climate', 'arid', 'humid', 'degree'])
            facts['pH'] += find_keys(props, ['ph'])
            facts['Drainage'] += find_keys(props, ['drain', 'infiltration'])
            facts['Slope'] += find_keys(props, ['slope', 'gradient'])
            facts['Elevation'] += find_keys(props, ['elev', 'altitude'])
            facts['Water'] += find_keys(props, ['water', 'river', 'lake', 'stream', 'aquifer', 'well'])

        # Build markdown list
        lines = []
        for k, vals in facts.items():
            if vals:
                # Deduplicate while preserving order
                seen = set()
                uniq = []
                for item in vals:
                    if item not in seen:
                        uniq.append(item)
                        seen.add(item)
                lines.append(f"- {k}: " + "; ".join(uniq[:8]))
        return {"facts": facts, "markdown": "\n".join(lines) if lines else "- No explicit site facts detected in spatial properties"}

    async def _retrieve_knowledge_base_context(self, query: str, top_k: int = 15) -> List[Dict[str, Any]]:
        """Retrieve relevant context from Pinecone knowledge base"""
        try:
            if not self.is_initialized:
                await self.initialize()
            
            namespace = config.PINECONE_NAMESPACE
            
            # Generate query embedding using SentenceTransformer
            query_embedding = self.embedding_model.encode(query).tolist()
            logger.info(f"🔍 Generated query embedding, dimension: {len(query_embedding)}")
            
            # Query Pinecone with vector
            results = self.pinecone_index.query(
                vector=query_embedding,
                top_k=top_k,
                namespace=namespace,
                include_metadata=True
            )
            
            # Format results
            knowledge_chunks = []
            if hasattr(results, 'matches'):
                for match in results.matches:
                    metadata = match.metadata if hasattr(match, 'metadata') else {}
                    chunk = {
                        "content": metadata.get("content", ""),
                        "source": metadata.get("source", "Unknown"),
                        "page": metadata.get("page", -1)
                    }
                    knowledge_chunks.append(chunk)
            
            logger.info(f"✅ Retrieved {len(knowledge_chunks)} knowledge chunks from Pinecone")
            return knowledge_chunks
            
        except Exception as e:
            logger.error(f"❌ Failed to retrieve knowledge base context: {e}")
            return []
    
    def _build_comprehensive_prompt(self, spatial_data: Dict[str, Any], knowledge_chunks: List[Dict[str, Any]]) -> str:
        """Build a comprehensive prompt for 10-year plantation plan generation"""
        
        formatted_spatial = self._format_spatial_data(spatial_data)
        coordinates = formatted_spatial.get('coordinates', 'Unknown location')
        coverage_data = formatted_spatial.get('coverage_data', 'No coverage data')
        nearby_features = formatted_spatial.get('nearby_features', 'No nearby features')
        
        # Organize knowledge base by source
        kb_by_source = {}
        for chunk in knowledge_chunks:
            source = chunk.get('source', 'Unknown')
            if source not in kb_by_source:
                kb_by_source[source] = []
            kb_by_source[source].append({
                'content': chunk['content'],
                'page': chunk.get('page', -1)
            })
        
        # Build knowledge base section
        kb_section = ""
        for source, chunks in kb_by_source.items():
            kb_section += f"\n\n**{source.upper()}:**\n"
            for i, chunk in enumerate(chunks[:2], 1):  # Max 2 per source
                page_info = f" (Page {chunk['page']})" if chunk['page'] > 0 else ""
                kb_section += f"{i}. {chunk['content']}{page_info}\n"
        
        # NEW: Use LangChain PromptTemplates to compose multi-section prompt for richer output
        # Allocate target pages per section summing to ~25-30 pages
        allocation = {
            "executive_and_site": 5,
            "ten_year_plan": 6,
            "species_and_agri": 4,
            "economics": 3,
            "employment_social": 2,
            "environment_wildlife": 2,
            "risk_me": 1,
            "timeline": 1,
            "funding": 1,
            "scenarios_appendix": 3,
        }
        
        # Render all section prompts
        section_prompts = []
        section_prompts.append((
            "Executive Summary and Site Analysis",
            self.section_templates["executive_and_site"].format(
                coordinates=coordinates,
                coverage_data=coverage_data,
                nearby_features=nearby_features,
                kb_section=kb_section,
                facts_md="", # No facts for this section in this prompt
                target_pages=str(allocation["executive_and_site"]),
            )
        ))
        section_prompts.append((
            "10-Year Implementation Plan",
            self.section_templates["ten_year_plan"].format(
                coordinates=coordinates,
                facts_md="", # No facts for this section in this prompt
                target_pages=str(allocation["ten_year_plan"]),
            )
        ))
        section_prompts.append((
            "Species Selection and Agricultural Integration",
            self.section_templates["species_and_agri"].format(
                coordinates=coordinates,
                facts_md="", # No facts for this section in this prompt
                target_pages=str(allocation["species_and_agri"]),
            )
        ))
        for key, title in [
            ("economics", "Economic Analysis and Financial Projections"),
            ("employment_social", "Employment and Social Impact"),
            ("environment_wildlife", "Environmental Impact, Wildlife and Ecosystem Services"),
            ("risk_me", "Risk Management and Monitoring & Evaluation"),
            ("timeline", "Implementation Timeline and Milestones"),
            ("funding", "Funding and Financing Strategy"),
            ("scenarios_appendix", "Scenarios and Appendix"),
        ]:
            section_prompts.append((
                title,
                self.section_templates[key].format(
                    facts_md="", # No facts for this section in this prompt
                    target_pages=str(allocation[key])
                )
            ))
        
        # Combine into one mega prompt as fallback (not used directly for generation anymore)
        combined_reference_prompt = (
            "\n\n".join([f"# {title}\n\n{prompt}" for title, prompt in section_prompts])
        )
        return combined_reference_prompt

    async def cancel_job(self, request_id: Optional[str]) -> bool:
        """Signal cancellation for a given request_id. Returns True if signalled."""
        if not request_id:
            return False
        ev = self._cancellations.get(request_id)
        if ev is None:
            ev = asyncio.Event()
            self._cancellations[request_id] = ev
        ev.set()
        logger.info(f"🛑 Cancellation requested for {request_id}")
        return True

    def _should_cancel(self, request_id: Optional[str]) -> bool:
        if not request_id:
            return False
        ev = self._cancellations.get(request_id)
        return bool(ev and ev.is_set())

    def _maybe_raise_cancel(self, request_id: Optional[str]):
        if self._should_cancel(request_id):
            raise asyncio.CancelledError("Plan generation cancelled by client")

    async def _maybe_raise_cancel_or_disconnect(self, request_id: Optional[str], http_request: Optional[Any]):
        self._maybe_raise_cancel(request_id)
        try:
            if http_request is not None:
                # FastAPI Request.is_disconnected is awaitable
                if await http_request.is_disconnected():
                    raise asyncio.CancelledError("Client disconnected (HTTP aborted)")
        except Exception:
            # Be permissive on environments where Request may not support is_disconnected
            pass

    # NEW: Generate per-section content using the model for more consistent long outputs
    async def _generate_sections(self, section_prompts: List[tuple], request_id: Optional[str] = None, http_request: Optional[Any] = None, progress_callback=None) -> str:
        contents: List[str] = []
        total_sections = len(section_prompts)
        
        def _gemini_response_to_text(resp) -> str:
            try:
                texts: List[str] = []
                # Prefer candidates/parts if available
                candidates = getattr(resp, 'candidates', None)
                if candidates:
                    for cand in candidates:
                        content = getattr(cand, 'content', None)
                        if content is None:
                            continue
                        parts = getattr(content, 'parts', None)
                        if not parts:
                            continue
                        for part in parts:
                            text = getattr(part, 'text', None)
                            if text:
                                texts.append(text)
                if texts:
                    return "\n".join(texts)
                # Fallback to .text for simple responses
                text = getattr(resp, 'text', '')
                if text:
                    return text
            except Exception:
                pass
            return ""
        
        for idx, (title, prompt) in enumerate(section_prompts):
            await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
            try:
                logger.info(f"🤖 Generating section {idx+1}/{total_sections}: {title}")
                
                # Calculate progress percentage
                progress_percentage = int((idx / total_sections) * 100)
                if progress_callback:
                    await progress_callback({
                        'stage': 'generating',
                        'section': title,
                        'section_number': idx + 1,
                        'total_sections': total_sections,
                        'percentage': progress_percentage
                    })
                
                attempt = 0
                last_exc = None
                while attempt < config.GEN_MAX_RETRIES:
                    await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
                    try:
                        model_to_use = self.model if attempt == 0 else genai.GenerativeModel(self.model_fallback_name)
                        if attempt == 1:
                            logger.info(f"🔁 Retrying {title} with fallback model: {self.model_fallback_name}")
                        elif attempt > 1:
                            logger.info(f"🔁 Retrying {title}, attempt {attempt+1}")
                        response = model_to_use.generate_content(
                            prompt,
                            generation_config=genai.types.GenerationConfig(
                                max_output_tokens=6000,
                                temperature=0.5,
                                top_p=0.9,
                                top_k=40,
                            ),
                        )
                        section_text = _gemini_response_to_text(response)
                        if section_text.strip():
                            contents.append(f"# {title}\n\n{section_text.strip()}\n")
                            break
                        else:
                            raise RuntimeError("Empty response text")
                    except Exception as e:
                        last_exc = e
                        attempt += 1
                        if attempt < config.GEN_MAX_RETRIES:
                            await asyncio.sleep(config.GEN_RETRY_BACKOFF_SECONDS)
                        continue
                else:
                    # All attempts failed
                    raise last_exc or RuntimeError("Section generation failed after retries")
            except Exception as section_exc:
                logger.error(f"Section generation failed for {title}: {section_exc}")
                contents.append(f"# {title}\n\nContent unavailable due to generation error.\n")
            await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
        
        # Final progress update
        if progress_callback:
            await progress_callback({
                'stage': 'generating',
                'section': 'Finalizing plan',
                'section_number': total_sections,
                'total_sections': total_sections,
                'percentage': 100
            })
        
        return "\n\n".join(contents)

    def _sanitize_model_output(self, text: str) -> str:
        """Sanitize LLM markdown to be safe for ReportLab paragraphs.
        - Convert <br>, <br/>, <br /> to newlines
        - Strip all remaining HTML tags
        - Normalize whitespace
        - Normalize exotic bullets (•, ●) to '- '
        """
        if not text:
            return ""
        # Normalize line breaks
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        # Convert HTML line breaks to newlines
        text = re.sub(r"<\s*br\s*/?\s*>", "\n", text, flags=re.IGNORECASE)
        # Normalize bullets
        text = text.replace('\u2022 ', '- ').replace('\u25CF ', '- ').replace('• ', '- ').replace('● ', '- ')
        # Remove other HTML tags to avoid ReportLab parser issues
        text = re.sub(r"<[^>]+>", "", text)
        # Collapse excessive blank lines
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text

    def _inline_md_to_rl(self, s: str) -> str:
        """Convert simple inline markdown to ReportLab-friendly tags: **bold**, *italic*, _italic_."""
        if not s:
            return s
        # Escape existing angle brackets minimally
        s = s.replace('<', '&lt;').replace('>', '&gt;')
        # Bold **text**
        s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
        # Italic *text* or _text_
        s = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"<i>\1</i>", s)
        s = re.sub(r"_(.+?)_", r"<i>\1</i>", s)
        return s

    # NEW: Simple Markdown to ReportLab flowables parser for better formatting
    def _markdown_to_flowables(self, text: str, heading_style, subheading_style, h3_style, body_style):
        flowables: List = []
        lines = text.split('\n')
        bullet_buffer: List[str] = []
        numbered_buffer: List[str] = []

        def flush_lists():
            nonlocal bullet_buffer, numbered_buffer
            if bullet_buffer:
                flowables.append(ListFlowable([
                    ListItem(Paragraph(self._inline_md_to_rl(line[1:].strip()), body_style)) for line in bullet_buffer
                ], bulletType='bullet', start='circle', leftIndent=20, bulletFontName='Helvetica', bulletFontSize=8))
                bullet_buffer = []
            if numbered_buffer:
                flowables.append(ListFlowable([
                    ListItem(Paragraph(self._inline_md_to_rl(line.split('.', 1)[1].strip()), body_style)) for line in numbered_buffer
                ], bulletType='1', start='1', leftIndent=20, bulletFontName='Helvetica', bulletFontSize=8))
                numbered_buffer = []

        i = 0
        while i < len(lines):
            raw = lines[i]
            line = raw.rstrip()
            if not line.strip():
                flush_lists()
                flowables.append(Spacer(1, 6))
                i += 1
                continue
            # Markdown table detection
            if line.strip().startswith('|') and '|' in line:
                # Check for header separator in next line
                if i + 1 < len(lines) and set(lines[i + 1].strip().replace(' ', '')) <= set('|:-') and '|' in lines[i + 1]:
                    table_lines: List[str] = []
                    # Consume contiguous table lines starting with '|'
                    j = i
                    while j < len(lines) and lines[j].strip().startswith('|'):
                        table_lines.append(lines[j])
                        j += 1
                    # Parse table
                    def split_row(row: str) -> List[str]:
                        cells = [c.strip() for c in row.strip().strip('|').split('|')]
                        return cells
                    if len(table_lines) >= 2:
                        header = split_row(table_lines[0])
                        # Skip separator line (table_lines[1])
                        data_rows = [split_row(r) for r in table_lines[2:]] if len(table_lines) > 2 else []
                        # Convert to Paragraphs for wrapping
                        def para_cells(row: List[str]) -> List[Any]:
                            return [Paragraph(self._inline_md_to_rl(cell), body_style) for cell in row]
                        data = [para_cells(header)] + [para_cells(r) for r in data_rows]
                        # Compute equal widths to fit frame (A4 width minus margins = A4[0]-80)
                        avail_width = A4[0] - 80
                        num_cols = max(1, len(header))
                        col_width = avail_width / num_cols
                        col_widths = [col_width] * num_cols
                        tbl = Table(data, hAlign='LEFT', colWidths=col_widths, repeatRows=1)
                        style_cmds = [
                            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f0f6ff')),
                            ('TEXTCOLOR', (0, 0), (-1, 0), colors.darkblue),
                            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                            ('REPEATROWS', (0,0), (-1,0)),
                        ]
                        tbl.setStyle(TableStyle(style_cmds))
                        flush_lists()
                        flowables.append(KeepTogether(tbl))
                        flowables.append(Spacer(1, 6))
                        i = j
                        continue
            if line.startswith('### '):
                flush_lists()
                flowables.append(Paragraph(self._inline_md_to_rl(line[4:].strip()), h3_style))
                i += 1
                continue
            if line.startswith('## '):
                flush_lists()
                flowables.append(Paragraph(self._inline_md_to_rl(line[3:].strip()), subheading_style))
                i += 1
                continue
            if line.startswith('# '):
                flush_lists()
                flowables.append(Paragraph(self._inline_md_to_rl(line[2:].strip()), heading_style))
                i += 1
                continue
            if line.startswith('- ') or line.startswith('* ') or line.startswith('• ') or line.startswith('● '):
                if line.startswith('• ') or line.startswith('● '):
                    line = '- ' + line[2:]
                bullet_buffer.append(line)
                i += 1
                continue
            if len(line) > 2 and line[0].isdigit() and line[1] == '.':
                numbered_buffer.append(line)
                i += 1
                continue
            # paragraph
            flush_lists()
            flowables.append(Paragraph(self._inline_md_to_rl(line), body_style))
            i += 1
        flush_lists()
        return flowables

    def _build_site_tables(self, spatial_data: Dict[str, Any], body_style) -> List[Any]:
        """Create summary tables from spatial popup data to ensure data-driven PDF content."""
        flowables: List[Any] = []

        def dict_to_kv_string(d: Dict[str, Any], max_items: int = 6) -> str:
            items = []
            for k, v in d.items():
                if v is None:
                    continue
                kl = str(k).lower()
                if kl in ('objectid', 'fid', 'shape_leng', 'shape_area'):
                    continue
                items.append(f"{k}={v}")
                if len(items) >= max_items:
                    break
            return ", ".join(items) if items else "—"

        # Coverage (polygons)
        polygons = []
        if 'polygonData' in spatial_data:
            polygons = spatial_data.get('polygonData') or []
        elif 'polygon_matches' in spatial_data:
            polygons = spatial_data.get('polygon_matches') or []
        if polygons:
            flowables.append(Paragraph("Coverage Layers Summary", body_style))
            data = [[Paragraph("<b>Layer</b>", body_style), Paragraph("<b>Key Properties</b>", body_style)]]
            for f in polygons[:25]:  # cap rows to keep table readable
                layer = f.get('layerName') or f.get('layer_name') or f.get('layer', 'Unknown Layer')
                props = f.get('properties', {}) or {}
                data.append([Paragraph(self._inline_md_to_rl(str(layer)), body_style), Paragraph(self._inline_md_to_rl(dict_to_kv_string(props)), body_style)])
            tbl = Table(data, hAlign='LEFT', colWidths=[2.3*inch, 4.2*inch], repeatRows=1)
            tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eef7ee')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.darkgreen),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('REPEATROWS', (0,0), (-1,0)),
            ]))
            flowables.append(KeepTogether(tbl))
            flowables.append(Spacer(1, 12))

        # Nearest points
        nearest = []
        if 'nearestPoints' in spatial_data:
            nearest = spatial_data.get('nearestPoints') or []
        elif 'nearest_points' in spatial_data:
            nearest = spatial_data.get('nearest_points') or []
        if nearest:
            flowables.append(Paragraph("Nearest Features Summary", body_style))
            data = [[Paragraph("<b>Layer</b>", body_style), Paragraph("<b>Distance</b>", body_style), Paragraph("<b>Key Properties</b>", body_style)]]
            for f in nearest[:25]:
                layer = f.get('layerName') or f.get('layer_name') or 'Unknown Layer'
                dist = f.get('distanceFormatted') or f.get('distance_formatted') or '—'
                props = f.get('properties', {}) or {}
                data.append([
                    Paragraph(self._inline_md_to_rl(str(layer)), body_style),
                    Paragraph(self._inline_md_to_rl(str(dist)), body_style),
                    Paragraph(self._inline_md_to_rl(dict_to_kv_string(props)), body_style),
                ])
            tbl = Table(data, hAlign='LEFT', colWidths=[2.0*inch, 1.2*inch, 3.3*inch], repeatRows=1)
            tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eef1fb')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.darkblue),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('REPEATROWS', (0,0), (-1,0)),
            ]))
            flowables.append(KeepTogether(tbl))
            flowables.append(Spacer(1, 12))

        return flowables

    def _build_kb_appendix(self, knowledge_chunks: List[Dict[str, Any]], heading_style, subheading_style, body_style) -> List[Any]:
        flowables: List[Any] = []
        if not knowledge_chunks:
            return flowables
        flowables.append(Paragraph("Appendix A: Knowledge Base Extracts", heading_style))
        # Group by source
        by_source: Dict[str, List[Dict[str, Any]]] = {}
        for ch in knowledge_chunks:
            src = ch.get('source', 'Unknown')
            by_source.setdefault(src, []).append(ch)
        for source, chunks in by_source.items():
            flowables.append(Paragraph(f"Source: {source}", subheading_style))
            for ch in chunks[:5]:
                page_info = f" (Page {ch.get('page')})" if isinstance(ch.get('page'), int) and ch.get('page', -1) > 0 else ""
                excerpt = ch.get('content', '')
                flowables.append(Paragraph(excerpt[:2000] + ("…" if len(excerpt) > 2000 else ""), body_style))
                flowables.append(Paragraph(f"Reference{page_info}", body_style))
                flowables.append(Spacer(1, 6))
        return flowables

    async def generate_plantation_plan(self, spatial_data: Dict[str, Any], request_id: Optional[str] = None, http_request: Optional[Any] = None) -> Dict[str, Any]:
        """Generate a comprehensive 10-year plantation plan"""
        try:
            if not self.is_initialized:
                await self.initialize()

            logger.info("🌱 Starting plantation plan generation...")
            await self._maybe_raise_cancel_or_disconnect(request_id, http_request)

            # Create search query from spatial data
            coordinates = spatial_data.get('clickCoordinates', {})
            lat = coordinates.get('lat', 'unknown')
            lng = coordinates.get('lng', 'unknown')

            search_query = f"Texas plantation forestry agriculture sustainable land use location {lat} {lng}"

            # Retrieve knowledge base context
            knowledge_chunks = await self._retrieve_knowledge_base_context(search_query, top_k=config.RAG_TOP_K)
            await self._maybe_raise_cancel_or_disconnect(request_id, http_request)

            # Build section prompts via LangChain templates
            formatted_spatial = self._format_spatial_data(spatial_data)
            coords_str = formatted_spatial.get('coordinates', 'Unknown location')
            coverage_data = formatted_spatial.get('coverage_data', 'No coverage data')
            nearby_features = formatted_spatial.get('nearby_features', 'No nearby features')
            site_facts = self._extract_site_facts(spatial_data)
            facts_md = site_facts.get('markdown', '')

            # Build KB section text for prompts
            kb_by_source: Dict[str, List[Dict[str, Any]]] = {}
            for chunk in knowledge_chunks:
                source = chunk.get('source', 'Unknown')
                if source not in kb_by_source:
                    kb_by_source[source] = []
                kb_by_source[source].append({
                    'content': chunk['content'],
                    'page': chunk.get('page', -1)
                })
            kb_section = ""
            for source, chunks in kb_by_source.items():
                kb_section += f"\n\n**{source.upper()}:**\n"
                for i, chunk in enumerate(chunks[:2], 1):
                    page_info = f" (Page {chunk['page']})" if chunk['page'] > 0 else ""
                    kb_section += f"{i}. {chunk['content']}{page_info}\n"

            # Compose individual prompts with page targets for ~25-30 pages total
            section_prompts: List[tuple] = []
            section_prompts.append((
                "Executive Summary and Site Analysis",
                self.section_templates["executive_and_site"].format(
                    coordinates=coords_str,
                    coverage_data=coverage_data,
                    nearby_features=nearby_features,
                    kb_section=kb_section,
                    facts_md=facts_md,
                    target_pages="5",
                ),
            ))
            section_prompts.append((
                "10-Year Implementation Plan",
                self.section_templates["ten_year_plan"].format(
                    coordinates=coords_str,
                    facts_md=facts_md,
                    target_pages="6",
                ),
            ))
            section_prompts.append((
                "Species Selection and Agricultural Integration",
                self.section_templates["species_and_agri"].format(
                    coordinates=coords_str,
                    facts_md=facts_md,
                    target_pages="4",
                ),
            ))
            for key, title, pages in [
                ("economics", "Economic Analysis and Financial Projections", "3"),
                ("employment_social", "Employment and Social Impact", "2"),
                ("environment_wildlife", "Environmental Impact, Wildlife and Ecosystem Services", "2"),
                ("risk_me", "Risk Management and Monitoring & Evaluation", "1"),
                ("timeline", "Implementation Timeline and Milestones", "1"),
                ("funding", "Funding and Financing Strategy", "1"),
                ("scenarios_appendix", "Scenarios and Appendix", "3"),
            ]:
                section_prompts.append((
                    title,
                    self.section_templates[key].format(facts_md=facts_md, target_pages=pages),
                ))

            # Create progress callback
            async def progress_callback(progress_data):
                await self.update_progress(request_id, progress_data)
            
            # Generate all sections with progress tracking
            plan_content = await self._generate_sections(
                section_prompts, 
                request_id=request_id, 
                http_request=http_request,
                progress_callback=progress_callback if request_id else None
            )
            await self._maybe_raise_cancel_or_disconnect(request_id, http_request)

            # Generate timestamp for unique identification
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

            # Create plan metadata
            plan_data = {
                "id": f"texas_plantation_plan_{timestamp}",
                "title": f"10-Year Plantation Plan - {coords_str}",
                "content": plan_content,
                "coordinates": coordinates,
                "spatial_data": spatial_data,
                "knowledge_chunks_used": len(knowledge_chunks),
                "knowledge_chunks": knowledge_chunks,
                "generated_at": datetime.now().isoformat(),
                "status": "generated"
            }

            logger.info(f"✅ Successfully generated plantation plan: {plan_data['id']}")
            return plan_data

        except asyncio.CancelledError:
            logger.warning("🛑 Plan generation cancelled by client request")
            raise
        except Exception as e:
            logger.error(f"❌ Failed to generate plantation plan: {e}")
            raise

    def _create_economic_chart(self, plan_id: str) -> str:
        """Create economic projection chart"""
        try:
            years = list(range(2024, 2034))
            investment = [100000, 150000, 200000, 180000, 160000, 140000, 120000, 100000, 80000, 60000]
            revenue = [0, 10000, 30000, 60000, 120000, 200000, 350000, 500000, 700000, 900000]
            employment = [5, 12, 25, 35, 45, 55, 65, 75, 85, 95]

            fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(12, 10))
            ax1.plot(years, investment, 'b-o', label='Investment ($)', linewidth=2)
            ax1.plot(years, revenue, 'g-o', label='Revenue ($)', linewidth=2)
            ax1.set_title('10-Year Economic Projections', fontsize=16, fontweight='bold')
            ax1.set_ylabel('Amount (USD)')
            ax1.legend()
            ax1.grid(True, alpha=0.3)

            ax2.bar(years, employment, color='orange', alpha=0.7)
            ax2.set_title('Employment Generation', fontsize=14, fontweight='bold')
            ax2.set_ylabel('Jobs Created')
            ax2.grid(True, alpha=0.3)

            net_profit = [rev - inv for rev, inv in zip(revenue, investment)]
            colors_local = ['red' if profit < 0 else 'green' for profit in net_profit]
            ax3.bar(years, net_profit, color=colors_local, alpha=0.7)
            ax3.set_title('Net Profit Projections', fontsize=14, fontweight='bold')
            ax3.set_xlabel('Year')
            ax3.set_ylabel('Net Profit (USD)')
            ax3.axhline(y=0, color='black', linestyle='-', alpha=0.3)
            ax3.grid(True, alpha=0.3)

            plt.tight_layout()
            chart_path = config.PDF_OUTPUT_PATH / f"economic_chart_{plan_id}.png"
            plt.savefig(chart_path, dpi=300, bbox_inches='tight')
            plt.close()
            return str(chart_path)
        except Exception as e:
            logger.error(f"Failed to create economic chart: {e}")
            return ""

    def _create_timeline_chart(self, plan_id: str) -> str:
        """Create implementation timeline chart"""
        try:
            phases = ['Foundation\n(Years 1-2)', 'Establishment\n(Years 3-4)',
                      'Growth\n(Years 5-6)', 'Optimization\n(Years 7-8)',
                      'Maturation\n(Years 9-10)']
            activities = [
                ['Land Preparation', 'Nursery Setup', 'Initial Planting'],
                ['Expansion', 'Infrastructure', 'Training'],
                ['Maintenance', 'Diversification', 'Processing'],
                ['Harvest Planning', 'Market Development', 'Certification'],
                ['Large Harvest', 'Sustainability', 'Legacy Planning']
            ]
            fig, ax = plt.subplots(figsize=(14, 8))
            colors_local = ['#ff9999', '#66b3ff', '#99ff99', '#ffcc99', '#ff99cc']
            for i, (phase, activities_list) in enumerate(zip(phases, activities)):
                ax.barh(i, 2, left=i*2, height=0.6, color=colors_local[i], alpha=0.7, edgecolor='black', linewidth=1)
                ax.text(i*2 + 1, i, phase, ha='center', va='center', fontweight='bold', fontsize=10)
                activities_text = '\n'.join([f"• {activity}" for activity in activities_list])
                ax.text(i*2 + 1, i-0.3, activities_text, ha='center', va='top', fontsize=8, style='italic')
            ax.set_xlim(-0.5, 10.5)
            ax.set_ylim(-1, len(phases))
            ax.set_xlabel('Timeline (Years)', fontsize=12, fontweight='bold')
            ax.set_title('10-Year Implementation Timeline and Key Activities', fontsize=16, fontweight='bold', pad=20)
            ax.set_yticks([])
            ax.spines['left'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['top'].set_visible(False)
            for year in range(1, 11):
                ax.axvline(x=year, color='gray', linestyle='--', alpha=0.5)
                ax.text(year, len(phases)-0.2, f'Year {year}', ha='center', va='bottom', fontsize=8, rotation=45)
            plt.tight_layout()
            chart_path = config.PDF_OUTPUT_PATH / f"timeline_chart_{plan_id}.png"
            plt.savefig(chart_path, dpi=300, bbox_inches='tight')
            plt.close()
            return str(chart_path)
        except Exception as e:
            logger.error(f"Failed to create timeline chart: {e}")
            return ""

    def _create_employment_chart(self, plan_id: str) -> str:
        """Create employment breakdown chart"""
        try:
            job_categories = ['Forestry Workers', 'Agricultural Staff', 'Processing Jobs', 'Management', 'Research & Dev', 'Support Services']
            year_5_jobs = [25, 20, 15, 8, 5, 12]
            year_10_jobs = [35, 30, 25, 12, 8, 18]
            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
            colors1 = plt.cm.Set3(range(len(job_categories)))
            ax1.pie(year_5_jobs, labels=job_categories, autopct='%1.1f%%', colors=colors1)
            ax1.set_title('Employment Distribution - Year 5\nTotal: 85 Jobs', fontsize=14, fontweight='bold')
            colors2 = plt.cm.Set2(range(len(job_categories)))
            ax2.pie(year_10_jobs, labels=job_categories, autopct='%1.1f%%', colors=colors2)
            ax2.set_title('Employment Distribution - Year 10\nTotal: 128 Jobs', fontsize=14, fontweight='bold')
            plt.suptitle('Employment Generation by Category', fontsize=16, fontweight='bold')
            plt.tight_layout()
            chart_path = config.PDF_OUTPUT_PATH / f"employment_chart_{plan_id}.png"
            plt.savefig(chart_path, dpi=300, bbox_inches='tight')
            plt.close()
            return str(chart_path)
        except Exception as e:
            logger.error(f"Failed to create employment chart: {e}")
            return ""

    def _create_species_mix_chart(self, plan_id: str) -> str:
        try:
            labels = ['Native Oaks', 'Pines', 'Mesquite', 'Cedar Elm', 'Willow', 'Other']
            shares = [25, 20, 15, 12, 10, 18]
            fig, ax = plt.subplots(figsize=(8, 6))
            ax.pie(shares, labels=labels, autopct='%1.1f%%')
            ax.set_title('Recommended Species Mix', fontsize=14, fontweight='bold')
            chart_path = config.PDF_OUTPUT_PATH / f"species_mix_{plan_id}.png"
            plt.savefig(chart_path, dpi=300, bbox_inches='tight')
            plt.close()
            return str(chart_path)
        except Exception as e:
            logger.error(f"Failed to create species mix chart: {e}")
            return ""

    def _create_carbon_sequestration_chart(self, plan_id: str) -> str:
        try:
            years = list(range(1, 11))
            baseline = [0, 2, 5, 9, 14, 20, 27, 35, 44, 54]
            ambitious = [0, 4, 9, 16, 25, 35, 47, 60, 75, 92]
            fig, ax = plt.subplots(figsize=(10, 6))
            ax.plot(years, baseline, label='Baseline (tCO2e/ha)', linewidth=2)
            ax.plot(years, ambitious, label='Ambitious (tCO2e/ha)', linewidth=2)
            ax.set_xlabel('Year')
            ax.set_ylabel('Cumulative Carbon Sequestration')
            ax.set_title('Carbon Sequestration Scenarios')
            ax.grid(True, alpha=0.3)
            ax.legend()
            chart_path = config.PDF_OUTPUT_PATH / f"carbon_{plan_id}.png"
            plt.savefig(chart_path, dpi=300, bbox_inches='tight')
            plt.close()
            return str(chart_path)
        except Exception as e:
            logger.error(f"Failed to create carbon chart: {e}")
            return ""

    def _create_budget_allocation_chart(self, plan_id: str) -> str:
        try:
            categories = ['Land Prep', 'Nursery', 'Planting', 'Irrigation', 'Training', 'Monitoring', 'Processing']
            allocation = [15, 10, 25, 12, 8, 10, 20]
            fig, ax = plt.subplots(figsize=(10, 6))
            ax.bar(categories, allocation)
            ax.set_ylabel('Budget Share (%)')
            ax.set_title('Budget Allocation by Category')
            ax.grid(True, axis='y', alpha=0.3)
            plt.xticks(rotation=30, ha='right')
            chart_path = config.PDF_OUTPUT_PATH / f"budget_{plan_id}.png"
            plt.savefig(chart_path, dpi=300, bbox_inches='tight')
            plt.close()
            return str(chart_path)
        except Exception as e:
            logger.error(f"Failed to create budget chart: {e}")
            return ""

    async def generate_pdf_plan(self, plan_data: Dict[str, Any], request_id: Optional[str] = None, http_request: Optional[Any] = None) -> str:
        """Generate a professional PDF document for the plantation plan"""
        try:
            if request_id or http_request:
                await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
            # Ensure output directory exists before any file operations
            config.PDF_OUTPUT_PATH.mkdir(parents=True, exist_ok=True)

            plan_id = plan_data['id'].split('_')[-1]  # Extract timestamp
            pdf_filename = f"texas_plantation_plan_{plan_id}.pdf"
            pdf_path = config.PDF_OUTPUT_PATH / pdf_filename
            
            # Create charts
            logger.info("📊 Creating visualization charts...")
            if request_id or http_request:
                await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
            economic_chart = self._create_economic_chart(plan_id)
            if request_id or http_request:
                await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
            timeline_chart = self._create_timeline_chart(plan_id)
            if request_id or http_request:
                await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
            employment_chart = self._create_employment_chart(plan_id)
            if request_id or http_request:
                await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
            species_mix_chart = self._create_species_mix_chart(plan_id)
            if request_id or http_request:
                await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
            carbon_chart = self._create_carbon_sequestration_chart(plan_id)
            if request_id or http_request:
                await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
            budget_chart = self._create_budget_allocation_chart(plan_id)
            
            # Create PDF document with headers/footers and TOC
            logger.info("📄 Generating PDF document with TOC and improved styles...")
            
            def _header_footer(canvas, doc):
                canvas.saveState()
                canvas.setFont('Helvetica', 9)
                canvas.drawString(40, A4[1]-30, plan_data['title'])
                canvas.drawRightString(A4[0]-40, 30, f"Page {doc.page}")
                canvas.restoreState()

            class PDFPlanDocTemplate(BaseDocTemplate):
                def __init__(self, filename, **kw):
                    BaseDocTemplate.__init__(self, filename, **kw)
                    frame = Frame(40, 40, A4[0]-80, A4[1]-80, id='normal')
                    template = PageTemplate(id='with-header-footer', frames=frame, onPage=_header_footer)
                    self.addPageTemplates([template])
                def afterFlowable(self, flowable):
                    if isinstance(flowable, Paragraph):
                        text = flowable.getPlainText()
                        style_name = getattr(flowable.style, 'name', '')
                        if style_name in ('CustomTitle', 'CustomHeading', 'CustomSubHeading'):
                            level = 0 if style_name == 'CustomTitle' else (1 if style_name == 'CustomHeading' else 2)
                            self.notify('TOCEntry', (level, text, self.page))

            doc = PDFPlanDocTemplate(str(pdf_path), pagesize=A4)
            story = []
             
            # Define styles
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=22,
                spaceAfter=30,
                alignment=TA_CENTER,
                textColor=colors.darkblue
            )
            heading_style = ParagraphStyle(
                'CustomHeading',
                parent=styles['Heading2'],
                fontSize=16,
                spaceAfter=12,
                textColor=colors.darkgreen,
                keepWithNext=True,
            )
            subheading_style = ParagraphStyle(
                'CustomSubHeading',
                parent=styles['Heading3'],
                fontSize=13,
                spaceAfter=8,
                textColor=colors.darkgreen,
                keepWithNext=True,
            )
            h3_style = ParagraphStyle(
                'H3',
                parent=styles['Heading4'],
                fontSize=12,
                spaceAfter=6,
                keepWithNext=True,
            )
            body_style = ParagraphStyle(
                'CustomBody',
                parent=styles['Normal'],
                fontSize=11,
                leading=15,
                spaceAfter=10,
                alignment=TA_JUSTIFY
            )
             
            # Cover Page
            if request_id or http_request:
                await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
            story.append(Paragraph(plan_data['title'], title_style))
            story.append(Spacer(1, 20))
            coords = plan_data.get('coordinates', {})
            metadata_text = f"""
            <b>Location:</b> {coords.get('formatted', 'Unknown')}<br/>
            <b>Generated:</b> {datetime.fromisoformat(plan_data['generated_at']).strftime('%B %d, %Y at %I:%M %p')}<br/>
            <b>Plan ID:</b> {plan_data['id']}<br/>
            <b>Knowledge Base Sources:</b> {plan_data['knowledge_chunks_used']} references
            """
            story.append(Paragraph(metadata_text, body_style))
            story.append(PageBreak())

            # Table of Contents
            if request_id or http_request:
                await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
            story.append(Paragraph("Table of Contents", heading_style))
            toc = TableOfContents()
            toc.levelStyles = [heading_style, subheading_style, h3_style]
            story.append(toc)
            story.append(PageBreak())
             
            # Location Summary and Data (from popup)
            if request_id or http_request:
                await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
            story.append(Paragraph("Location Summary and Data", heading_style))
            site_facts = self._extract_site_facts(plan_data.get('spatial_data', {}))
            story.append(Paragraph("Observed Site Facts", subheading_style))
            facts_md = site_facts.get('markdown', '')
            if facts_md:
                story.extend(self._markdown_to_flowables(facts_md, heading_style, subheading_style, h3_style, body_style))
            tables = self._build_site_tables(plan_data.get('spatial_data', {}), body_style)
            story.extend(tables)
            story.append(PageBreak())
             
            # Content parsing with Markdown support
            if request_id or http_request:
                await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
            content_text = self._sanitize_model_output(plan_data['content'])
            flowables = self._markdown_to_flowables(content_text, heading_style, subheading_style, h3_style, body_style)
            story.extend(flowables)
             
            # Visual Analysis Section
            story.append(PageBreak())
            story.append(Paragraph("Visual Analysis and Projections", heading_style))
            if economic_chart and Path(economic_chart).exists():
                story.append(Paragraph("Economic Projections", subheading_style))
                story.append(Image(economic_chart, width=7*inch, height=4.5*inch))
                story.append(Spacer(1, 12))
            if timeline_chart and Path(timeline_chart).exists():
                story.append(Paragraph("Implementation Timeline", subheading_style))
                story.append(Image(timeline_chart, width=7*inch, height=4*inch))
                story.append(Spacer(1, 12))
            if employment_chart and Path(employment_chart).exists():
                story.append(Paragraph("Employment Generation", subheading_style))
                story.append(Image(employment_chart, width=7*inch, height=3.5*inch))
                story.append(Spacer(1, 12))
            if species_mix_chart and Path(species_mix_chart).exists():
                story.append(Paragraph("Recommended Species Mix", subheading_style))
                story.append(Image(species_mix_chart, width=6*inch, height=4.5*inch))
                story.append(Spacer(1, 12))
            if carbon_chart and Path(carbon_chart).exists():
                story.append(Paragraph("Carbon Sequestration Scenarios", subheading_style))
                story.append(Image(carbon_chart, width=6.5*inch, height=4*inch))
                story.append(Spacer(1, 12))
            if budget_chart and Path(budget_chart).exists():
                story.append(Paragraph("Budget Allocation", subheading_style))
                story.append(Image(budget_chart, width=6.5*inch, height=4*inch))
                story.append(Spacer(1, 12))
             
            # Knowledge Appendix (adds substantial, relevant content)
            if request_id or http_request:
                await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
            kb_flowables = self._build_kb_appendix(plan_data.get('knowledge_chunks', []), heading_style, subheading_style, body_style)
            if kb_flowables:
                story.append(PageBreak())
                story.extend(kb_flowables)
                story.append(PageBreak())
             
            # Document Information
            story.append(Paragraph("Document Information", heading_style))
            footer_info = f"""
            This comprehensive 10-year plantation plan was generated using AI with retrieval-augmented generation.\n
            It incorporates site-specific spatial data, Texas agricultural and forestry best practices, and sustainability principles.\n
            Generated by Texas Forestation Planning System on {datetime.now().strftime('%B %d, %Y')}.
            """
            story.append(Paragraph(footer_info, body_style))
             
            # Build PDF (multiBuild to resolve TOC page numbers)
            if request_id or http_request:
                await self._maybe_raise_cancel_or_disconnect(request_id, http_request)
            doc.multiBuild(story)
             
            logger.info(f"✅ PDF generated successfully: {pdf_path}")
            return str(pdf_path)
             
        except asyncio.CancelledError:
            logger.warning("🛑 PDF generation cancelled by client request")
            raise
        except Exception as e:
            logger.error(f"❌ Failed to generate PDF: {e}")
            raise

# Global service instance
plantation_service = PlantationPlanService() 