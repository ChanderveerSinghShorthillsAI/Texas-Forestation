import weaviate
from weaviate.classes.init import Auth
import os
from dotenv import load_dotenv

# Load .env from parent directory (backend)
load_dotenv("../.env")

weaviate_url = os.getenv("WEAVIATE_CLUSTER_URL")
weaviate_api_key = os.getenv("WEAVIATE_API_KEY")

if not weaviate_url or not weaviate_api_key:
    print("❌ Error: Missing Weaviate credentials!")
    exit(1)

print(f"🔗 Connecting to: {weaviate_url}")

client = weaviate.connect_to_wcs(
    cluster_url=weaviate_url,
    auth_credentials=Auth.api_key(weaviate_api_key),
)

print("Connected?", client.is_ready())
client.close()
