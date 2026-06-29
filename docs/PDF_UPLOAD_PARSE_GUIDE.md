# Question PDF Upload & Parse - Quick Reference

Complete guide for using the PDF upload and parsing feature in EZ Prep API.

## Table of Contents

1. [Setup Checklist](#setup-checklist)
2. [API Endpoints](#api-endpoints)
3. [Complete Workflow](#complete-workflow)
4. [Code Examples](#code-examples)
5. [Error Handling](#error-handling)
6. [Best Practices](#best-practices)

---

## Setup Checklist

### 1. Install Dependencies

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner axios
```

### 2. Configure Environment Variables

Add to `.env` file:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=ez-prep-question-uploads

# Mathpix API Configuration
MATHPIX_APP_ID=your_mathpix_app_id
MATHPIX_APP_KEY=your_mathpix_app_key
```

### 3. AWS S3 Setup

Follow detailed instructions: [AWS_S3_SETUP.md](./AWS_S3_SETUP.md)

**Quick steps**:
1. Create S3 bucket
2. Create IAM user with S3 permissions
3. Get access keys
4. Add to `.env`

### 4. Mathpix Setup

Follow detailed instructions: [MATHPIX_SETUP.md](./MATHPIX_SETUP.md)

**Quick steps**:
1. Sign up at [mathpix.com](https://mathpix.com/)
2. Get API credentials
3. Add to `.env`

---

## API Endpoints

### 1. Upload PDF

**Endpoint**: `POST /imports/upload-pdf`

**Purpose**: Upload a question paper PDF to S3 and create a database record

**Request**:
```http
POST /imports/upload-pdf
Content-Type: multipart/form-data

file: [binary PDF file]
subjectId: 507f1f77bcf86cd799439011 (optional)
topicId: 507f1f77bcf86cd799439012 (optional)
examIds: ["507f1f77bcf86cd799439013"] (optional, JSON array as string)
difficultyLevel: medium (optional: easy|medium|hard)
metadata: {"examYear": "2023"} (optional, JSON object as string)
```

**Response**:
```json
{
  "message": "Question paper PDF uploaded successfully",
  "data": {
    "uploadId": "507f1f77bcf86cd799439020",
    "filename": "neet_2023_physics.pdf",
    "s3Key": "question-uploads/anonymous/2023-06-29/1688035200000-neet_2023_physics.pdf",
    "s3Bucket": "ez-prep-question-uploads",
    "fileSize": 2458624,
    "status": "uploaded",
    "uploadedAt": "2023-06-29T10:00:00.000Z"
  }
}
```

### 2. Parse PDF

**Endpoint**: `POST /imports/parse-pdf/:uploadId`

**Purpose**: Convert uploaded PDF to Markdown using Mathpix OCR

**Request**:
```http
POST /imports/parse-pdf/507f1f77bcf86cd799439020
Content-Type: application/json

{
  "maxPollingAttempts": 60,
  "pollingIntervalMs": 5000
}
```

**Response**:
```json
{
  "message": "PDF parsed successfully",
  "data": {
    "uploadId": "507f1f77bcf86cd799439020",
    "mathpixPdfId": "mp_abc123xyz789",
    "markdown": "## Question 1\n\nSolve for x: $x^2 + 5x + 6 = 0$\n\n...",
    "processingTimeMs": 45000,
    "status": "parsed",
    "markdownLength": 15420
  }
}
```

### 3. Get Upload Details

**Endpoint**: `GET /imports/uploads/:uploadId`

**Purpose**: Retrieve details of a specific upload

**Request**:
```http
GET /imports/uploads/507f1f77bcf86cd799439020
```

**Response**:
```json
{
  "message": "Upload details retrieved successfully",
  "data": {
    "uploadId": "507f1f77bcf86cd799439020",
    "filename": "neet_2023_physics.pdf",
    "s3Key": "question-uploads/anonymous/2023-06-29/1688035200000-neet_2023_physics.pdf",
    "s3Bucket": "ez-prep-question-uploads",
    "fileSize": 2458624,
    "status": "parsed",
    "subject": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Physics"
    },
    "topic": {
      "id": "507f1f77bcf86cd799439012",
      "name": "Mechanics"
    },
    "exams": [
      {
        "id": "507f1f77bcf86cd799439013",
        "name": "NEET"
      }
    ],
    "difficultyLevel": "medium",
    "markdownContent": "## Question 1\n\n...",
    "mathpixPdfId": "mp_abc123xyz789",
    "metadata": {
      "examYear": "2023"
    },
    "uploadedAt": "2023-06-29T10:00:00.000Z",
    "createdAt": "2023-06-29T10:00:00.000Z",
    "updatedAt": "2023-06-29T10:01:30.000Z"
  }
}
```

### 4. List Uploads

**Endpoint**: `GET /imports/uploads`

**Purpose**: Get paginated list of all uploads

**Request**:
```http
GET /imports/uploads?page=1&limit=10&status=parsed
```

**Query Parameters**:
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 10): Items per page
- `status` (optional): Filter by status (uploaded, parsing, parsed, processing, completed, failed)

**Response**:
```json
{
  "message": "Uploads retrieved successfully",
  "data": [
    {
      "uploadId": "507f1f77bcf86cd799439020",
      "filename": "neet_2023_physics.pdf",
      "status": "parsed",
      "fileSize": 2458624,
      "uploadedAt": "2023-06-29T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## Complete Workflow

### Step-by-Step Process

```
┌─────────────────┐
│  1. Upload PDF  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  2. Store in S3             │
│     - Generate unique key   │
│     - Upload to bucket      │
│     - Save metadata to DB   │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  3. Parse PDF (Mathpix)     │
│     - Get presigned URL     │
│     - Submit to Mathpix     │
│     - Poll for completion   │
│     - Store markdown in DB  │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  4. Process Markdown        │
│     - Detect structure      │
│     - Chunk by questions    │
│     - Enrich with AI        │
│     - Persist to DB         │
└─────────────────────────────┘
```

### Detailed Flow

#### Phase 1: Upload

1. Client uploads PDF via multipart form
2. NestJS validates file (type, size)
3. Generate unique S3 key: `question-uploads/{userId}/{date}/{timestamp}-{filename}`
4. Upload to S3 with metadata
5. Create `QuestionUpload` record in MongoDB
6. Return `uploadId` to client

#### Phase 2: Parse

1. Client calls parse endpoint with `uploadId`
2. Service retrieves upload record from DB
3. Generate temporary pre-signed URL (1 hour expiration)
4. Submit PDF URL to Mathpix API
5. Poll Mathpix status every 5 seconds (max 5 minutes)
6. On completion, retrieve markdown
7. Update DB record with markdown and status
8. Return markdown to client

#### Phase 3: Process (Future)

1. Detect document structure using AI
2. Chunk markdown by questions
3. Enrich each chunk with DeepSeek
4. Persist questions to DB
5. Update upload status to "completed"

---

## Code Examples

### Example 1: Upload with cURL

```bash
curl -X POST http://localhost:3000/imports/upload-pdf \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/neet_2023_physics.pdf" \
  -F "subjectId=507f1f77bcf86cd799439011" \
  -F "topicId=507f1f77bcf86cd799439012" \
  -F 'examIds=["507f1f77bcf86cd799439013"]' \
  -F "difficultyLevel=medium" \
  -F 'metadata={"examYear":"2023","testSeries":"NEET Mock Test"}'
```

### Example 2: Parse with cURL

```bash
# Get uploadId from previous response
UPLOAD_ID="507f1f77bcf86cd799439020"

# Parse the PDF
curl -X POST "http://localhost:3000/imports/parse-pdf/$UPLOAD_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "maxPollingAttempts": 60,
    "pollingIntervalMs": 5000
  }'
```

### Example 3: JavaScript/TypeScript Client

```typescript
// upload-pdf.ts
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';

async function uploadAndParse() {
  const API_BASE = 'http://localhost:3000';
  
  // 1. Upload PDF
  const formData = new FormData();
  formData.append('file', fs.createReadStream('./test.pdf'));
  formData.append('subjectId', '507f1f77bcf86cd799439011');
  formData.append('difficultyLevel', 'medium');
  formData.append('examIds', JSON.stringify(['507f1f77bcf86cd799439013']));
  
  const uploadResponse = await axios.post(
    `${API_BASE}/imports/upload-pdf`,
    formData,
    {
      headers: formData.getHeaders(),
    }
  );
  
  const { uploadId } = uploadResponse.data.data;
  console.log('Upload ID:', uploadId);
  
  // 2. Parse PDF
  const parseResponse = await axios.post(
    `${API_BASE}/imports/parse-pdf/${uploadId}`,
    {
      maxPollingAttempts: 60,
      pollingIntervalMs: 5000,
    }
  );
  
  console.log('Markdown length:', parseResponse.data.data.markdownLength);
  console.log('Processing time:', parseResponse.data.data.processingTimeMs);
  
  // 3. Get full details
  const detailsResponse = await axios.get(
    `${API_BASE}/imports/uploads/${uploadId}`
  );
  
  console.log('Full markdown:', detailsResponse.data.data.markdownContent);
}

uploadAndParse().catch(console.error);
```

### Example 4: Python Client

```python
import requests
import json

API_BASE = 'http://localhost:3000'

# 1. Upload PDF
with open('test.pdf', 'rb') as f:
    files = {'file': f}
    data = {
        'subjectId': '507f1f77bcf86cd799439011',
        'difficultyLevel': 'medium',
        'examIds': json.dumps(['507f1f77bcf86cd799439013'])
    }
    
    response = requests.post(f'{API_BASE}/imports/upload-pdf', files=files, data=data)
    upload_id = response.json()['data']['uploadId']
    print(f'Upload ID: {upload_id}')

# 2. Parse PDF
parse_data = {
    'maxPollingAttempts': 60,
    'pollingIntervalMs': 5000
}

response = requests.post(f'{API_BASE}/imports/parse-pdf/{upload_id}', json=parse_data)
print(f"Markdown length: {response.json()['data']['markdownLength']}")

# 3. Get details
response = requests.get(f'{API_BASE}/imports/uploads/{upload_id}')
markdown = response.json()['data']['markdownContent']
print(f'Markdown preview: {markdown[:200]}...')
```

---

## Error Handling

### Common Errors

#### 1. File Upload Errors

**Error**: `Payload Too Large`
```json
{
  "statusCode": 413,
  "message": "File too large",
  "error": "Payload Too Large"
}
```
**Solution**: Reduce PDF file size (max 50MB) or compress PDF

---

**Error**: `Unsupported File Type`
```json
{
  "statusCode": 400,
  "message": "Validation failed (expected type is application/pdf)",
  "error": "Bad Request"
}
```
**Solution**: Ensure file is PDF format

---

#### 2. S3 Errors

**Error**: `AWS credentials not found`
```json
{
  "statusCode": 500,
  "message": "AWS credentials not configured",
  "error": "Internal Server Error"
}
```
**Solution**: Check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env`

---

**Error**: `S3 Access Denied`
```json
{
  "statusCode": 500,
  "message": "Failed to upload to S3: Access Denied",
  "error": "Internal Server Error"
}
```
**Solution**: Verify IAM policy has `s3:PutObject` permission

---

#### 3. Mathpix Errors

**Error**: `Invalid Mathpix credentials`
```json
{
  "statusCode": 500,
  "message": "Mathpix authentication failed",
  "error": "Internal Server Error"
}
```
**Solution**: Check `MATHPIX_APP_ID` and `MATHPIX_APP_KEY` in `.env`

---

**Error**: `Mathpix conversion timeout`
```json
{
  "statusCode": 500,
  "message": "PDF parsing timed out after 300000ms",
  "error": "Internal Server Error"
}
```
**Solution**: Increase `maxPollingAttempts` or try smaller PDF

---

**Error**: `Insufficient Mathpix credits`
```json
{
  "statusCode": 500,
  "message": "Mathpix API error: Insufficient credits",
  "error": "Internal Server Error"
}
```
**Solution**: Add credits or upgrade Mathpix plan

---

#### 4. Validation Errors

**Error**: `Invalid examIds format`
```json
{
  "statusCode": 400,
  "message": "Invalid examIds format. Must be a JSON array.",
  "error": "Bad Request"
}
```
**Solution**: Pass examIds as JSON string: `'["id1", "id2"]'`

---

**Error**: `Upload not found`
```json
{
  "statusCode": 404,
  "message": "Upload with ID 507f1f77bcf86cd799439020 not found",
  "error": "Not Found"
}
```
**Solution**: Verify uploadId is correct and not deleted

---

## Best Practices

### 1. File Naming

✅ **Good**:
- `neet_2023_physics_part1.pdf`
- `jee_mains_2022_chemistry.pdf`
- `aiims_mock_test_biology.pdf`

❌ **Avoid**:
- `test.pdf` (too generic)
- `file (1).pdf` (special characters)
- `question paper final final v2.pdf` (too long)

### 2. Metadata Usage

Store useful information for later filtering:

```json
{
  "subjectId": "507f1f77bcf86cd799439011",
  "topicId": "507f1f77bcf86cd799439012",
  "examIds": ["507f1f77bcf86cd799439013"],
  "difficultyLevel": "medium",
  "metadata": {
    "examYear": "2023",
    "testSeries": "NEET Mock Test",
    "totalQuestions": 180,
    "totalMarks": 720,
    "duration": "3 hours",
    "source": "Official NEET Paper"
  }
}
```

### 3. Error Recovery

Implement retry logic for transient failures:

```typescript
async function uploadWithRetry(file: File, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await uploadPdf(file);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
}
```

### 4. Progress Tracking

For large files, show progress to users:

```typescript
const formData = new FormData();
formData.append('file', file);

await axios.post('/imports/upload-pdf', formData, {
  onUploadProgress: (progressEvent) => {
    const percentCompleted = Math.round(
      (progressEvent.loaded * 100) / progressEvent.total
    );
    console.log(`Upload progress: ${percentCompleted}%`);
  },
});
```

### 5. Async Processing

For production, consider background jobs:

```typescript
// Instead of waiting for Mathpix
await uploadPdf(file); // Quick response

// Queue parse job
await queueParseJob(uploadId); // Process in background

// Poll status endpoint
await checkParseStatus(uploadId); // Client checks periodically
```

---

## Status Flow

```
uploaded → parsing → parsed → processing → completed
                ↓
              failed
```

**Status Meanings**:
- `uploaded`: PDF stored in S3, not yet parsed
- `parsing`: Mathpix conversion in progress
- `parsed`: Markdown generated successfully
- `processing`: AI enrichment in progress
- `completed`: All processing complete
- `failed`: Error occurred (check logs)

---

## Monitoring

### Key Metrics to Track

1. **Upload Success Rate**: % of successful uploads
2. **Parse Success Rate**: % of successful Mathpix conversions
3. **Average Processing Time**: Time from upload to completion
4. **S3 Storage Usage**: Total bytes stored
5. **Mathpix API Usage**: Pages processed per month

### Logging

The service logs important events:

```
[ImportService] Uploading PDF to S3: neet_2023_physics.pdf (2.34 MB)
[S3Service] Uploaded to S3: question-uploads/anonymous/2023-06-29/...
[ImportService] PDF uploaded successfully: 507f1f77bcf86cd799439020
[ImportService] Starting PDF parsing for upload: 507f1f77bcf86cd799439020
[MathpixService] Submitted PDF to Mathpix: mp_abc123xyz789
[MathpixService] Polling Mathpix status (attempt 1/60)...
[MathpixService] Mathpix status: processing (45% complete)
[MathpixService] PDF parsing completed: mp_abc123xyz789
[ImportService] PDF parsed successfully in 45000ms (15.42 KB markdown)
```

---

## Next Steps

After successful upload and parse:

1. **Manual Review**: Check markdown quality in database
2. **Structure Detection**: Use AI to detect question format
3. **Chunk Questions**: Split markdown into individual questions
4. **AI Enrichment**: Extract question, options, answer, explanation
5. **Persist Questions**: Save to `questions` collection
6. **Create Mock Test**: Group questions into test

See existing endpoints:
- `POST /imports/debug/parse`: Test markdown parsing
- `POST /imports/debug/enrich`: Test AI enrichment
- `POST /imports/questions`: Persist questions

---

**Last Updated**: 2023-06-29  
**Maintained By**: EZ Prep Development Team
