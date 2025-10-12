from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from main.models import Company
from .models import Document
from .serializers import DocumentSerializer, DocumentCreateSerializer, DocumentUpdateSerializer
from .utils import S3DocumentUploader


class DocumentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Document model providing CRUD operations with S3 file upload support.
    
    Endpoints:
    - POST /api/documents/ - Create a new document (with file upload)
    - GET /api/documents/<id>/ - Retrieve a specific document
    - PUT/PATCH /api/documents/<id>/ - Update a document
    - DELETE /api/documents/<id>/ - Soft delete a document
    - POST /api/documents/upload/ - Upload file only (testing endpoint)
    """
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    
    def get_serializer_class(self):
        """
        Return appropriate serializer class based on action
        """
        if self.action == 'create':
            return DocumentCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return DocumentUpdateSerializer
        return DocumentSerializer
    
    def get_queryset(self):
        """
        Override to exclude soft-deleted documents by default
        """
        return Document.objects.filter(deleted=False)
    
    def create(self, request, *args, **kwargs):
        """
        Create a new document record with optional file upload.
        
        POST /api/documents/
        
        Supports both:
        1. Multipart form data with file upload
        2. JSON data with external document_link
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # File upload and S3 logic is handled in the serializer's create method
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        
        # Add upload info to response
        response_data = serializer.data
        if 'meta_data' in response_data and response_data['meta_data']:
            meta_data = response_data['meta_data']
            if 's3_key' in meta_data:
                response_data['upload_info'] = {
                    'uploaded_to_s3': True,
                    'filename': meta_data.get('s3_filename'),
                    'original_filename': meta_data.get('original_filename'),
                    'folder': meta_data.get('s3_folder'),
                    'access_note': 'Use presigned URL endpoint (/api/documents/{id}/presigned_url/) for secure access'
                }
        
        return Response(
            response_data, 
            status=status.HTTP_201_CREATED, 
            headers=headers
        )
    
    def retrieve(self, request, *args, **kwargs):
        """
        Retrieve a single document by ID.
        
        GET /api/documents/<id>/
        """
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    def update(self, request, *args, **kwargs):
        """
        Update a document record (full update).
        
        PUT /api/documents/<id>/
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}
            
        return Response(serializer.data)
    
    def partial_update(self, request, *args, **kwargs):
        """
        Partially update a document record.
        
        PATCH /api/documents/<id>/
        """
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """
        Soft delete a document (sets deleted=True instead of removing from DB).
        Optionally delete from S3 if requested.
        
        DELETE /api/documents/<id>/?delete_from_s3=true
        """
        instance = self.get_object()
        
        # Check if should delete from S3
        delete_from_s3 = request.query_params.get('delete_from_s3', 'false').lower() == 'true'
        
        if delete_from_s3 and instance.meta_data and 's3_key' in instance.meta_data:
            s3_uploader = S3DocumentUploader()
            s3_key = instance.meta_data['s3_key']
            delete_result = s3_uploader.delete_document(s3_key)
            
            if not delete_result['success']:
                return Response(
                    {'error': f"Failed to delete from S3: {delete_result['error']}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # Perform soft delete
        instance.soft_delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """
        Restore a soft-deleted document.
        
        POST /api/documents/<id>/restore/
        """
        # Get document including soft-deleted ones
        document = get_object_or_404(Document.objects.all(), pk=pk)
        
        if not document.deleted:
            return Response(
                {"detail": "Document is not deleted."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        document.deleted = False
        document.active = True
        document.save()
        
        serializer = self.get_serializer(document)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def deleted(self, request):
        """
        List all soft-deleted documents.
        
        GET /api/documents/deleted/
        """
        deleted_documents = Document.objects.filter(deleted=True)
        page = self.paginate_queryset(deleted_documents)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(deleted_documents, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def upload_test(self, request):
        """
        Test endpoint for file upload without creating document record.
        Useful for testing S3 upload functionality.
        
        POST /api/documents/upload_test/
        """
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided. Use "file" field in form data.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.FILES['file']
        document_type = request.data.get('document_type', 'other')
        
        # Validate document type
        valid_types = ['transcript', 'financial_model', 'brokerage_report', 'other']
        if document_type not in valid_types:
            return Response(
                {'error': f'Invalid document_type. Must be one of: {", ".join(valid_types)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Upload to S3
        s3_uploader = S3DocumentUploader()
        upload_result = s3_uploader.upload_document(file, document_type, file.name)
        
        if upload_result['success']:
            response_data = {
                'message': 'File uploaded successfully to S3',
                'url': upload_result['url'],
                'key': upload_result['key'],
                'filename': upload_result['filename'],
                'original_filename': upload_result['original_filename'],
                'folder': upload_result['folder'],
                'bucket': s3_uploader.bucket_name
            }
            
            # Add presigned URL info if available
            if upload_result.get('presigned_url'):
                response_data['presigned_info'] = {
                    'is_presigned': True,
                    'expires_at': upload_result.get('expires_at'),
                    'note': 'This URL will expire. Use /api/documents/{id}/presigned_url/ for new URLs.'
                }
            else:
                response_data['access_note'] = 'Use presigned URL endpoint for secure access to this file.'
                
            return Response(response_data, status=status.HTTP_200_OK)
        else:
            return Response(
                {'error': upload_result['error']},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def presigned_url(self, request, pk=None):
        """
        Generate a presigned URL for secure document access.
        
        GET /api/documents/<id>/presigned_url/?expires_in=3600
        """
        document = self.get_object()
        
        if not document.meta_data or 's3_key' not in document.meta_data:
            return Response(
                {'error': 'Document does not have S3 key information'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get expiration time from query params (default 24 hours)
        expires_in = int(request.query_params.get('expires_in', 86400))
        
        # Validate expires_in (max 7 days)
        if expires_in > 604800:  # 7 days in seconds
            expires_in = 604800
        elif expires_in < 60:  # minimum 1 minute
            expires_in = 60
        
        s3_uploader = S3DocumentUploader()
        s3_key = document.meta_data['s3_key']
        url_result = s3_uploader.get_document_url(s3_key, expires_in)
        
        if url_result['success']:
            return Response({
                'presigned_url': url_result['url'],
                'expires_in': url_result['expires_in'],
                'expires_at': url_result['expires_at'],
                'document_id': document.id,
                'document_name': document.name
            })
        else:
            return Response(
                {'error': url_result['error']},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def s3_status(self, request):
        """
        Check S3 connection and configuration status.
        
        GET /api/documents/s3_status/
        """
        try:
            s3_uploader = S3DocumentUploader()
            # Test bucket access
            s3_uploader.s3_client.head_bucket(Bucket=s3_uploader.bucket_name)
            
            return Response({
                'status': 'connected',
                'bucket': s3_uploader.bucket_name,
                'region': s3_uploader.s3_client._client_config.region_name,
                'base_path': s3_uploader.base_path,
                'message': 'S3 connection successful'
            })
        except Exception as e:
            return Response({
                'status': 'error',
                'error': str(e),
                'message': 'S3 connection failed'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def filtered_documents(self, request):
        """
        Get documents filtered by user, company, and document type.
        
        GET /api/documents/filtered_documents/?user_id=1&company_name=Infosys&document_type=brokerage_report
        
        Query Parameters:
        - user_id (required): ID of the user
        - company_name (optional): Name of the company (case-insensitive)
        - company_id (optional): ID of the company (alternative to company_name)
        - document_type (optional): Type of document (transcript, financial_model, brokerage_report, other)
        
        Returns documents that match all provided filters.
        """
        # Get query parameters
        user_id = request.query_params.get('user_id')
        company_name = request.query_params.get('company_name')
        company_id = request.query_params.get('company_id')
        document_type = request.query_params.get('document_type')
        
        # Validate required parameters
        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Start with base queryset (active, non-deleted documents)
        queryset = self.get_queryset()
        
        # Filter by user
        try:
            user = User.objects.get(id=user_id)
            queryset = queryset.filter(user=user)
        except User.DoesNotExist:
            return Response(
                {'error': f'User with ID {user_id} does not exist'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Filter by company (either by name or ID)
        if company_name:
            try:
                company = Company.objects.get(name__iexact=company_name)
                queryset = queryset.filter(company=company)
            except Company.DoesNotExist:
                return Response(
                    {'error': f'Company with name "{company_name}" does not exist'},
                    status=status.HTTP_404_NOT_FOUND
                )
        elif company_id:
            try:
                company = Company.objects.get(id=company_id)
                queryset = queryset.filter(company=company)
            except Company.DoesNotExist:
                return Response(
                    {'error': f'Company with ID {company_id} does not exist'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Filter by document type
        if document_type:
            # Validate document type
            valid_types = [choice[0] for choice in Document.DOCUMENT_TYPE_CHOICES]
            if document_type not in valid_types:
                return Response(
                    {'error': f'Invalid document_type. Must be one of: {", ".join(valid_types)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            queryset = queryset.filter(document_type=document_type)
        
        # Apply pagination if configured
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response_data = self.get_paginated_response(serializer.data).data
        else:
            serializer = self.get_serializer(queryset, many=True)
            response_data = serializer.data
        
        # Add filter info to response
        filter_info = {
            'user_id': user_id,
            'user_username': user.username,
            'total_documents': len(serializer.data) if page is None else queryset.count()
        }
        
        if company_name or company_id:
            filter_info['company_name'] = company.name
            filter_info['company_id'] = company.id
        
        if document_type:
            filter_info['document_type'] = document_type
        
        # Return response with filter information
        if page is not None:
            response_data['filter_info'] = filter_info
            return Response(response_data)
        else:
            return Response({
                'results': response_data,
                'filter_info': filter_info
            })
