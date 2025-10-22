"""
GeoJSON S3 Service - Fetch GeoJSON files from S3 and serve to frontend
Based on manager's approach: Backend fetches from S3, frontend calls backend
"""

import boto3
from botocore.exceptions import ClientError
import json
import os
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
    missing = []
    if not AWS_ACCESS_KEY: missing.append("AWS_ACCESS_KEY")
    if not AWS_SECRET_KEY: missing.append("AWS_SECRET_KEY")
    raise ValueError(f"❌ Missing required AWS credentials: {', '.join(missing)}. Please set in backend/.env")


class GeoJsonS3Service:
    """Service to fetch GeoJSON files from S3"""
    
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY,
            aws_secret_access_key=AWS_SECRET_KEY,
            region_name=AWS_REGION
        )
        self.bucket_name = BUCKET_NAME
        self.base_path = S3_FOLDER_PREFIX
    
    def get_geojson_key(self, filename, layer_type='main'):
        """
        Construct S3 key for GeoJSON file
        
        Args:
            filename: GeoJSON filename (e.g., 'texas.geojson')
            layer_type: 'main' or 'fire'
        
        Returns:
            str: Full S3 key
        """
        return f"{self.base_path}/{layer_type}/{filename}"
    
    def fetch_geojson(self, filename, layer_type='main'):
        """
        Fetch GeoJSON file from S3
        
        Args:
            filename: GeoJSON filename
            layer_type: 'main' or 'fire'
        
        Returns:
            dict: {
                'success': bool,
                'data': dict (GeoJSON object),
                'error': str (if failed)
            }
        """
        try:
            s3_key = self.get_geojson_key(filename, layer_type)
            
            print(f"📥 Fetching from S3: {s3_key}")
            
            # Fetch from S3
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            
            # Read and parse JSON
            content = response['Body'].read().decode('utf-8')
            geojson_data = json.loads(content)
            
            print(f"✅ Successfully fetched: {filename}")
            
            return {
                'success': True,
                'data': geojson_data,
                'filename': filename,
                'size': len(content),
                'key': s3_key
            }
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            
            if error_code == 'NoSuchKey':
                return {
                    'success': False,
                    'error': f'File not found: {filename}',
                    'data': None
                }
            else:
                return {
                    'success': False,
                    'error': f'AWS S3 Error: {str(e)}',
                    'data': None
                }
                
        except json.JSONDecodeError as e:
            return {
                'success': False,
                'error': f'Invalid JSON in file: {str(e)}',
                'data': None
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Error fetching GeoJSON: {str(e)}',
                'data': None
            }
    
    def list_geojson_files(self, layer_type='main'):
        """
        List all GeoJSON files in S3 folder
        
        Args:
            layer_type: 'main' or 'fire'
        
        Returns:
            list: List of filenames
        """
        try:
            prefix = f"{self.base_path}/{layer_type}/"
            
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            if 'Contents' in response:
                files = []
                for obj in response['Contents']:
                    key = obj['Key']
                    # Extract filename from key
                    if key.endswith('.geojson') or key.endswith('.json'):
                        filename = key.split('/')[-1]
                        files.append({
                            'filename': filename,
                            'size': obj['Size'],
                            'last_modified': obj['LastModified'].isoformat()
                        })
                return files
            return []
            
        except ClientError as e:
            print(f"Error listing files: {str(e)}")
            return []
    
    def check_file_exists(self, filename, layer_type='main'):
        """
        Check if GeoJSON file exists in S3
        
        Args:
            filename: GeoJSON filename
            layer_type: 'main' or 'fire'
        
        Returns:
            bool: True if exists
        """
        try:
            s3_key = self.get_geojson_key(filename, layer_type)
            self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            return True
        except ClientError:
            return False


# Singleton instance
_geojson_service = None


def get_geojson_service():
    """Get or create GeoJSON S3 service instance"""
    global _geojson_service
    if _geojson_service is None:
        _geojson_service = GeoJsonS3Service()
    return _geojson_service

