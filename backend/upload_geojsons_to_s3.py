"""
Upload GeoJSON files to S3 bucket for production use
This script uploads all GeoJSON files from the frontend public directories to S3
"""

import os
import boto3
from pathlib import Path
from botocore.exceptions import ClientError
import mimetypes
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# S3 Configuration - All credentials must be set in .env file
BUCKET_NAME = os.getenv("AWS_BUCKET_NAME", "partsgenie-data")
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_KEY")
AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
S3_FOLDER_PREFIX = os.getenv("S3_FOLDER_PREFIX", "texas_geojsons")

# Validate required AWS credentials
if not all([AWS_ACCESS_KEY, AWS_SECRET_KEY]):
    print("❌ Error: Missing required AWS credentials!")
    print("💡 Please set the following in your backend/.env file:")
    if not AWS_ACCESS_KEY: print("   - AWS_ACCESS_KEY")
    if not AWS_SECRET_KEY: print("   - AWS_SECRET_KEY")
    exit(1)

# Directories to upload
GEOJSON_DIRECTORIES = [
    "../frontend/public/Texas_Geojsons/Texas_Geojsons",
    "../frontend/public/texas_fire_geojsons"
]

def get_s3_client():
    """Initialize and return S3 client"""
    return boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION
    )

def upload_file_to_s3(s3_client, file_path, bucket_name, s3_key):
    """
    Upload a single file to S3
    
    Args:
        s3_client: boto3 S3 client
        file_path: Local file path
        bucket_name: S3 bucket name
        s3_key: S3 object key (path in bucket)
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Determine content type
        content_type, _ = mimetypes.guess_type(file_path)
        if content_type is None:
            if file_path.endswith('.geojson'):
                content_type = 'application/geo+json'
            elif file_path.endswith('.json'):
                content_type = 'application/json'
            else:
                content_type = 'application/octet-stream'
        
        # Upload with proper content type (no ACL - bucket policy handles access)
        extra_args = {
            'ContentType': content_type,
            'CacheControl': 'max-age=86400'  # Cache for 24 hours
        }
        
        s3_client.upload_file(
            file_path,
            bucket_name,
            s3_key,
            ExtraArgs=extra_args
        )
        
        print(f"✅ Uploaded: {s3_key}")
        return True
        
    except ClientError as e:
        print(f"❌ Failed to upload {file_path}: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error uploading {file_path}: {str(e)}")
        return False

def get_bucket_cors_config():
    """Get CORS configuration for the bucket"""
    return {
        'CORSRules': [
            {
                'AllowedHeaders': ['*'],
                'AllowedMethods': ['GET', 'HEAD'],
                'AllowedOrigins': ['*'],
                'ExposeHeaders': ['ETag'],
                'MaxAgeSeconds': 3600
            }
        ]
    }

def configure_bucket_cors(s3_client, bucket_name):
    """Configure CORS for the S3 bucket"""
    try:
        cors_config = get_bucket_cors_config()
        s3_client.put_bucket_cors(
            Bucket=bucket_name,
            CORSConfiguration=cors_config
        )
        print(f"✅ CORS configured for bucket: {bucket_name}")
        return True
    except ClientError as e:
        print(f"⚠️ Warning: Could not configure CORS: {str(e)}")
        return False

def upload_geojsons_to_s3():
    """Main function to upload all GeoJSON files to S3"""
    print("=" * 80)
    print("🚀 Starting GeoJSON Upload to S3")
    print("=" * 80)
    print(f"Bucket: {BUCKET_NAME}")
    print(f"Region: {AWS_REGION}")
    print(f"Folder: {S3_FOLDER_PREFIX}")
    print("=" * 80)
    
    # Initialize S3 client
    s3_client = get_s3_client()
    
    # Configure CORS
    print("\n📝 Configuring CORS...")
    configure_bucket_cors(s3_client, BUCKET_NAME)
    
    # Track statistics
    total_files = 0
    uploaded_files = 0
    failed_files = 0
    total_size = 0
    
    # Process each directory
    script_dir = Path(__file__).parent
    
    for directory in GEOJSON_DIRECTORIES:
        dir_path = script_dir / directory
        
        if not dir_path.exists():
            print(f"\n⚠️ Directory not found: {dir_path}")
            continue
        
        # Determine the subdirectory structure for S3
        if "texas_fire_geojsons" in str(directory):
            s3_subfolder = "fire"
        else:
            s3_subfolder = "main"
        
        print(f"\n📁 Processing directory: {dir_path}")
        print(f"   S3 subfolder: {s3_subfolder}")
        
        # Get all .geojson and .json files
        geojson_files = list(dir_path.glob("*.geojson")) + list(dir_path.glob("*.json"))
        
        print(f"   Found {len(geojson_files)} files")
        
        for file_path in geojson_files:
            total_files += 1
            file_size = file_path.stat().st_size
            total_size += file_size
            
            # Create S3 key
            s3_key = f"{S3_FOLDER_PREFIX}/{s3_subfolder}/{file_path.name}"
            
            print(f"\n📤 Uploading {file_path.name} ({file_size / 1024 / 1024:.2f} MB)...")
            
            # Upload file
            if upload_file_to_s3(s3_client, str(file_path), BUCKET_NAME, s3_key):
                uploaded_files += 1
            else:
                failed_files += 1
    
    # Print summary
    print("\n" + "=" * 80)
    print("📊 UPLOAD SUMMARY")
    print("=" * 80)
    print(f"Total files processed: {total_files}")
    print(f"Successfully uploaded: {uploaded_files}")
    print(f"Failed uploads: {failed_files}")
    print(f"Total size: {total_size / 1024 / 1024:.2f} MB")
    print("=" * 80)
    
    # Print S3 URLs
    print("\n🌐 Base S3 URLs:")
    print(f"Main GeoJSONs: https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{S3_FOLDER_PREFIX}/main/")
    print(f"Fire GeoJSONs: https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{S3_FOLDER_PREFIX}/fire/")
    print("=" * 80)
    
    if failed_files > 0:
        print("\n⚠️ Some files failed to upload. Please check the errors above.")
        return False
    else:
        print("\n✅ All files uploaded successfully!")
        return True

def verify_uploads(s3_client, bucket_name, prefix):
    """Verify that files were uploaded correctly"""
    try:
        print(f"\n🔍 Verifying uploads in {prefix}...")
        response = s3_client.list_objects_v2(
            Bucket=bucket_name,
            Prefix=prefix
        )
        
        if 'Contents' in response:
            files = response['Contents']
            print(f"✅ Found {len(files)} files in S3")
            
            # Show first 5 files
            print("\nFirst 5 files:")
            for obj in files[:5]:
                print(f"  - {obj['Key']} ({obj['Size'] / 1024:.2f} KB)")
            
            if len(files) > 5:
                print(f"  ... and {len(files) - 5} more files")
            
            return True
        else:
            print("⚠️ No files found in S3")
            return False
            
    except ClientError as e:
        print(f"❌ Error verifying uploads: {str(e)}")
        return False

if __name__ == "__main__":
    try:
        # Upload files
        success = upload_geojsons_to_s3()
        
        # Verify uploads
        if success:
            s3_client = get_s3_client()
            verify_uploads(s3_client, BUCKET_NAME, S3_FOLDER_PREFIX)
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Upload interrupted by user")
    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        raise

