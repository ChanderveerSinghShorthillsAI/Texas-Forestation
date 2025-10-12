#!/usr/bin/env python3
"""
Script to create S3 folder structure for InsightSphere documents
"""
import os
import boto3
from dotenv import load_dotenv

def create_s3_folder():
    """Create folder structure in S3 bucket"""
    
    # Load environment variables from .env file
    load_dotenv()
    
    # Get AWS credentials from environment
    aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
    aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
    bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME')
    aws_region = os.getenv('AWS_S3_REGION_NAME')
    documents_path = os.getenv('DOCUMENTS_UPLOAD_PATH', 'insightSphere-documents/')
    
    # Validate environment variables
    if not all([aws_access_key, aws_secret_key, bucket_name, aws_region]):
        print("❌ Error: Missing AWS credentials in .env file")
        print("Required variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_STORAGE_BUCKET_NAME, AWS_S3_REGION_NAME")
        return False
    
    try:
        # Create S3 client
        print("🔧 Connecting to AWS S3...")
        s3_client = boto3.client(
            's3',
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=aws_region
        )
        
        # Test bucket access
        print(f"🔍 Checking bucket '{bucket_name}'...")
        s3_client.head_bucket(Bucket=bucket_name)
        print(f"✅ Bucket '{bucket_name}' is accessible")
        
        # Create main documents folder
        print(f"📁 Creating folder '{documents_path}'...")
        s3_client.put_object(
            Bucket=bucket_name,
            Key=documents_path,
            Body=''
        )
        
        # Create subfolders for different document types
        subfolders = [
            'transcripts/',
            'financial_models/',
            'brokerage_reports/',
            'other/',
        ]
        
        for subfolder in subfolders:
            folder_path = f"{documents_path}{subfolder}"
            print(f"📁 Creating subfolder '{folder_path}'...")
            s3_client.put_object(
                Bucket=bucket_name,
                Key=folder_path,
                Body=''
            )
        
        # Verify folder creation
        print("\n🔍 Verifying folder structure...")
        response = s3_client.list_objects_v2(
            Bucket=bucket_name,
            Prefix=documents_path,
            Delimiter='/'
        )
        
        print(f"\n✅ Successfully created folder structure in '{bucket_name}':")
        print(f"📂 {documents_path}")
        
        # List all objects with the prefix
        all_objects = s3_client.list_objects_v2(
            Bucket=bucket_name,
            Prefix=documents_path
        )
        
        if 'Contents' in all_objects:
            for obj in all_objects['Contents']:
                if obj['Key'].endswith('/'):
                    print(f"  📁 {obj['Key']}")
        
        print(f"\n🎉 S3 folder structure created successfully!")
        print(f"🔗 S3 URL: https://{bucket_name}.s3.{aws_region}.amazonaws.com/{documents_path}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating S3 folder: {str(e)}")
        return False

if __name__ == "__main__":
    success = create_s3_folder()
    if success:
        print("\n🚀 You can now upload documents to this S3 folder structure!")
    else:
        print("\n💡 Please check your credentials and try again.") 