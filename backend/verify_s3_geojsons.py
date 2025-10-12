"""
Verify S3 GeoJSON uploads and test access
This script verifies that all GeoJSON files are properly uploaded and accessible
"""

import boto3
from botocore.exceptions import ClientError
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# S3 Configuration
BUCKET_NAME = os.getenv("AWS_BUCKET_NAME", "partsgenie-data")
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY", "AKIA3XDPSWJQVL3IWCWY")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_KEY", "")
AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
S3_FOLDER_PREFIX = os.getenv("S3_FOLDER_PREFIX", "texas_geojsons")

def get_s3_client():
    """Initialize and return S3 client"""
    return boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION
    )

def list_s3_files(s3_client, bucket_name, prefix):
    """List all files in S3 bucket with given prefix"""
    try:
        files = []
        paginator = s3_client.get_paginator('list_objects_v2')
        
        for page in paginator.paginate(Bucket=bucket_name, Prefix=prefix):
            if 'Contents' in page:
                for obj in page['Contents']:
                    files.append({
                        'key': obj['Key'],
                        'size': obj['Size'],
                        'last_modified': obj['LastModified']
                    })
        
        return files
    except ClientError as e:
        print(f"❌ Error listing files: {str(e)}")
        return []

def test_public_access(url):
    """Test if a file is publicly accessible"""
    try:
        response = requests.head(url, timeout=5)
        return response.status_code == 200
    except Exception as e:
        return False

def verify_cors_configuration(s3_client, bucket_name):
    """Verify CORS configuration"""
    try:
        response = s3_client.get_bucket_cors(Bucket=bucket_name)
        print("\n✅ CORS Configuration Found:")
        for rule in response['CORSRules']:
            print(f"  - Allowed Methods: {', '.join(rule['AllowedMethods'])}")
            print(f"  - Allowed Origins: {', '.join(rule['AllowedOrigins'])}")
            print(f"  - Allowed Headers: {', '.join(rule.get('AllowedHeaders', []))}")
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchCORSConfiguration':
            print("\n⚠️ No CORS configuration found")
        else:
            print(f"\n❌ Error checking CORS: {str(e)}")
        return False

def main():
    print("=" * 80)
    print("🔍 S3 GeoJSON Verification Tool")
    print("=" * 80)
    print(f"Bucket: {BUCKET_NAME}")
    print(f"Region: {AWS_REGION}")
    print(f"Prefix: {S3_FOLDER_PREFIX}")
    print("=" * 80)
    
    # Initialize S3 client
    s3_client = get_s3_client()
    
    # Verify CORS
    print("\n📋 Checking CORS Configuration...")
    verify_cors_configuration(s3_client, BUCKET_NAME)
    
    # List files in main folder
    print(f"\n📁 Listing files in {S3_FOLDER_PREFIX}/main/...")
    main_files = list_s3_files(s3_client, BUCKET_NAME, f"{S3_FOLDER_PREFIX}/main/")
    print(f"Found {len(main_files)} files")
    
    if main_files:
        print("\nFirst 5 files:")
        for file in main_files[:5]:
            print(f"  - {file['key']} ({file['size'] / 1024 / 1024:.2f} MB)")
        if len(main_files) > 5:
            print(f"  ... and {len(main_files) - 5} more files")
    
    # List files in fire folder
    print(f"\n📁 Listing files in {S3_FOLDER_PREFIX}/fire/...")
    fire_files = list_s3_files(s3_client, BUCKET_NAME, f"{S3_FOLDER_PREFIX}/fire/")
    print(f"Found {len(fire_files)} files")
    
    if fire_files:
        print("\nFirst 5 files:")
        for file in fire_files[:5]:
            print(f"  - {file['key']} ({file['size'] / 1024 / 1024:.2f} MB)")
        if len(fire_files) > 5:
            print(f"  ... and {len(fire_files) - 5} more files")
    
    # Calculate total size
    total_files = main_files + fire_files
    total_size = sum(f['size'] for f in total_files)
    
    print("\n" + "=" * 80)
    print("📊 STATISTICS")
    print("=" * 80)
    print(f"Main GeoJSONs: {len(main_files)} files")
    print(f"Fire GeoJSONs: {len(fire_files)} files")
    print(f"Total files: {len(total_files)} files")
    print(f"Total size: {total_size / 1024 / 1024:.2f} MB")
    print("=" * 80)
    
    # Test public access
    if total_files:
        print("\n🌐 Testing Public Access...")
        test_file = total_files[0]
        test_url = f"https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{test_file['key']}"
        
        print(f"Testing: {test_url}")
        
        if test_public_access(test_url):
            print("✅ Public access is working!")
        else:
            print("⚠️ Public access test failed. Files may not be publicly readable.")
            print("   Run the upload script again to fix permissions.")
    
    # Print access URLs
    print("\n" + "=" * 80)
    print("🌐 ACCESS URLS")
    print("=" * 80)
    print(f"Main GeoJSONs:")
    print(f"  https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{S3_FOLDER_PREFIX}/main/")
    print(f"\nFire GeoJSONs:")
    print(f"  https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{S3_FOLDER_PREFIX}/fire/")
    print("=" * 80)
    
    # Sample URLs
    if main_files:
        print("\n📝 SAMPLE URLS (test in browser):")
        for file in main_files[:3]:
            url = f"https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{file['key']}"
            print(f"  {url}")
    
    print("\n✅ Verification complete!")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        raise

