# File Upload & Management Guide

This guide covers the comprehensive file upload and management system implemented in the REST API boilerplate.

## Features

- **Secure File Upload**: Type validation, size limits, and malware scanning
- **Image Processing**: Automatic resizing and optimization
- **Cloud Storage**: Cloudinary integration for scalable storage
- **Database Tracking**: Complete file metadata storage
- **User Management**: File ownership and permissions
- **Multiple Upload**: Support for batch uploads

## Environment Variables

Add these to your `.env` file:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## API Endpoints

### Single File Upload

**POST** `/api/files/upload`

Upload a single file with automatic processing.

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `file`
- Authentication: Bearer token required

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "id": "file_id",
    "filename": "processed_filename.jpg",
    "originalName": "original_filename.jpg",
    "mimeType": "image/jpeg",
    "size": 1024000,
    "url": "https://cloudinary_url...",
    "resourceType": "image",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Multiple Files Upload

**POST** `/api/files/upload-multiple`

Upload multiple files (up to 5) in a single request.

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `files` (array)
- Authentication: Bearer token required

**Response:**
```json
{
  "success": true,
  "message": "3 files uploaded successfully",
  "data": [
    {
      "id": "file_id_1",
      "filename": "processed_filename1.jpg",
      "originalName": "original_filename1.jpg",
      "mimeType": "image/jpeg",
      "size": 1024000,
      "url": "https://cloudinary_url_1...",
      "resourceType": "image",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Get User Files

**GET** `/api/files`

Retrieve paginated list of user's uploaded files.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `resourceType` (optional): Filter by resource type ('image', 'video', 'document')

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "file_id",
      "filename": "filename.jpg",
      "originalName": "original_filename.jpg",
      "mimeType": "image/jpeg",
      "size": 1024000,
      "url": "https://cloudinary_url...",
      "resourceType": "image",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

### Delete File

**DELETE** `/api/files/:id`

Delete a specific file by ID.

**Parameters:**
- `id`: File ID (path parameter)

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

## Security Features

### File Type Validation
Only these MIME types are allowed:
- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`
- `application/pdf`
- `text/plain`
- `text/csv`

### Size Limits
- Maximum file size: 10MB per file
- Maximum files per request: 5

### Image Processing
- Automatic resizing to 1920x1080 (maintains aspect ratio)
- JPEG compression at 80% quality
- Format conversion to JPEG for all images

### Authentication
- All file operations require valid JWT token
- Files are isolated by user ID
- Users can only access their own files

## Database Schema

The `File` model stores complete file metadata:

```prisma
model File {
  id           String   @id @default(cuid())
  userId       String
  filename     String
  originalName String
  mimeType     String
  size         Int
  url          String
  publicId     String
  resourceType String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## Error Handling

Common error responses:

```json
{
  "error": "No file uploaded"
}
```

```json
{
  "error": "File type image/svg+xml not allowed"
}
```

```json
{
  "error": "Maximum 1 file(s) allowed"
}
```

```json
{
  "error": "File not found"
}
```

## Usage Examples

### JavaScript/TypeScript Client

```typescript
// Single file upload
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/files/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData
});

const result = await response.json();
```

```typescript
// Multiple files upload
const formData = new FormData();
Array.from(fileInput.files).forEach(file => {
  formData.append('files', file);
});

const response = await fetch('/api/files/upload-multiple', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData
});
```

### cURL Examples

```bash
# Single file upload
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/file.jpg" \
  http://localhost:3000/api/files/upload
```

```bash
# Multiple files upload
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@/path/to/file1.jpg" \
  -F "files=@/path/to/file2.jpg" \
  http://localhost:3000/api/files/upload-multiple
```

## Best Practices

1. **Client-side Validation**: Validate file types and sizes before upload
2. **Progress Indicators**: Show upload progress for better UX
3. **Error Handling**: Handle network errors gracefully
4. **File Naming**: Use descriptive names for better organization
5. **Cleanup**: Remove temporary files after processing
6. **Monitoring**: Track upload metrics and error rates

## Performance Considerations

- Images are automatically optimized for web delivery
- Cloudinary provides CDN distribution
- Database queries are paginated for efficiency
- File operations use transactions for consistency

## Security Considerations

- All files are scanned for type validation
- User isolation prevents unauthorized access
- Cloudinary provides additional security layers
- Rate limiting prevents abuse
- File metadata is sanitized before storage
