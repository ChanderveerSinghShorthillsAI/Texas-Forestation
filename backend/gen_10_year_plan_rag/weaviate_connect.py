import weaviate
from weaviate.classes.init import Auth

client = weaviate.connect_to_weaviate_cloud(
    # cluster_url="4bicg8dgspsjq2nkanptww.c0.asia-southeast1.gcp.weaviate.cloud",
    cluster_url="izpf0ebbqumamknydyfbea.c0.asia-southeast1.gcp.weaviate.cloud",
    # auth_credentials=Auth.api_key("VXZEUHZsUFFjNS9HWGQ0a18waWpxeXVjMldvaWJQS0JtbnpVNy9NeHpKVjd3S1hTdytWNkRLbU40Sms0PV92MjAw"),
    auth_credentials=Auth.api_key("cXNDQjZ1eTI0N21MbFRNeF9RdjJ5alYyYzNtdkM5MUZ3ck1OcGVVZjl3RjJRSkF2bDRuN2N4MVZkcEFNPV92MjAw"),
    
)

print("Connected?", client.is_ready())
