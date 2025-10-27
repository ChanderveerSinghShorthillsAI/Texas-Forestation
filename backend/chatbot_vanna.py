import os
import json
import sqlite3  
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from dotenv import load_dotenv
from google import genai
from google.genai import types
from chat_history_store import (
    append_interaction,
    get_last_interactions,
)

from langchain_google_genai import ChatGoogleGenerativeAI

MY_VANNA_API_KEY = os.getenv("MY_VANNA_API_KEY")
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"

# Vanna (SQL generation via LLM)
try:
    from vanna.vannadb import VannaDB_VectorStore
    from vanna.google import GoogleGeminiChat
    _VANNA_AVAILABLE = True
except Exception:
    _VANNA_AVAILABLE = False

load_dotenv()


class MyVanna(VannaDB_VectorStore, GoogleGeminiChat):
    def __init__(self, config=None):
        MY_VANNA_MODEL = "forest"
        VannaDB_VectorStore.__init__(self, vanna_model=MY_VANNA_MODEL, vanna_api_key=MY_VANNA_API_KEY, config=config)
        GoogleGeminiChat.__init__(self, config=config)


def process_user_query(county_name: str, longitude: float, latitude: float, user_query: str, username: Optional[str] = None) -> Dict[str, Any]:
    """
    Main function to process user query with location context.
    
    Args:
        county_name: Name of the county (e.g., "Travis County")
        longitude: Longitude coordinate
        latitude: Latitude coordinate
        user_query: User's question
    
    Returns:
        Dictionary with success status, results, SQL query, and natural response
    """
    
    # Initialize Gemini client
    client = genai.Client(api_key=GEMINI_API_KEY)
    
    # Step 0: Load last 5 Q&A for context (per username)
    prior_qas: List[Dict[str, str]] = []
    if username:
        prior_qas = get_last_interactions(username, n=5)

    # Step 1: Detect intent - check if it's a database query, follow-up, or greeting
    history_for_intent = ""
    if prior_qas:
        history_items = []
        for qa in prior_qas:
            q = qa.get("q", "").strip()
            a = qa.get("a", "").strip()
            if q and a:
                history_items.append(f"Q: {q}\nA: {a}")
        if history_items:
            history_for_intent = "\n\nConversation History (most recent last):\n" + "\n\n".join(history_items)
    
    intent_prompt = f"""You are an intent classifier. Classify the user's query into one of three categories:

Query: "{user_query}"
{history_for_intent}

Classification Rules:
1. Respond with ONLY "database_query" if the query needs NEW database lookup (questions about soil, precipitation, populated areas, wildlife, water resources, boundaries, etc.).

2. Respond with ONLY "follow_up" if the query is requesting modification or elaboration of a PREVIOUS answer, such as:
   - "explain more", "explain briefly", "be brief", "be concise", "summarize", "elaborate"
   - "give me a table", "list this", "format as table", "show as list"
   - "based on your last response", "from your previous answer"
   - "simplify that", "can you rephrase", "make it shorter"
   - Any request to reformat, rephrase, expand, or condense the previous response
   
3. Respond with a direct helpful answer if it's a greeting or general question that doesn't need database data (e.g., "Hi", "What is GIS?").
4. Respond I cannot answer if the query is unrelated to Texas spatial data.

Examples:
- "Can we grow trees here?" -> "database_query"
- "What is the soil type?" -> "database_query"
- "Explain that more briefly" -> "follow_up"
- "Give me a table based on your last response" -> "follow_up"
- "Be more concise" -> "follow_up"
- "Summarize your answer" -> "follow_up"
- "Hi" -> "Hello! How can I help you with Texas spatial data today?"
- "What is GIS?" -> "GIS stands for Geographic Information System..."

Respond with ONLY the classification ("database_query", "follow_up") or the direct answer:"""
    
    intent_response = client.models.generate_content(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(temperature=0.2),
        contents=intent_prompt
    )
    
    intent_result = intent_response.text.strip()

    print(intent_result, "-----------------------------------------")
    
    # Handle follow-up queries
    if intent_result == "follow_up":
        if not prior_qas:
            return {
                "success": True,
                "query_type": "direct_answer",
                "results": [],
                "sql_query": "",
                "natural_response": "I don't have any previous conversation to reference. Please ask a specific question about the location.",
                "point_location": [longitude, latitude]
            }
        
        # Get the last Q&A for follow-up processing
        last_qa = prior_qas[-1]
        last_question = last_qa.get("q", "").strip()
        last_answer = last_qa.get("a", "").strip()
        
        county_clean = county_name.replace(" County", "").strip()
        
        # Process follow-up request
        followup_prompt = f"""The user's previous question was: "{last_question}"

Your previous answer was: "{last_answer}"

Now the user asks: "{user_query}"

Location context: {county_clean} County, Texas (Longitude: {longitude:.6f}, Latitude: {latitude:.6f})

Based on the user's follow-up request, modify your previous answer accordingly:
- If they ask to "explain more" or "elaborate", provide a more detailed version
- If they ask to "be brief" or "be concise", provide a shorter, summarized version
- If they ask for a "table" or "list", format the information accordingly
- If they ask to "simplify", use simpler language
- Maintain all factual accuracy from the original answer

Provide the modified response:"""
        
        followup_response = client.models.generate_content(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(temperature=0.2),
            contents=followup_prompt
        )
        
        followup_answer = followup_response.text.strip()
        
        # Append the follow-up interaction to history
        if username:
            append_interaction(username=username, question=user_query, answer=followup_answer)
        
        return {
            "success": True,
            "query_type": "follow_up",
            "results": [],
            "sql_query": "",
            "natural_response": followup_answer,
            "point_location": [longitude, latitude]
        }
    
    # Handle direct answers (greetings, general questions)
    if intent_result != "database_query":
        return {
            "success": True,
            "query_type": "direct_answer",
            "results": [],
            "sql_query": "",
            "natural_response": intent_result,
            "point_location": [longitude, latitude]
        }
    
    county_clean = county_name.replace(" County", "").strip()
    
    history_context = ""
    if prior_qas:
        pairs = []
        for qa in prior_qas:
            q = qa.get("q", "").strip()
            a = qa.get("a", "").strip()
            if q and a:
                pairs.append(f"Q: {q}\nA: {a}")
        if pairs:
            history_context = "\n\nPrevious Q&A (most recent last):\n" + "\n\n".join(pairs)
            history_context += "\n\nNote: Use the context above if the query references previous conversation."

    final_question = (
        f"{user_query} at longitude {longitude:.6f}, latitude {latitude:.6f} in {county_clean} County, Texas"
        f"{history_context}"
    )
    
    # Step 4: Use Vanna to generate and execute SQL
    try:
        vn = MyVanna(config={'api_key': GEMINI_API_KEY, 'model_name': GEMINI_MODEL})
        host = os.getenv("DB_HOST")
        dbname = os.getenv("DB_NAME")
        user = os.getenv("DB_USER")
        password = os.getenv("DB_PASS")
        port = os.getenv("DB_PORT")
        sslmode = os.getenv("DB_SSLMODE")
        
        # Connect
        vn.connect_to_postgres(
        host=host,
        dbname=dbname,
        user=user,
        password=password,
        port=port,
        )
        
        # Execute query - disable visualization to avoid errors with complex data types
        sql = vn.generate_sql(final_question)
        df = vn.run_sql(sql)
        fig = None  # Skip visualization for complex data types (JSONB, geometry, etc.)
        
        # Parse all 'properties' JSON strings
        results = []
        if df is not None and not df.empty:
            for record in df[:10].to_dict(orient='records'):
                props_str = record.get("properties", "{}")
                try:
                    record["properties"] = json.loads(props_str)
                except json.JSONDecodeError:
                    record["properties"] = {}
                results.append(record)
        
    except Exception as e:
        return {
            "success": False,
            "query_type": "sql_execution_failed",
            "results": [],
            "sql_query": "",
            "natural_response": f"Error executing query: {str(e)}",
            "point_location": [longitude, latitude]
        }
    
    # Step 5: Formulate final answer using Gemini
    if results:
        qa_context_str = ""
        if prior_qas:
            qa_lines = []
            for qa in prior_qas:
                q = qa.get("q", "").strip()
                a = qa.get("a", "").strip()
                if q and a:
                    qa_lines.append(f"- Q: {q}\n  A: {a}")
            if qa_lines:
                qa_context_str = "\n\nRecent conversation (last 5):\n" + "\n\n".join(qa_lines)

        merged_properties = [r["properties"] for r in results]

        context_prompt = f"""The user asked: "{user_query}"

Location: {county_clean} County, Texas (Longitude: {longitude:.6f}, Latitude: {latitude:.6f})

SQL Query executed: {sql}

Query results (all records, with all properties):
{json.dumps(merged_properties, indent=2)}

Recent conversation context:
{qa_context_str}

STRICT INSTRUCTIONS:
1. Include relevant data from **all properties from every record** in your response.
2. Do not mention SQL, databases, or property keys directly.
3. Synthesize data into a single coherent narrative explaining environmental conditions, soil types, precipitation, and suitability for forestry, agriculture, or other land use.
4. Address follow-up questions if the user references previous conversation.

Generate a single, cohesive human-readable answer that integrates **all available properties** and provides meaningful context."""
        
        final_response = client.models.generate_content(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction="You are a helpful GIS assistant. Provide clear, concise answers based on spatial database results.",
                temperature=0.2
            ),
            contents=context_prompt
        )
        
        final_answer = final_response.text.strip()
    else:
        final_answer = f"No data was found for this location in {county_clean} County (longitude {longitude:.4f}, latitude {latitude:.4f})."
    
    # Step 6: Append current interaction to JSON history
    if username and final_answer:
        append_interaction(
            username=username,
            question=user_query,
            answer=final_answer,
            county_name=county_name,
            longitude=longitude,
            latitude=latitude,
        )
    
    return {
        "success": True,
        "query_type": "layer_query",
        "results": results,
        "sql_query": sql,
        "natural_response": final_answer,
        "point_location": [longitude, latitude]
    }


async def process_user_query_stream(county_name: str, longitude: float, latitude: float, user_query: str, username: Optional[str] = None):
    """
    Streaming version of process_user_query that yields response chunks token by token.
    
    Yields:
        Dictionary chunks containing 'token' key with text fragments
    """
    import asyncio
    
    # Initialize client
    client = genai.Client(api_key=GEMINI_API_KEY)
    
    county_clean = county_name.replace(" County", "").replace(" Co.", "").strip()
    
    # Step 1: Check for follow-up patterns
    followup_pattern = r"(how|what|why|when|where|who|which|can|could|would|is|are|does|tell me more|elaborate|explain)"
    prior_qas = []
    if username:
        prior_qas = get_last_interactions(username, n=5)
    
    is_likely_followup = (
        len(user_query.split()) < 15 and 
        re.search(followup_pattern, user_query.lower()) is not None and
        len(prior_qas) > 0
    )
    
    # Step 2: Handle follow-up
    if is_likely_followup:
        conversation_context = "\n\n".join([f"Q: {qa['q']}\nA: {qa['a']}" for qa in prior_qas])
        followup_prompt = f"""Based on this recent conversation:

{conversation_context}

The user now asks: "{user_query}"

Location context: {county_clean} County, Texas (Longitude: {longitude:.6f}, Latitude: {latitude:.6f})

Please provide a contextual follow-up answer that builds on the previous conversation."""
        
        # Stream the follow-up response
        response_stream = client.models.generate_content_stream(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction="You are a helpful GIS assistant. Provide clear, contextual follow-up answers.",
                temperature=0.2
            ),
            contents=followup_prompt
        )
        
        full_answer = ""
        for chunk in response_stream:
            if chunk.text:
                full_answer += chunk.text
                # Yield each chunk token by token
                for char in chunk.text:
                    yield {"token": char}
                    await asyncio.sleep(0.02)  # Smooth streaming
        
        # Save to history
        if username:
            append_interaction(username=username, question=user_query, answer=full_answer.strip())
        
        return
    
    # Step 3: Build context-aware question
    qa_context_str = ""
    if prior_qas:
        qa_lines = [f"- Q: {qa.get('q', '').strip()}\n  A: {qa.get('a', '').strip()}" 
                   for qa in prior_qas if qa.get('q') and qa.get('a')]
        if qa_lines:
            qa_context_str = "\n\nRecent conversation:\n" + "\n\n".join(qa_lines)
    
    final_question = f"""{user_query}

Location: {county_clean} County, Texas (Longitude: {longitude:.6f}, Latitude: {latitude:.6f})

{qa_context_str}

Please provide a comprehensive answer using the spatial database at this location."""
    
    # Step 4: Use Vanna to generate and execute SQL
    try:
        vn = MyVanna(config={'api_key': GEMINI_API_KEY, 'model_name': GEMINI_MODEL})
        host = os.getenv("DB_HOST")
        dbname = os.getenv("DB_NAME")
        user = os.getenv("DB_USER")
        password = os.getenv("DB_PASS")
        port = os.getenv("DB_PORT")
        
        vn.connect_to_postgres(host=host, dbname=dbname, user=user, password=password, port=port)
        
        sql = vn.generate_sql(final_question)
        df = vn.run_sql(sql)
        
        results = []
        if df is not None and not df.empty:
            for record in df[:10].to_dict(orient='records'):
                props_str = record.get("properties", "{}")
                try:
                    record["properties"] = json.loads(props_str)
                except json.JSONDecodeError:
                    record["properties"] = {}
                results.append(record)
        
    except Exception as e:
        error_msg = f"Error executing query: {str(e)}"
        for char in error_msg:
            yield {"token": char}
            await asyncio.sleep(0.02)
        return
    
    # Step 5: Stream final answer using Gemini
    if results:
        merged_properties = [r["properties"] for r in results]
        
        context_prompt = f"""The user asked: "{user_query}"

Location: {county_clean} County, Texas (Longitude: {longitude:.6f}, Latitude: {latitude:.6f})

SQL Query executed: {sql}

Query results:
{json.dumps(merged_properties, indent=2)}

{qa_context_str}

STRICT INSTRUCTIONS:
1. Include relevant data from all properties in your response.
2. Do not mention SQL or databases.
3. Synthesize data into a coherent narrative about environmental conditions, soil types, and land use suitability.
4. Address follow-up questions if the user references previous conversation.

Generate a cohesive human-readable answer."""
        
        response_stream = client.models.generate_content_stream(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction="You are a helpful GIS assistant. Provide clear, concise answers based on spatial database results.",
                temperature=0.2
            ),
            contents=context_prompt
        )
        
        full_answer = ""
        for chunk in response_stream:
            if chunk.text:
                full_answer += chunk.text
                # Yield each chunk token by token
                for char in chunk.text:
                    yield {"token": char}
                    await asyncio.sleep(0.02)
        
        # Save to history
        if username and full_answer:
            append_interaction(
                username=username,
                question=user_query,
                answer=full_answer.strip(),
                county_name=county_name,
                longitude=longitude,
                latitude=latitude,
            )
    else:
        no_data_msg = f"No data was found for this location in {county_clean} County."
        for char in no_data_msg:
            yield {"token": char}
            await asyncio.sleep(0.02)


# Main execution
if __name__ == "__main__":
    county = "Travis County"
    lon = -97.7431
    lat = 30.2672
    
    print("=== GIS Chatbot ===")
    print(f"Location: {county}, Longitude: {lon}, Latitude: {lat}\n")
    
    user_question = input("Enter your question: ")
    
    result = process_user_query(county, lon, lat, user_question)
    
    print("\n=== Response ===")
    print(f"Query Type: {result['query_type']}")
    if result.get('sql_query'):
        print(f"SQL Query: {result['sql_query']}")
    print(f"\nAnswer: {result['natural_response']}")
    
    if result.get('results'):
        print(f"\nFound {len(result['results'])} records")