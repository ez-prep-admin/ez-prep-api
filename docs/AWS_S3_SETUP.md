# AWS S3 Setup Guide

This guide will help you configure AWS S3 for file uploads in the EZ Prep API.

## Prerequisites

- AWS Account
- AWS CLI (optional, but recommended)
- Basic understanding of AWS IAM and S3

## Step 1: Create an S3 Bucket

### Option A: Using AWS Console

1. Log in to [AWS Console](https://console.aws.amazon.com/)
2. Navigate to **S3** service
3. Click **Create bucket**
4. Configure your bucket:
   - **Bucket name**: `ez-prep-question-uploads` (or your preferred name)
   - **AWS Region**: Select your preferred region (e.g., `us-east-1`)
   - **Block Public Access settings**: Keep defaults (Block all public access) for security
   - **Bucket Versioning**: Enable (recommended)
   - **Tags**: Add tags for organization (optional)
5. Click **Create bucket**

### Option B: Using AWS CLI

```bash
aws s3 mb s3://ez-prep-question-uploads --region us-east-1
```

## Step 2: Create IAM User for API Access

### Create IAM User

1. Navigate to **IAM** service in AWS Console
2. Click **Users** → **Add users**
3. User name: `ez-prep-api-user`
4. Access type: Select **Programmatic access**
5. Click **Next: Permissions**

### Attach Permissions

1. Click **Attach policies directly**
2. Create a custom policy with S3 access:
   - Click **Create policy**
   - Click **JSON** tab
   - Paste the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3QuestionUploadsAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetObjectAcl",
        "s3:PutObjectAcl"
      ],
      "Resource": [
        "arn:aws:s3:::ez-prep-question-uploads",
        "arn:aws:s3:::ez-prep-question-uploads/*"
      ]
    }
  ]
}
```

3. Click **Next: Tags** → **Next: Review**
4. Name: `EZPrepS3QuestionUploadsPolicy`
5. Click **Create policy**
6. Go back to user creation, refresh policies, and attach your new policy
7. Click **Next: Tags** → **Next: Review** → **Create user**

### Save Credentials

⚠️ **IMPORTANT**: On the success page, you'll see:
- Access key ID
- Secret access key

**COPY THESE IMMEDIATELY** - you won't be able to see the secret key again!

Example:
```
Access key ID: AKIAIOSFODNN7EXAMPLE
Secret access key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

## Step 3: Configure Environment Variables

Add the following to your `.env` file in the project root:

```env
# AWS Configuration
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_S3_BUCKET=ez-prep-question-uploads

# Optional: Separate bucket for question uploads (defaults to AWS_S3_BUCKET)
# AWS_S3_QUESTION_UPLOADS_BUCKET=ez-prep-specific-uploads
```

## Step 4: Install Required Dependencies

The S3 service uses AWS SDK v3. Install the required packages:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner axios
```

## Step 5: Verify Configuration

### Test S3 Upload

Start your NestJS server and test the upload endpoint:

```bash
curl -X POST http://localhost:3000/imports/upload-pdf \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/test.pdf" \
  -F "subjectId=507f1f77bcf86cd799439011" \
  -F "difficultyLevel=medium"
```

Expected response:
```json
{
  "message": "Question paper PDF uploaded successfully",
  "data": {
    "uploadId": "...",
    "filename": "test.pdf",
    "s3Key": "question-uploads/anonymous/2023-06-29/...",
    "s3Bucket": "ez-prep-question-uploads",
    "fileSize": 123456,
    "status": "uploaded",
    "uploadedAt": "2023-06-29T10:30:00.000Z"
  }
}
```

## Step 6: Configure CORS (if needed for frontend uploads)

If you're allowing direct uploads from frontend:

1. Go to your S3 bucket
2. Click **Permissions** tab
3. Scroll to **Cross-origin resource sharing (CORS)**
4. Click **Edit** and add:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Step 7: Set Up Lifecycle Rules (Optional)

To automatically delete temporary files:

1. Go to your S3 bucket
2. Click **Management** tab
3. Click **Create lifecycle rule**
4. Name: `Delete temp files`
5. Scope: **Limit to prefix** → enter `temp/`
6. Actions: Check **Expire current versions of objects**
7. Days: `1` (delete after 1 day)
8. Click **Create rule**

## Security Best Practices

### 1. Use Environment Variables

✅ **DO**: Store credentials in `.env` file
```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

❌ **DON'T**: Hardcode credentials in code
```typescript
// NEVER DO THIS!
const credentials = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/...'
};
```

### 2. Use IAM Roles (Production)

For production on EC2, ECS, or Lambda:
- Attach IAM role to compute resource
- Remove `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from environment
- SDK will automatically use instance role credentials

### 3. Restrict Bucket Access

- Keep **Block Public Access** enabled
- Use pre-signed URLs for temporary access
- Set expiration on pre-signed URLs (default: 1 hour)

### 4. Enable Bucket Versioning

Protects against accidental deletion:
```bash
aws s3api put-bucket-versioning \
  --bucket ez-prep-question-uploads \
  --versioning-configuration Status=Enabled
```

### 5. Enable Server-Side Encryption

Encrypt data at rest:
```bash
aws s3api put-bucket-encryption \
  --bucket ez-prep-question-uploads \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

### 6. Monitor with CloudWatch

Set up alarms for:
- High number of requests
- Large data transfers
- Failed requests

## Troubleshooting

### Error: "MONGODB_URI environment variable is required"

**Solution**: Check if `.env` file is in project root and has correct format

### Error: "AWS credentials not found"

**Solution**: Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env`

### Error: "Access Denied" when uploading

**Solution**: 
1. Check IAM policy has `s3:PutObject` permission
2. Verify bucket name matches environment variable
3. Ensure IAM user has policy attached

### Error: "Bucket does not exist"

**Solution**: Create bucket with exact name from `AWS_S3_BUCKET` environment variable

### Error: "InvalidAccessKeyId"

**Solution**: Double-check access key ID is correct and user exists

## Cost Optimization

### S3 Pricing (us-east-1, as of 2023)

- **Storage**: $0.023 per GB/month (Standard)
- **Requests**: $0.005 per 1,000 PUT requests
- **Data Transfer**: $0.09 per GB out to internet

### Tips to Reduce Costs

1. **Use Intelligent-Tiering**: Automatically moves objects to cheaper storage
   ```bash
   aws s3api put-bucket-intelligent-tiering-configuration \
     --bucket ez-prep-question-uploads \
     --id default-config \
     --intelligent-tiering-configuration ...
   ```

2. **Set Lifecycle Policies**: Delete old temp files automatically

3. **Use CloudFront**: Cache frequently accessed files

4. **Compress Files**: Reduce storage and transfer costs

## Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [S3 Security Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)

## Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test AWS credentials with AWS CLI: `aws s3 ls`
4. Review IAM policy permissions

---

**Last Updated**: 2023-06-29  
**Maintained By**: EZ Prep Development Team
