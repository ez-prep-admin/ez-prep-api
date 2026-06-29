# PDF Upload & Parse - Categorization Updates

## Overview

This document describes the new features added to the PDF upload and parsing system:

1. **Title Field**: Optional user-friendly title for uploaded PDFs (auto-generated UUID if not provided)
2. **Markdown S3 Storage**: Mathpix-generated markdown is now saved to S3 with proper tagging
3. **Categorized List API**: New API response format that categorizes PDFs into "parsed" and "unparsed"

---

## Changes Made

### 1. Schema Updates

#### QuestionUpload Schema (`src/imports/schemas/question-upload.schema.ts`)

**Added Fields**:
- `title` (required, string, indexed) - User-friendly identifier for the PDF
- `markdownS3Key` (optional, string) - S3 key where the parsed markdown is stored

**Purpose**:
- `title`: Makes it easier to identify PDFs in the UI (e.g., "NEET 2023 Physics" instead of "file-1234.pdf")
- `markdownS3Key`: References the S3 location of the markdown file for later retrieval

---

### 2. DTO Updates

#### UploadQuestionPdfDto (`src/imports/dto/upload-question-pdf.dto.ts`)

**Added Field**:
```typescript
title?: string; // Optional title field
```

**Behavior**:
- If `title` is provided and not empty: Use it as-is
- If `title` is empty or not provided: Generate UUID using `uuidv4()`

**Example**:
```json
{
  "title": "NEET 2023 Physics Paper",  // Optional
  "subjectId": "507f1f77bcf86cd799439011",
  "difficultyLevel": "medium"
}
```

---

#### UploadQuestionPdfResponseDto

**Added Field**:
```typescript
title: string; // Always returned (UUID if not provided by user)
```

**Example Response**:
```json
{
  "message": "Question paper PDF uploaded successfully",
  "data": {
    "uploadId": "507f1f77bcf86cd799439020",
    "title": "NEET 2023 Physics Paper",  // NEW
    "filename": "neet-2023-physics.pdf",
    "s3Key": "question-uploads/anonymous/2023-06-29/...",
    "s3Bucket": "ez-prep-question-uploads",
    "fileSize": 2458624,
    "status": "uploaded",
    "uploadedAt": "2023-06-29T10:00:00.000Z"
  }
}
```

---

#### ParseQuestionPdfResponseDto

**Added Field**:
```typescript
markdownS3Key?: string; // S3 key where markdown is saved
```

**Example Response**:
```json
{
  "message": "PDF parsed successfully",
  "data": {
    "uploadId": "507f1f77bcf86cd799439020",
    "mathpixPdfId": "mp_abc123xyz789",
    "markdown": "## Question 1\n...",
    "markdownS3Key": "question-uploads/anonymous/markdown/1688035200000-neet_2023_physics.md",  // NEW
    "processingTimeMs": 45000,
    "status": "parsed",
    "markdownLength": 15420
  }
}
```

---

#### New DTOs Added

**UploadMetadataDto** - Lightweight metadata for list responses:
```typescript
{
  id: string;
  title: string;          // NEW
  filename: string;
  fileSize: number;
  status: string;
  s3Key: string;
  markdownS3Key?: string; // NEW
  // ... other fields
}
```

**CategorizedUploadsResponseDto** - New list response format:
```typescript
{
  parsed: UploadMetadataDto[];    // PDFs with markdown
  unparsed: UploadMetadataDto[];  // PDFs without markdown
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    parsedCount: number;          // NEW
    unparsedCount: number;        // NEW
  }
}
```

---

### 3. Service Updates

#### ImportService (`src/imports/import.service.ts`)

##### uploadQuestionPdf()

**Changes**:
1. Accepts optional `title` from DTO
2. Generates UUID if title is empty or not provided
3. Stores title in database and S3 metadata

**Code**:
```typescript
const title = dto.title?.trim() || uuidv4();

// Upload to S3 with title in metadata
const uploadResult = await this.s3Service.uploadFile(file.buffer, {
  key: s3Key,
  contentType: file.mimetype,
  metadata: {
    originalName: file.originalname,
    title: title,  // NEW
    uploadedBy: userId ?? 'anonymous',
    ...dto.metadata,
  },
});

// Save to database
const upload = new this.questionUploadModel({
  title: title,  // NEW
  filename: file.originalname,
  // ... rest of fields
});
```

---

##### parseQuestionPdf()

**Changes**:
1. After Mathpix conversion, saves markdown to S3
2. Creates S3 key in format: `question-uploads/{userId}/markdown/{timestamp}-{filename}.md`
3. Tags markdown file with metadata linking it to PDF
4. Stores `markdownS3Key` in database

**New Code**:
```typescript
// Save markdown to S3
const markdownKey = `question-uploads/${userId ?? 'anonymous'}/markdown/${Date.now()}-${upload.filename.replace('.pdf', '.md')}`;
const markdownBuffer = Buffer.from(conversionResult.markdown, 'utf-8');

const markdownUploadResult = await this.s3Service.uploadFile(markdownBuffer, {
  key: markdownKey,
  contentType: 'text/markdown',
  metadata: {
    originalPdfKey: upload.s3Key,
    mathpixPdfId: conversionResult.pdfId,
    title: upload.title,
    uploadId: upload._id.toString(),
  },
  tags: {
    type: 'markdown',
    source: 'mathpix',
    pdfUploadId: upload._id.toString(),
  },
});

// Update database
upload.markdownS3Key = markdownUploadResult.key;  // NEW
```

**S3 Structure**:
```
s3://ez-prep-question-uploads/
├── question-uploads/
│   ├── anonymous/
│   │   ├── 2023-06-29/
│   │   │   └── 1688035200000-neet_2023_physics.pdf  (Original PDF)
│   │   └── markdown/
│   │       └── 1688035200000-neet_2023_physics.md    (Parsed markdown)
│   └── user123/
│       ├── 2023-06-29/
│       │   └── 1688035300000-jee_2023_math.pdf
│       └── markdown/
│           └── 1688035300000-jee_2023_math.md
└── temp/  (temporary files for Mathpix, auto-deleted)
```

---

##### listUploads()

**Changes**:
1. No longer accepts `status` filter parameter
2. Returns categorized response with `parsed` and `unparsed` arrays
3. Categorization logic:
   - **Parsed**: `status` in `['parsed', 'processing', 'completed']` (has markdown)
   - **Unparsed**: `status` in `['uploaded', 'parsing', 'failed']` (no markdown)

**Old Signature**:
```typescript
async listUploads(
  page: number,
  limit: number,
  status?: string,  // REMOVED
): Promise<{ data: any[]; pagination: any }>
```

**New Signature**:
```typescript
async listUploads(
  page: number = 1,
  limit: number = 10,
): Promise<CategorizedUploadsResponseDto>
```

**Logic**:
```typescript
// Fetch all uploads
const allUploads = await this.questionUploadModel
  .find()
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit)
  .exec();

// Categorize
const parsed: UploadMetadataDto[] = [];
const unparsed: UploadMetadataDto[] = [];

for (const upload of allUploads) {
  if (['parsed', 'processing', 'completed'].includes(upload.status)) {
    parsed.push(mapToMetadata(upload));
  } else {
    unparsed.push(mapToMetadata(upload));
  }
}

return { parsed, unparsed, pagination };
```

---

### 4. Controller Updates

#### ImportController (`src/imports/import.controller.ts`)

##### POST /imports/upload-pdf

**Changes**:
- Added `title` field to Swagger documentation
- Updated response to include `title`

**Swagger Body Schema**:
```typescript
{
  file: { type: 'binary', required: true },
  title: { 
    type: 'string', 
    description: 'Title/name for the PDF (optional). If not provided, a UUID will be generated.',
    example: 'NEET 2023 Physics Paper'
  },
  // ... other fields
}
```

---

##### GET /imports/uploads

**Changes**:
- Removed `status` query parameter
- Updated response type to `CategorizedUploadsResponseDto`
- Updated Swagger documentation

**Old Endpoint**:
```typescript
GET /imports/uploads?page=1&limit=10&status=parsed
```

**New Endpoint**:
```typescript
GET /imports/uploads?page=1&limit=10
```

**Old Response**:
```json
{
  "message": "Uploads retrieved successfully",
  "data": [
    { "id": "...", "filename": "...", "status": "parsed" },
    { "id": "...", "filename": "...", "status": "uploaded" }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 2, "totalPages": 1 }
}
```

**New Response**:
```json
{
  "message": "Uploads retrieved successfully",
  "data": {
    "parsed": [
      {
        "id": "507f1f77bcf86cd799439020",
        "title": "NEET 2023 Physics Paper",
        "filename": "neet-2023-physics.pdf",
        "fileSize": 2458624,
        "status": "parsed",
        "s3Key": "question-uploads/anonymous/2023-06-29/...",
        "markdownS3Key": "question-uploads/anonymous/markdown/...",
        "createdAt": "2023-06-29T10:00:00.000Z",
        "updatedAt": "2023-06-29T10:01:30.000Z"
      }
    ],
    "unparsed": [
      {
        "id": "507f1f77bcf86cd799439021",
        "title": "JEE 2023 Math Paper",
        "filename": "jee-2023-math.pdf",
        "fileSize": 1234567,
        "status": "uploaded",
        "s3Key": "question-uploads/anonymous/2023-06-29/...",
        "markdownS3Key": null,
        "createdAt": "2023-06-29T11:00:00.000Z",
        "updatedAt": "2023-06-29T11:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 2,
      "totalPages": 1,
      "parsedCount": 1,
      "unparsedCount": 1
    }
  }
}
```

---

## API Usage Examples

### 1. Upload PDF with Title

```bash
curl -X POST http://localhost:3000/imports/upload-pdf \
  -F "file=@neet-2023-physics.pdf" \
  -F "title=NEET 2023 Physics Paper" \
  -F "difficultyLevel=medium"
```

**Response**:
```json
{
  "message": "Question paper PDF uploaded successfully",
  "data": {
    "uploadId": "507f1f77bcf86cd799439020",
    "title": "NEET 2023 Physics Paper",
    "filename": "neet-2023-physics.pdf",
    "s3Key": "question-uploads/anonymous/2023-06-29/1688035200000-neet-2023-physics.pdf",
    "s3Bucket": "ez-prep-question-uploads",
    "fileSize": 2458624,
    "status": "uploaded",
    "uploadedAt": "2023-06-29T10:00:00.000Z"
  }
}
```

---

### 2. Upload PDF without Title (UUID Generated)

```bash
curl -X POST http://localhost:3000/imports/upload-pdf \
  -F "file=@test.pdf" \
  -F "difficultyLevel=easy"
```

**Response**:
```json
{
  "message": "Question paper PDF uploaded successfully",
  "data": {
    "uploadId": "507f1f77bcf86cd799439021",
    "title": "f47ac10b-58cc-4372-a567-0e02b2c3d479",  // UUID generated
    "filename": "test.pdf",
    "s3Key": "question-uploads/anonymous/2023-06-29/1688035300000-test.pdf",
    "s3Bucket": "ez-prep-question-uploads",
    "fileSize": 123456,
    "status": "uploaded",
    "uploadedAt": "2023-06-29T11:00:00.000Z"
  }
}
```

---

### 3. Parse PDF (Saves Markdown to S3)

```bash
curl -X POST http://localhost:3000/imports/parse-pdf/507f1f77bcf86cd799439020 \
  -H "Content-Type: application/json" \
  -d '{"maxPollingAttempts": 60, "pollingIntervalMs": 5000}'
```

**Response**:
```json
{
  "message": "PDF parsed successfully",
  "data": {
    "uploadId": "507f1f77bcf86cd799439020",
    "mathpixPdfId": "mp_abc123xyz789",
    "markdown": "## Question 1\n\nSolve for x: $x^2 + 5x + 6 = 0$\n\n...",
    "markdownS3Key": "question-uploads/anonymous/markdown/1688035500000-neet-2023-physics.md",
    "processingTimeMs": 45000,
    "status": "parsed",
    "markdownLength": 15420
  }
}
```

---

### 4. List Uploads (Categorized)

```bash
curl http://localhost:3000/imports/uploads?page=1&limit=10
```

**Response**:
```json
{
  "message": "Uploads retrieved successfully",
  "data": {
    "parsed": [
      {
        "id": "507f1f77bcf86cd799439020",
        "title": "NEET 2023 Physics Paper",
        "filename": "neet-2023-physics.pdf",
        "fileSize": 2458624,
        "status": "parsed",
        "s3Key": "question-uploads/anonymous/2023-06-29/1688035200000-neet-2023-physics.pdf",
        "markdownS3Key": "question-uploads/anonymous/markdown/1688035500000-neet-2023-physics.md",
        "subjectId": "507f1f77bcf86cd799439011",
        "difficultyLevel": "medium",
        "createdAt": "2023-06-29T10:00:00.000Z",
        "updatedAt": "2023-06-29T10:01:30.000Z"
      }
    ],
    "unparsed": [
      {
        "id": "507f1f77bcf86cd799439021",
        "title": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "filename": "test.pdf",
        "fileSize": 123456,
        "status": "uploaded",
        "s3Key": "question-uploads/anonymous/2023-06-29/1688035300000-test.pdf",
        "markdownS3Key": null,
        "createdAt": "2023-06-29T11:00:00.000Z",
        "updatedAt": "2023-06-29T11:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 2,
      "totalPages": 1,
      "parsedCount": 1,
      "unparsedCount": 1
    }
  }
}
```

---

## Frontend Integration

### Display Logic

```typescript
// Fetch uploads
const response = await fetch('/imports/uploads?page=1&limit=20');
const { data } = await response.json();

// Display parsed PDFs (ready to import)
console.log('PDFs ready to import:', data.parsed.length);
data.parsed.forEach(pdf => {
  console.log(`✅ ${pdf.title} - ${pdf.status}`);
  console.log(`   Markdown: ${pdf.markdownS3Key}`);
});

// Display unparsed PDFs (need parsing)
console.log('PDFs waiting for parsing:', data.unparsed.length);
data.unparsed.forEach(pdf => {
  console.log(`⏳ ${pdf.title} - ${pdf.status}`);
});

// Statistics
console.log(`Total: ${data.pagination.total}`);
console.log(`Parsed: ${data.pagination.parsedCount}`);
console.log(`Unparsed: ${data.pagination.unparsedCount}`);
```

---

### UI Components

**Parsed PDFs Section**:
```tsx
<Section title="Ready to Import" count={data.parsed.length}>
  {data.parsed.map(pdf => (
    <PDFCard key={pdf.id}>
      <Title>{pdf.title}</Title>
      <Filename>{pdf.filename}</Filename>
      <Badge status="parsed">Markdown Available</Badge>
      <Button onClick={() => importMarkdown(pdf.id)}>
        Import Questions
      </Button>
    </PDFCard>
  ))}
</Section>
```

**Unparsed PDFs Section**:
```tsx
<Section title="Waiting for Parsing" count={data.unparsed.length}>
  {data.unparsed.map(pdf => (
    <PDFCard key={pdf.id}>
      <Title>{pdf.title}</Title>
      <Filename>{pdf.filename}</Filename>
      <Badge status={pdf.status}>{pdf.status}</Badge>
      {pdf.status === 'uploaded' && (
        <Button onClick={() => parsePDF(pdf.id)}>
          Parse with Mathpix
        </Button>
      )}
      {pdf.status === 'parsing' && (
        <Spinner>Parsing...</Spinner>
      )}
      {pdf.status === 'failed' && (
        <ErrorMessage>{pdf.errorMessage}</ErrorMessage>
      )}
    </PDFCard>
  ))}
</Section>
```

---

## Database Queries

### Find All Parsed PDFs

```typescript
const parsedPDFs = await questionUploadModel.find({
  status: { $in: ['parsed', 'processing', 'completed'] },
  markdownS3Key: { $exists: true },
});
```

---

### Find Unparsed PDFs

```typescript
const unparsedPDFs = await questionUploadModel.find({
  status: { $in: ['uploaded', 'parsing', 'failed'] },
  markdownS3Key: { $exists: false },
});
```

---

### Get Markdown from S3

```typescript
const upload = await questionUploadModel.findById(uploadId);

if (upload.markdownS3Key) {
  const markdownData = await s3Service.downloadFile(
    upload.markdownS3Key,
    upload.s3Bucket,
  );
  const markdownText = markdownData.body.toString('utf-8');
  console.log('Markdown content:', markdownText);
}
```

---

## Status Categorization

| Status | Category | Description | Has Markdown? |
|--------|----------|-------------|---------------|
| `uploaded` | Unparsed | PDF uploaded, not parsed yet | ❌ No |
| `parsing` | Unparsed | Currently being parsed by Mathpix | ❌ No |
| `parsed` | **Parsed** | ✅ Markdown generated successfully | ✅ Yes |
| `processing` | **Parsed** | AI enrichment in progress | ✅ Yes |
| `completed` | **Parsed** | Fully processed and stored | ✅ Yes |
| `failed` | Unparsed | Parsing or processing failed | ❌ No |

---

## Migration Notes

### Existing Data

If you have existing uploads without `title` or `markdownS3Key`:

1. **Title**: Run migration to add UUID to existing records
2. **MarkdownS3Key**: Re-parse existing PDFs to generate markdown S3 keys

**Migration Script** (example):
```typescript
import { v4 as uuidv4 } from 'uuid';

async function migrateExistingUploads() {
  const uploads = await questionUploadModel.find({ title: { $exists: false } });
  
  for (const upload of uploads) {
    upload.title = uuidv4();
    await upload.save();
  }
  
  console.log(`Migrated ${uploads.length} uploads`);
}
```

---

## Benefits

### 1. Better UX
- User-friendly titles instead of cryptic filenames
- Clear categorization of parsed vs unparsed PDFs
- Easy to identify which PDFs are ready to import

### 2. Better Organization
- Markdown stored separately in S3
- Proper tagging and metadata
- Easy to retrieve markdown for later processing

### 3. Better Tracking
- Status counts in pagination
- Clear workflow: Upload → Parse → Process → Import
- Error states clearly identified

### 4. Better Performance
- Markdown not stored in MongoDB (reduces doc size)
- S3 handles large markdown files efficiently
- Categorization done in memory (fast)

---

## Testing Checklist

- [ ] Upload PDF with title
- [ ] Upload PDF without title (verify UUID generated)
- [ ] Parse PDF (verify markdown saved to S3)
- [ ] List uploads (verify categorization)
- [ ] Check S3 bucket structure
- [ ] Verify markdown S3 tags
- [ ] Download markdown from S3
- [ ] Test pagination with categorized response
- [ ] Swagger documentation updated

---

**Last Updated**: 2023-06-29  
**Maintained By**: EZ Prep Development Team
