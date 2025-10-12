import os
import uuid
import boto3
from django.conf import settings
from botocore.exceptions import ClientError
import mimetypes
from datetime import datetime


class S3DocumentUploader:
    """Utility class for uploading documents to S3"""
    
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME
        )
        self.bucket_name = settings.AWS_STORAGE_BUCKET_NAME
        self.base_path = settings.DOCUMENTS_UPLOAD_PATH

    def _get_folder_by_document_type(self, document_type):
        """Map document type to S3 folder"""
        folder_mapping = {
            'transcript': 'transcripts/',
            'financial_model': 'financial_models/',
            'brokerage_report': 'brokerage_reports/',
            'other': 'other/',
        }
        return folder_mapping.get(document_type, 'other/')

    def _generate_unique_filename(self, original_filename, document_type):
        """Generate unique filename with timestamp and UUID"""
        # Get file extension
        _, ext = os.path.splitext(original_filename)
        
        # Create unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        unique_filename = f"{document_type}_{timestamp}_{unique_id}{ext}"
        
        return unique_filename

    def upload_document(self, file, document_type, original_filename=None):
        """
        Upload a document to S3 and return the URL
        
        Args:
            file: File object (from request.FILES)
            document_type: Type of document (transcript, financial_model, etc.)
            original_filename: Original filename (optional)
            
        Returns:
            dict: {
                'success': bool,
                'url': str,
                'key': str,
                'error': str (if failed)
            }
        """
        try:
            # Get original filename
            if not original_filename:
                original_filename = getattr(file, 'name', 'unknown_file')
            
            # Generate unique filename
            unique_filename = self._generate_unique_filename(original_filename, document_type)
            
            # Get document type folder
            folder = self._get_folder_by_document_type(document_type)
            
            # Construct S3 key
            s3_key = f"{self.base_path}{folder}{unique_filename}"
            
            # Get content type
            content_type, _ = mimetypes.guess_type(original_filename)
            if not content_type:
                content_type = 'application/octet-stream'
            
            # Upload to S3
            extra_args = {
                'ContentType': content_type,
                'Metadata': {
                    'original_filename': original_filename,
                    'document_type': document_type,
                    'upload_timestamp': datetime.now().isoformat()
                }
            }
            
            # Reset file position to beginning
            file.seek(0)
            
            self.s3_client.upload_fileobj(
                file,
                self.bucket_name,
                s3_key,
                ExtraArgs=extra_args
            )
            
            # Generate presigned URL (valid for 24 hours by default)
            url_result = self.get_document_url(s3_key, expires_in=86400)  # 24 hours
            
            if url_result['success']:
                return {
                    'success': True,
                    'url': url_result['url'],
                    'key': s3_key,
                    'filename': unique_filename,
                    'original_filename': original_filename,
                    'folder': folder,
                    'presigned_url': True,
                    'expires_at': url_result['expires_at']
                }
            else:
                # Fallback to direct URL (won't work but provides the S3 path)
                direct_url = f"https://{self.bucket_name}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{s3_key}"
                return {
                    'success': True,
                    'url': direct_url,
                    'key': s3_key,
                    'filename': unique_filename,
                    'original_filename': original_filename,
                    'folder': folder,
                    'presigned_url': False,
                    'note': 'Direct URL may not be accessible due to bucket permissions. Use presigned URL endpoint.'
                }
            
        except ClientError as e:
            return {
                'success': False,
                'error': f"AWS S3 Error: {str(e)}",
                'url': None,
                'key': None
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Upload Error: {str(e)}",
                'url': None,
                'key': None
            }

    def delete_document(self, s3_key):
        """
        Delete a document from S3
        
        Args:
            s3_key: S3 key of the file to delete
            
        Returns:
            dict: {'success': bool, 'error': str (if failed)}
        """
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            return {'success': True}
        except ClientError as e:
            return {
                'success': False,
                'error': f"AWS S3 Delete Error: {str(e)}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"Delete Error: {str(e)}"
            }

    def get_document_url(self, s3_key, expires_in=86400):
        """
        Generate a presigned URL for document access
        
        Args:
            s3_key: S3 key of the file
            expires_in: URL expiration time in seconds (default: 24 hours)
            
        Returns:
            dict: {'success': bool, 'url': str, 'expires_in': int, 'error': str (if failed)}
        """
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': s3_key},
                ExpiresIn=expires_in
            )
            return {
                'success': True,
                'url': url,
                'expires_in': expires_in,
                'expires_at': datetime.now().timestamp() + expires_in
            }
        except ClientError as e:
            return {
                'success': False,
                'error': f"AWS S3 Error: {str(e)}",
                'url': None
            }
        except Exception as e:
            return {
                'success': False,
                'error': f"URL Generation Error: {str(e)}",
                'url': None
            }

    def list_documents_in_folder(self, document_type):
        """
        List all documents in a specific document type folder
        
        Args:
            document_type: Type of document
            
        Returns:
            list: List of document keys
        """
        try:
            folder = self._get_folder_by_document_type(document_type)
            prefix = f"{self.base_path}{folder}"
            
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            if 'Contents' in response:
                return [obj['Key'] for obj in response['Contents'] if not obj['Key'].endswith('/')]
            return []
        except ClientError:
            return []

    def get_fresh_presigned_url(self, s3_key, expires_in=86400):
        """
        Convenience method to get a fresh presigned URL for an existing document
        
        Args:
            s3_key: S3 key of the document
            expires_in: URL expiration time in seconds (default: 24 hours)
            
        Returns:
            dict: URL result with success status
        """
        return self.get_document_url(s3_key, expires_in)


# Convenience function for use in views
def upload_document_to_s3(file, document_type, original_filename=None):
    """
    Convenience function to upload a document to S3
    
    Args:
        file: File object from request.FILES
        document_type: Type of document
        original_filename: Original filename (optional)
        
    Returns:
        dict: Upload result
    """
    uploader = S3DocumentUploader()
    return uploader.upload_document(file, document_type, original_filename) 