# Markdown Storage Optimization - MongoDB Removed

## Overview

**Changed**: Markdown content is now stored **ONLY in S3**, not in MongoDB.

**Reason**: Markdown files can be very large (1MB+), which would quickly consume MongoDB storage space and slow down queries.

---

## What Changed

### 1. **Schema** (`src/imports/schemas/question-upload.schema.ts`)

**Removed**:
```typescript
@Prop({ type: String })
markdownContent?: string;  // ❌ REMOVED
```

**Kept**:
```typescript
@Prop({ type: String })
markdownS3Key?: string;  // ✅ S3 reference only
```

---

### 2. **Service** (`src/imports/import.service.ts`)

#### parseQuestionPdf()

**Before**:
```typescript
upload.markdownContent = conversionResult.markdown;  // ❌ Stored in DB
upload.markdownS3Key = markdownUploadResult.key;
```

**After**:
```typescript
// Markdown stored ONLY in S3
upload.markdownS3Key = markdownUploadResult.key;  // ✅ S3 reference only
```

**Note**: The immediate response still returns the full markdown content for convenience, but it's not saved to MongoDB.

---

#### getUploadDetails()

**Before**:
```typescript
return {
  // ...
  markdownContent: upload.markdownContent,  // ❌ From MongoDB
  markdownS3Key: upload.markdownS3Key,
}
```

**After**:
```typescript
return {
  // ...
  markdownS3Key: upload.markdownS3Key,  // ✅ S3 key only
  // To get markdown: download from S3 using this key
}
```

---

### 3. **DTOs** (`src/imports/dto/parse-question-pdf.dto.ts`)

#### ParseQuestionPdfResponseDto (Immediate Parse Response)

**Kept** (for immediate response convenience):
```typescript
{
  markdown: string,  // ✅ Full content returned immediately
  markdownS3Key: string,  // ✅ For future retrieval
}
```

---

#### GetUploadDetailsResponseDto (Later Retrieval)

**Removed**:
```typescript
markdownContent?: string;  // ❌ No longer in database
```

**Kept**:
```typescript
markdownS3Key?: string;  // ✅ Use this to retrieve from S3
```

---

### 4. **Controller Documentation** (`src/imports/import.controller.ts`)

**Updated** parse endpoint description:
```typescript
'The markdown content is saved to S3 and the S3 key is returned in the response. ' +
'The full markdown is also returned in the immediate response for convenience.'
```

---

## How to Retrieve Markdown Now

### Option 1: During Parse (Immediate Response)

```typescript
// Parse the PDF
const response = await fetch('/imports/parse-pdf/507f...020', {
  method: 'POST',
  body: JSON.stringify({ maxPollingAttempts: 60 })
});

const { data } = await response.json();

// ✅ Markdown available immediately in response
console.log(data.markdown);  // Full markdown content
console.log(data.markdownS3Key);  // S3 key for later retrieval
```

---

### Option 2: Later Retrieval from S3

```typescript
// Get upload details (no markdown in response now)
const upload = await questionUploadModel.findById(uploadId);

if (upload.markdownS3Key) {
  // Download from S3
  const markdownData = await s3Service.downloadFile(
    upload.markdownS3Key,
    upload.s3Bucket
  );
  
  const markdown = markdownData.body.toString('utf-8');
  console.log(markdown);  // Full markdown content
}
```

---

### Option 3: Direct S3 URL (for frontend)

```typescript
// Generate presigned URL for direct download
const upload = await questionUploadModel.findById(uploadId);

const presignedUrl = await s3Service.getPresignedUrl(
  upload.markdownS3Key,
  upload.s3Bucket,
  3600  // 1 hour expiration
);

// Frontend can download directly
window.open(presignedUrl);
```

---

## API Response Changes

### Before

#### GET /imports/uploads/:uploadId
```json
{
  "id": "507f1f77bcf86cd799439020",
  "title": "NEET 2023 Physics",
  "filename": "neet-2023-physics.pdf",
  "status": "parsed",
  "markdownContent": "## Question 1\n\n... (LARGE TEXT)",  // ❌ Removed
  "markdownS3Key": "question-uploads/anonymous/markdown/..."
}
```

---

### After

#### GET /imports/uploads/:uploadId
```json
{
  "id": "507f1f77bcf86cd799439020",
  "title": "NEET 2023 Physics",
  "filename": "neet-2023-physics.pdf",
  "status": "parsed",
  "markdownS3Key": "question-uploads/anonymous/markdown/..."  // ✅ Use this to download from S3
}
```

---

#### POST /imports/parse-pdf/:uploadId (Still returns markdown immediately)
```json
{
  "uploadId": "507f1f77bcf86cd799439020",
  "mathpixPdfId": "mp_abc123xyz789",
  "markdown": "## Question 1\n\n... (LARGE TEXT)",  // ✅ Still returned for convenience
  "markdownS3Key": "question-uploads/anonymous/markdown/...",
  "processingTimeMs": 45000,
  "status": "parsed",
  "markdownLength": 15420
}
```

---

## Code Examples

### Example 1: Parse and Save Markdown Reference

```typescript
// Service method (already implemented)
async parseQuestionPdf(uploadId: string): Promise<ParseQuestionPdfResponseDto> {
  // ... Mathpix conversion ...
  
  // Save to S3
  const markdownKey = `question-uploads/${userId}/markdown/${Date.now()}-${filename}.md`;
  await this.s3Service.uploadFile(markdownBuffer, { key: markdownKey });
  
  // Update database (S3 key only, no content)
  upload.markdownS3Key = markdownKey;  // ✅
  upload.status = 'parsed';
  await upload.save();
  
  // Return markdown in immediate response
  return {
    markdown: conversionResult.markdown,  // ✅ For immediate use
    markdownS3Key: markdownKey,  // ✅ For later retrieval
  };
}
```

---

### Example 2: Retrieve Markdown Later

```typescript
// New helper method you can add to ImportService
async getMarkdownContent(uploadId: string): Promise<string> {
  const upload = await this.questionUploadModel.findById(uploadId);
  
  if (!upload) {
    throw new NotFoundException('Upload not found');
  }
  
  if (!upload.markdownS3Key) {
    throw new BadRequestException('Markdown not yet parsed');
  }
  
  // Download from S3
  const markdownData = await this.s3Service.downloadFile(
    upload.markdownS3Key,
    upload.s3Bucket
  );
  
  return markdownData.body.toString('utf-8');
}
```

---

### Example 3: Process Markdown for LLM Enrichment

```typescript
// In your enrichment pipeline
async enrichQuestions(uploadId: string) {
  // Fetch markdown from S3 (not from MongoDB)
  const markdown = await this.importService.getMarkdownContent(uploadId);
  
  // Detect structure
  const structure = await this.structureDetector.detect(markdown);
  
  // Chunk by questions
  const chunks = await this.questionChunker.chunkByQuestions(markdown, structure);
  
  // Enrich with AI
  const enrichedQuestions = await this.enrichChunks(chunks);
  
  // Persist to questions collection
  await this.persistQuestions(enrichedQuestions);
}
```

---

## Storage Comparison

### Before (Hybrid Storage)

```
MongoDB Document Size:
- Metadata: ~2 KB
- Markdown content: ~500 KB (average)
- Total per document: ~502 KB

For 1,000 PDFs:
- MongoDB storage: ~502 MB
- S3 storage: ~500 MB (duplicate!)
- Total: ~1 GB (inefficient!)
```

---

### After (S3-Only Storage)

```
MongoDB Document Size:
- Metadata: ~2 KB
- S3 key reference: ~100 bytes
- Total per document: ~2.1 KB

For 1,000 PDFs:
- MongoDB storage: ~2.1 MB ✅
- S3 storage: ~500 MB
- Total: ~502 MB (50% reduction!)
```

---

## Benefits

### 1. **Reduced MongoDB Storage** ✅
- 99% smaller documents
- Faster queries
- Lower costs

### 2. **No 16MB Document Limit** ✅
- Can handle PDFs with 100+ pages
- Large markdown files (5MB+) no problem

### 3. **Better Performance** ✅
- Faster list queries (no large text fields)
- Indexes more efficient
- Pagination faster

### 4. **Scalability** ✅
- S3 handles unlimited storage
- MongoDB handles only metadata
- Each system does what it's best at

---

## Migration

### If You Have Existing Data

Run this migration to remove markdown content from existing documents:

```typescript
// migration.ts
import { QuestionUploadModel } from './schemas/question-upload.schema';

async function removeMarkdownFromMongoDB() {
  // Remove markdownContent field from all documents
  const result = await QuestionUploadModel.updateMany(
    { markdownContent: { $exists: true } },
    { $unset: { markdownContent: '' } }
  );
  
  console.log(`Removed markdown from ${result.modifiedCount} documents`);
  
  // Calculate space saved
  const stats = await QuestionUploadModel.collection.stats();
  console.log(`New collection size: ${stats.size / 1024 / 1024} MB`);
}
```

---

## Testing Checklist

- [x] Upload PDF → Parse → Verify markdown saved to S3 only
- [x] Check MongoDB document size (should be ~2KB)
- [x] Parse response returns full markdown (immediate use)
- [x] Get upload details does NOT return markdown content
- [x] List uploads returns only S3 keys
- [x] Swagger docs updated correctly
- [x] Can retrieve markdown from S3 when needed
- [x] Existing parsing pipeline still works

---

## Summary

**What Changed**:
- ❌ Removed: `markdownContent` field from MongoDB
- ✅ Kept: `markdownS3Key` field (S3 reference)
- ✅ Parse response still returns full markdown (immediate convenience)
- ✅ Later retrievals require downloading from S3

**Result**:
- 99% reduction in MongoDB document size
- No 16MB limit on markdown files
- Faster queries and better scalability
- Industry-standard pattern (S3 for files, MongoDB for metadata)

---

**Last Updated**: 2026-06-29  
**Maintained By**: EZ Prep Development Team
