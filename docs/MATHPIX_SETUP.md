# Mathpix API Setup Guide

This guide will help you configure Mathpix API for PDF to Markdown conversion in the EZ Prep API.

## What is Mathpix?

Mathpix is a powerful OCR (Optical Character Recognition) service that specializes in converting PDFs, images, and handwritten content to:
- Markdown
- LaTeX
- HTML
- DOCX

It's particularly excellent at recognizing:
- Mathematical equations
- Scientific notation
- Tables and diagrams
- Handwritten text
- Multiple languages

## Prerequisites

- Mathpix account
- Active subscription or trial credits

## Step 1: Create Mathpix Account

1. Visit [https://mathpix.com/](https://mathpix.com/)
2. Click **Sign Up** (or **Start Free Trial**)
3. Complete the registration process
4. Verify your email address

## Step 2: Get API Credentials

### Navigate to API Settings

1. Log in to [Mathpix Dashboard](https://mathpix.com/dashboard)
2. Click on your profile (top right)
3. Select **API Keys** or **Settings**
4. Go to **API Access** section

### Create API Key

1. Click **Create New Key** or **Generate API Key**
2. Give it a descriptive name: `EZ Prep API - Production`
3. Copy your credentials:
   - **App ID**: `your_app_id_here_xxxxx`
   - **App Key**: `your_app_key_here_xxxxxxxxxxxxx`

⚠️ **IMPORTANT**: Save these credentials securely. The App Key is only shown once!

Example credentials format:
```
App ID: app_abc123def456
App Key: sk_7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p
```

## Step 3: Configure Environment Variables

Add the following to your `.env` file in the project root:

```env
# Mathpix API Configuration
MATHPIX_APP_ID=app_abc123def456
MATHPIX_APP_KEY=sk_7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p
```

## Step 4: Install Required Dependencies

The Mathpix service uses Axios for HTTP requests. Install if not already present:

```bash
npm install axios
```

## Step 5: Verify Configuration

### Test PDF Parsing

1. Upload a PDF using the upload endpoint:
```bash
curl -X POST http://localhost:3000/imports/upload-pdf \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/test.pdf" \
  -F "difficultyLevel=medium"
```

2. Note the `uploadId` from the response

3. Parse the PDF using Mathpix:
```bash
curl -X POST http://localhost:3000/imports/parse-pdf/{uploadId} \
  -H "Content-Type: application/json" \
  -d '{
    "maxPollingAttempts": 60,
    "pollingIntervalMs": 5000
  }'
```

Expected response:
```json
{
  "message": "PDF parsed successfully",
  "data": {
    "uploadId": "...",
    "mathpixPdfId": "mp_abc123xyz789",
    "markdown": "## Question 1\n\nSolve for x: $x^2 + 5x + 6 = 0$\n\n...",
    "processingTimeMs": 45000,
    "status": "parsed",
    "markdownLength": 15420
  }
}
```

## Step 6: Understanding Mathpix Pricing

### Free Tier

- **1,000 free PDFs/month** (trial)
- All features included
- No credit card required for trial

### Paid Plans (as of 2023)

| Plan | Price | Pages/Month | Features |
|------|-------|-------------|----------|
| **Starter** | $9.99/mo | 500 pages | All OCR features |
| **Pro** | $49.99/mo | 2,500 pages | Priority processing |
| **Business** | $199.99/mo | 15,000 pages | Dedicated support |
| **Enterprise** | Custom | Unlimited | SLA, custom features |

### Cost Per Conversion

- Approximately **$0.02 - $0.10 per page**
- Depends on:
  - PDF complexity (equations, images)
  - Number of pages
  - Processing options (OCR language, formats)

### Estimate Your Usage

Example calculation for EZ Prep:
- Average question paper: **20 pages**
- Cost per paper: **$0.40 - $2.00**
- 100 uploads/month: **$40 - $200/month**
- **Starter plan sufficient for MVP**

## Configuration Options

### Processing Options

The Mathpix service supports these options (already configured in the code):

```typescript
const options: MathpixProcessOptions = {
  conversionFormats: {
    md: true,      // Markdown (primary format)
    html: false,   // HTML output
    docx: false,   // Word document
    tex: false,    // LaTeX source
  },
  includeImages: true,    // Extract and include images
  includeLatex: true,     // Preserve LaTeX equations
  ocrLanguage: 'en',      // OCR language (English)
};
```

### Polling Options

Control how the API waits for conversion completion:

```typescript
const pollingOptions: MathpixPollingOptions = {
  maxAttempts: 60,        // Maximum polling attempts
  intervalMs: 5000,       // 5 seconds between polls
  timeoutMs: 300000,      // 5 minutes total timeout
};
```

**Recommended Settings**:
- Simple PDFs (< 10 pages): `maxAttempts: 30`, `intervalMs: 3000`
- Complex PDFs (10-50 pages): `maxAttempts: 60`, `intervalMs: 5000`
- Large PDFs (50+ pages): `maxAttempts: 120`, `intervalMs: 10000`

## API Workflow

### 1. Submit PDF for Processing

```http
POST https://api.mathpix.com/v3/pdf
Headers:
  app_id: your_app_id
  app_key: your_app_key
Body:
  {
    "src": "https://public-url-to-pdf.com/file.pdf",
    "conversion_formats": { "md": true }
  }
```

Response:
```json
{
  "pdf_id": "mp_abc123xyz789",
  "status": "processing"
}
```

### 2. Poll for Completion

```http
GET https://api.mathpix.com/v3/pdf/mp_abc123xyz789
Headers:
  app_id: your_app_id
  app_key: your_app_key
```

Response (processing):
```json
{
  "pdf_id": "mp_abc123xyz789",
  "status": "processing",
  "percent_done": 45
}
```

Response (completed):
```json
{
  "pdf_id": "mp_abc123xyz789",
  "status": "completed",
  "md": "## Question 1\n\n..."
}
```

## Supported PDF Formats

### Recommended

✅ High-quality scanned PDFs
✅ Native PDFs with selectable text
✅ Black and white documents
✅ High contrast images
✅ Well-structured layouts

### Supported (with caveats)

⚠️ Handwritten text (accuracy varies)
⚠️ Low-resolution scans (< 300 DPI)
⚠️ Colored backgrounds
⚠️ Complex multi-column layouts
⚠️ Non-standard fonts

### Not Recommended

❌ Heavily compressed PDFs
❌ Password-protected PDFs
❌ Extremely low contrast
❌ Heavily distorted images

## Quality Tips

### For Best Results

1. **Scan Quality**:
   - Minimum 300 DPI resolution
   - Straight alignment (not skewed)
   - Clean, crisp text

2. **PDF Format**:
   - Prefer native PDFs over scans
   - Avoid excessive compression
   - Ensure proper page orientation

3. **Content Structure**:
   - Clear question numbering
   - Consistent formatting
   - Well-organized layout

## Troubleshooting

### Error: "Invalid credentials"

**Solution**: 
- Verify `MATHPIX_APP_ID` and `MATHPIX_APP_KEY` in `.env`
- Check for typos or extra spaces
- Ensure credentials are active in Mathpix dashboard

### Error: "Insufficient credits"

**Solution**:
- Check credit balance in Mathpix dashboard
- Upgrade plan or purchase additional credits
- Wait for monthly reset (free tier)

### Error: "Conversion timeout"

**Solution**:
- Increase `timeoutMs` in polling options
- Check PDF size (very large PDFs take longer)
- Try with smaller test PDF first

### Error: "Invalid PDF URL"

**Solution**:
- Ensure PDF is publicly accessible
- Check S3 pre-signed URL is not expired
- Verify CORS settings if using S3

### Poor OCR Quality

**Solution**:
- Check source PDF quality
- Ensure minimum 300 DPI for scans
- Try with higher resolution scan
- Report issues to Mathpix support

## Rate Limits

### Default Limits

- **10 requests/second** (PDF processing)
- **100 requests/second** (status checks)
- **Automatic retry** with exponential backoff

### Avoiding Rate Limits

1. Implement request queuing for bulk uploads
2. Use polling intervals wisely (5+ seconds)
3. Cache results to avoid reprocessing
4. Contact Mathpix for higher limits

## Security Considerations

### API Key Protection

✅ **DO**:
- Store keys in environment variables
- Use `.gitignore` for `.env` file
- Rotate keys periodically
- Use separate keys for dev/prod

❌ **DON'T**:
- Commit keys to version control
- Share keys in chat/email
- Use same key across projects
- Log keys in application logs

### PDF URL Security

- Use **pre-signed URLs** with short expiration (1 hour)
- Delete temporary public files after processing
- Don't expose sensitive PDFs with public URLs
- Consider IP whitelisting for production

## Monitoring

### Track Usage

Monitor in Mathpix Dashboard:
- Pages processed this month
- Remaining credits
- Success/failure rates
- Average processing time

### Application Monitoring

Log these metrics:
```typescript
logger.log({
  pdfId: result.pdfId,
  fileSize: pdfData.contentLength,
  processingTimeMs: result.processingTimeMs,
  markdownLength: result.markdown.length,
  status: 'success'
});
```

## Alternative Services

If Mathpix doesn't meet your needs:

| Service | Strengths | Pricing |
|---------|-----------|---------|
| **Adobe PDF Services** | Native PDF handling | $0.05/page |
| **Google Cloud Vision** | Handwriting, ML | $1.50/1000 pages |
| **AWS Textract** | Tables, forms | $1.50/1000 pages |
| **Tesseract OCR** | Free, open-source | Free (self-hosted) |

## Additional Resources

- [Mathpix API Documentation](https://docs.mathpix.com/)
- [Mathpix Dashboard](https://mathpix.com/dashboard)
- [Pricing Page](https://mathpix.com/pricing)
- [API Status Page](https://status.mathpix.com/)
- [Support](mailto:support@mathpix.com)

## Support

If you encounter issues:
1. Check Mathpix [status page](https://status.mathpix.com/)
2. Review server logs for detailed error messages
3. Verify API credentials are correct
4. Test with Mathpix's [online demo](https://mathpix.com/demo)
5. Contact Mathpix support for API-specific issues

---

**Last Updated**: 2023-06-29  
**Maintained By**: EZ Prep Development Team
