# 🚀 Quick Setup Checklist

Follow these steps in order to complete the AWS S3 and Mathpix integration.

---

## 1️⃣ Install Dependencies

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner axios
```

**Why**: These packages are required for S3 operations and Mathpix API calls.

---

## 2️⃣ Setup AWS S3

### Create S3 Bucket
1. ☐ Log in to [AWS Console](https://console.aws.amazon.com/)
2. ☐ Navigate to **S3** service
3. ☐ Click **Create bucket**
4. ☐ Choose bucket name: `ez-prep-question-uploads` (or your preference)
5. ☐ Select region: `us-east-1` (or your preference)
6. ☐ Keep default security settings (Block all public access)
7. ☐ Click **Create bucket**

### Create IAM User
1. ☐ Navigate to **IAM** → **Users** → **Add users**
2. ☐ Username: `ez-prep-api-user`
3. ☐ Access type: **Programmatic access**
4. ☐ Click **Attach policies directly** → **Create policy**
5. ☐ Use JSON policy from [docs/AWS_S3_SETUP.md](./AWS_S3_SETUP.md#attach-permissions)
6. ☐ Name policy: `EZPrepS3QuestionUploadsPolicy`
7. ☐ Attach policy to user
8. ☐ **IMPORTANT**: Copy Access Key ID and Secret Access Key

---

## 3️⃣ Setup Mathpix

1. ☐ Sign up at [mathpix.com](https://mathpix.com/)
2. ☐ Verify email address
3. ☐ Log in to [Mathpix Dashboard](https://mathpix.com/dashboard)
4. ☐ Navigate to **API Keys** or **Settings**
5. ☐ Click **Create New Key**
6. ☐ Name: `EZ Prep API - Production`
7. ☐ **IMPORTANT**: Copy App ID and App Key

---

## 4️⃣ Configure Environment Variables

Add these to your `.env` file in project root:

```env
# AWS Configuration
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID_HERE
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY_HERE
AWS_REGION=us-east-1
AWS_S3_BUCKET=ez-prep-question-uploads

# Mathpix Configuration
MATHPIX_APP_ID=YOUR_MATHPIX_APP_ID_HERE
MATHPIX_APP_KEY=YOUR_MATHPIX_APP_KEY_HERE
```

**Replace** `YOUR_*_HERE` with actual values from steps 2 and 3.

---

## 5️⃣ Start the Server

```bash
npm run start:dev
```

**Expected output**:
```
[Nest] INFO [AwsConfigService] AWS configuration validated successfully
[Nest] INFO [NestApplication] Nest application successfully started
```

**If you see errors**, check:
- ☐ All environment variables are set correctly
- ☐ No typos in variable names
- ☐ `.env` file is in project root

---

## 6️⃣ Test Upload Endpoint

```bash
curl -X POST http://localhost:3000/imports/upload-pdf \
  -F "file=@test.pdf" \
  -F "difficultyLevel=medium"
```

**Expected response**:
```json
{
  "message": "Question paper PDF uploaded successfully",
  "data": {
    "uploadId": "...",
    "filename": "test.pdf",
    "s3Key": "...",
    "status": "uploaded"
  }
}
```

**Save the `uploadId`** for next step!

---

## 7️⃣ Test Parse Endpoint

Replace `YOUR_UPLOAD_ID` with the uploadId from step 6:

```bash
curl -X POST http://localhost:3000/imports/parse-pdf/YOUR_UPLOAD_ID \
  -H "Content-Type: application/json" \
  -d '{"maxPollingAttempts": 60, "pollingIntervalMs": 5000}'
```

**Expected**: This will take 30-120 seconds. You should see:
```json
{
  "message": "PDF parsed successfully",
  "data": {
    "uploadId": "...",
    "markdown": "## Question 1\n...",
    "status": "parsed"
  }
}
```

---

## 8️⃣ Test Get Upload Details

```bash
curl http://localhost:3000/imports/uploads/YOUR_UPLOAD_ID
```

**Expected**: Full upload details with markdown content.

---

## 9️⃣ Test List Uploads

```bash
curl http://localhost:3000/imports/uploads?page=1&limit=10
```

**Expected**: Paginated list of all uploads.

---

## 🎉 Success Criteria

Your integration is working if:

- ✅ All 4 API endpoints return successful responses
- ✅ PDF appears in your S3 bucket (check AWS Console)
- ✅ Database has `questionuploads` collection with your upload
- ✅ Markdown content is stored in database
- ✅ No errors in server logs

---

## 🚨 Troubleshooting

### Problem: "AWS credentials not found"
**Solution**: Check `.env` has `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

### Problem: "S3 Access Denied"
**Solution**: Verify IAM policy has `s3:PutObject` permission

### Problem: "Mathpix authentication failed"
**Solution**: Check `MATHPIX_APP_ID` and `MATHPIX_APP_KEY` in `.env`

### Problem: "Module not found"
**Solution**: Run `npm install` again

### Problem: "Upload timeout"
**Solution**: Check PDF file size (max 50MB)

### Problem: "Parse timeout"
**Solution**: Increase `maxPollingAttempts` to 120 for large PDFs

---

## 📚 More Help

- **AWS Setup**: See [docs/AWS_S3_SETUP.md](./AWS_S3_SETUP.md)
- **Mathpix Setup**: See [docs/MATHPIX_SETUP.md](./MATHPIX_SETUP.md)
- **API Usage**: See [docs/PDF_UPLOAD_PARSE_GUIDE.md](./PDF_UPLOAD_PARSE_GUIDE.md)
- **Full Summary**: See [docs/INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md)

---

## ✅ Completion Checklist

Mark these off as you complete them:

- [ ] Dependencies installed
- [ ] AWS S3 bucket created
- [ ] IAM user created with correct permissions
- [ ] Mathpix account created
- [ ] All environment variables added to `.env`
- [ ] Server starts without errors
- [ ] Upload endpoint works
- [ ] Parse endpoint works
- [ ] Get details endpoint works
- [ ] List uploads endpoint works
- [ ] Swagger docs accessible at `/api`

**When all checked**: Integration is complete! 🎉

---

**Last Updated**: 2023-06-29  
**Maintained By**: EZ Prep Development Team
