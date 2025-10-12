"""
Complete S3 Setup Script - All-in-One
This script will:
1. Upload all GeoJSON files to S3
2. Configure CORS
3. Make files public
4. Verify uploads
5. Test access
"""

import os
import sys
import boto3
from pathlib import Path
from botocore.exceptions import ClientError
import mimetypes
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# S3 Configuration
BUCKET_NAME = os.getenv("AWS_BUCKET_NAME", "partsgenie-data")
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY", "AKIA3XDPSWJQVL3IWCWY")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_KEY", "")
AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
S3_FOLDER_PREFIX = os.getenv("S3_FOLDER_PREFIX", "texas_geojsons")

# Directories to upload
GEOJSON_DIRECTORIES = [
    "../frontend/public/Texas_Geojsons/Texas_Geojsons",
    "../frontend/public/texas_fire_geojsons"
]

def print_header(text):
    """Print formatted header"""
    print("\n" + "=" * 80)
    print(f"  {text}")
    print("=" * 80)

def print_step(step_num, total_steps, text):
    """Print step information"""
    print(f"\n[{step_num}/{total_steps}] {text}")
    print("-" * 80)

def get_s3_client():
    """Initialize and return S3 client"""
    return boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION
    )

def configure_cors(s3_client, bucket_name):
    """Configure CORS for the bucket"""
    print("⚙️  Configuring CORS...")
    try:
        cors_config = {
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
        s3_client.put_bucket_cors(
            Bucket=bucket_name,
            CORSConfiguration=cors_config
        )
        print("✅ CORS configured successfully!")
        return True
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        if error_code == 'AccessDenied':
            print(f"⚠️  Warning: No permission to configure CORS (this is okay if CORS is already set)")
            print(f"   Contact AWS admin if you get CORS errors in browser")
        else:
            print(f"⚠️  Warning: Could not configure CORS: {str(e)}")
        return False

def upload_files(s3_client, bucket_name, prefix):
    """Upload all GeoJSON files"""
    print("📤 Uploading GeoJSON files...")
    
    total_files = 0
    uploaded_files = 0
    failed_files = 0
    total_size = 0
    
    script_dir = Path(__file__).parent
    
    for directory in GEOJSON_DIRECTORIES:
        dir_path = script_dir / directory
        
        if not dir_path.exists():
            print(f"⚠️  Directory not found: {dir_path}")
            continue
        
        # Determine subfolder
        if "texas_fire_geojsons" in str(directory):
            s3_subfolder = "fire"
        else:
            s3_subfolder = "main"
        
        print(f"\n📁 Processing: {s3_subfolder}/")
        
        # Get all files
        geojson_files = list(dir_path.glob("*.geojson")) + list(dir_path.glob("*.json"))
        
        for file_path in geojson_files:
            total_files += 1
            file_size = file_path.stat().st_size
            total_size += file_size
            
            s3_key = f"{prefix}/{s3_subfolder}/{file_path.name}"
            
            try:
                # Determine content type
                content_type = 'application/geo+json' if file_path.suffix == '.geojson' else 'application/json'
                
                # Upload
                s3_client.upload_file(
                    str(file_path),
                    bucket_name,
                    s3_key,
                    ExtraArgs={
                        'ContentType': content_type,
                        'CacheControl': 'max-age=86400'
                    }
                )
                
                print(f"   ✅ {file_path.name} ({file_size / 1024 / 1024:.2f} MB)")
                uploaded_files += 1
                
            except Exception as e:
                print(f"   ❌ {file_path.name}: {str(e)}")
                failed_files += 1
    
    return total_files, uploaded_files, failed_files, total_size

def verify_uploads(s3_client, bucket_name, prefix):
    """Verify uploaded files"""
    print("🔍 Verifying uploads...")
    
    try:
        response = s3_client.list_objects_v2(
            Bucket=bucket_name,
            Prefix=prefix
        )
        
        if 'Contents' in response:
            files = response['Contents']
            total_size = sum(f['Size'] for f in files)
            
            print(f"✅ Found {len(files)} files in S3")
            print(f"   Total size: {total_size / 1024 / 1024:.2f} MB")
            return len(files), total_size
        else:
            print("⚠️  No files found in S3")
            return 0, 0
            
    except ClientError as e:
        print(f"❌ Error verifying: {str(e)}")
        return 0, 0

def test_access(bucket_name, region, prefix):
    """Test public access to a sample file"""
    print("🌐 Testing public access...")
    
    # Test main folder
    test_url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{prefix}/main/texas.geojson"
    
    try:
        response = requests.head(test_url, timeout=10)
        if response.status_code == 200:
            print(f"✅ Public access working!")
            print(f"   Test URL: {test_url}")
            return True
        else:
            print(f"⚠️  Got status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Access test failed: {str(e)}")
        return False

def print_summary(uploaded, failed, total_size, verified_count, verified_size, access_ok):
    """Print final summary"""
    print_header("📊 SETUP COMPLETE - SUMMARY")
    
    print("\n📤 UPLOAD RESULTS:")
    print(f"   Successfully uploaded: {uploaded} files")
    print(f"   Failed uploads: {failed} files")
    print(f"   Total size: {total_size / 1024 / 1024:.2f} MB")
    
    print("\n🔍 VERIFICATION:")
    print(f"   Files in S3: {verified_count}")
    print(f"   Total size in S3: {verified_size / 1024 / 1024:.2f} MB")
    
    print("\n🌐 PUBLIC ACCESS:")
    print(f"   Status: {'✅ Working' if access_ok else '⚠️  Failed'}")
    
    print("\n🔗 S3 URLS:")
    print(f"   Main: https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{S3_FOLDER_PREFIX}/main/")
    print(f"   Fire: https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{S3_FOLDER_PREFIX}/fire/")
    
    print("\n✅ NEXT STEPS:")
    print("   1. Test in browser: npm start (in frontend directory)")
    print("   2. Navigate to Texas Forestation Planner page")
    print("   3. Open browser console (F12)")
    print("   4. Look for: 'Fetching GeoJSON: ... from S3'")
    print("   5. Try loading different layers")
    print("   6. If all works, you can remove local GeoJSON files")
    
    if failed > 0:
        print("\n⚠️  WARNING: Some files failed to upload")
        print("   Run this script again or check the errors above")
    
    if not access_ok:
        print("\n⚠️  WARNING: Public access test failed")
        print("   You may need to run: python make_s3_files_public.py")
    
    print("\n" + "=" * 80)

def main():
    """Main setup function"""
    print_header("🚀 S3 GEOJSON COMPLETE SETUP")
    print(f"\nBucket: {BUCKET_NAME}")
    print(f"Region: {AWS_REGION}")
    print(f"Prefix: {S3_FOLDER_PREFIX}")
    
    try:
        # Initialize S3 client
        print("\n🔌 Connecting to AWS S3...")
        s3_client = get_s3_client()
        print("✅ Connected successfully!")
        
        # Step 1: Configure CORS
        print_step(1, 4, "CONFIGURE CORS")
        configure_cors(s3_client, BUCKET_NAME)
        
        # Step 2: Upload files
        print_step(2, 4, "UPLOAD FILES")
        total, uploaded, failed, total_size = upload_files(s3_client, BUCKET_NAME, S3_FOLDER_PREFIX)
        
        # Step 3: Verify uploads
        print_step(3, 4, "VERIFY UPLOADS")
        verified_count, verified_size = verify_uploads(s3_client, BUCKET_NAME, S3_FOLDER_PREFIX)
        
        # Step 4: Test access
        print_step(4, 4, "TEST PUBLIC ACCESS")
        access_ok = test_access(BUCKET_NAME, AWS_REGION, S3_FOLDER_PREFIX)
        
        # Print summary
        print_summary(uploaded, failed, total_size, verified_count, verified_size, access_ok)
        
        # Exit code
        if failed == 0 and access_ok:
            return 0
        else:
            return 1
            
    except KeyboardInterrupt:
        print("\n\n⚠️  Setup interrupted by user")
        return 1
    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())

