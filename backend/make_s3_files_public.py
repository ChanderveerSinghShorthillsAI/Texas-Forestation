"""
Make all GeoJSON files in S3 bucket publicly readable
Run this if you get 403 Forbidden errors when accessing files
"""

import boto3
from botocore.exceptions import ClientError
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

def make_files_public(s3_client, bucket_name, prefix):
    """Note: This bucket doesn't support ACLs. Public access must be configured via bucket policy."""
    try:
        print(f"⚠️ This bucket has ACLs disabled.")
        print(f"📝 Public access is controlled by bucket policy, not individual file ACLs.")
        print(f"")
        print(f"Files are accessible if the bucket has a public read policy.")
        print(f"Contact your AWS administrator to configure bucket policy if needed.")
        print(f"")
        print(f"Example bucket policy needed:")
        print(f'{{')
        print(f'  "Version": "2012-10-17",')
        print(f'  "Statement": [{{')
        print(f'    "Sid": "PublicReadGetObject",')
        print(f'    "Effect": "Allow",')
        print(f'    "Principal": "*",')
        print(f'    "Action": "s3:GetObject",')
        print(f'    "Resource": "arn:aws:s3:::{bucket_name}/{prefix}/*"')
        print(f'  }}]')
        print(f'}}')
        
        return 0
        
    except ClientError as e:
        print(f"❌ Error: {str(e)}")
        return 0

def main():
    print("=" * 80)
    print("🔓 Making S3 GeoJSON Files Public")
    print("=" * 80)
    print(f"Bucket: {BUCKET_NAME}")
    print(f"Prefix: {S3_FOLDER_PREFIX}")
    print("=" * 80)
    
    # Initialize S3 client
    s3_client = get_s3_client()
    
    # Make files public
    total_updated = make_files_public(s3_client, BUCKET_NAME, S3_FOLDER_PREFIX)
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 SUMMARY")
    print("=" * 80)
    print(f"Files updated: {total_updated}")
    print("=" * 80)
    
    if total_updated > 0:
        print("\n✅ All files are now publicly readable!")
        print("\nTest access:")
        print(f"https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{S3_FOLDER_PREFIX}/main/texas.geojson")
    else:
        print("\n⚠️ No files were updated. Check if files exist in S3.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        raise

