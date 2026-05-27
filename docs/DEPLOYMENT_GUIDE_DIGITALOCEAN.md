# 🚀 Complete DigitalOcean Deployment Guide - EZ Prep API

**Last Updated**: May 19, 2026  
**Target**: Production deployment for 500-1000 concurrent users  
**Total Monthly Cost**: $12-36 (starting small, scale as needed)

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Phase 1: MongoDB Atlas Setup (FREE)](#phase-1-mongodb-atlas-setup)
3. [Phase 2: DigitalOcean Account Setup](#phase-2-digitalocean-account-setup)
4. [Phase 3: Create Your First Droplet](#phase-3-create-your-first-droplet)
5. [Phase 4: Server Configuration](#phase-4-server-configuration)
6. [Phase 5: Deploy Application](#phase-5-deploy-application)
7. [Phase 6: Domain & SSL Setup](#phase-6-domain--ssl-setup)
8. [Phase 7: Monitoring & Backups](#phase-7-monitoring--backups)
9. [Scaling Strategy](#scaling-strategy)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Deployment Strategy: Start Small, Scale Fast

**Philosophy**: Ship fast, scale when needed. Start with ONE droplet, add more when users grow.

### Deployment Phases by User Count

| Users | Setup | Monthly Cost |
|-------|-------|--------------|
| **0-500** (MVP Stage) | 1 droplet (2GB) + MongoDB Free | **$12/month** |
| **500-1500** (Growth) | 3 droplets + Load Balancer + MongoDB M2 | **~$66/month** |
| **1500-5000** (Scale) | 5 droplets (4GB) + MongoDB M10 | **~$150/month** |

**You start at Phase 1: MVP Stage** 🎯

---

## Pre-Deployment Checklist

Before you start, gather these:

- [ ] GitHub account (for code repository)
- [ ] Credit/Debit card for DigitalOcean (~$12/month)
- [ ] Domain name (optional, but recommended - ~$10/year)
- [ ] Your app's environment variables ready

**Time Required**: 2-3 hours for complete setup

---

## Phase 1: MongoDB Atlas Setup (FREE)

MongoDB Atlas is MongoDB's cloud service. **Free tier is perfect for MVP!**

### Step 1.1: Create MongoDB Atlas Account

1. Go to [https://www.mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)
2. Sign up with Google/GitHub or email
3. **Choose FREE tier** (M0 Sandbox)

### Step 1.2: Create Your First Cluster

1. After login, click **"Build a Database"**
2. **Choose deployment option**:
   - Select **"M0 FREE"** (512MB storage, shared CPU)
   - This is completely FREE forever! ✅
3. **Choose Cloud Provider & Region**:
   - Provider: **AWS** (most reliable free tier)
   - Region: Choose closest to your users (e.g., Mumbai for India, Singapore for Asia)
   - Click **"Create"**
4. **Set up Database User**:
   - Username: `ezprep-api` (or your choice)
   - Password: Click **"Autogenerate Secure Password"** and SAVE IT! 🔐
   - Click **"Create User"**
5. **Add Connection IP**:
   - Click **"Add My Current IP Address"**
   - Also add **"0.0.0.0/0"** (Allow access from anywhere - needed for your DO droplet)
   - ⚠️ **Security Note**: We'll restrict this later to only your droplet's IP
   - Click **"Finish and Close"**

### Step 1.3: Get Your Connection String

1. In Atlas dashboard, click **"Connect"**
2. Choose **"Connect your application"**
3. Select **"Driver: Node.js"** and **"Version: 5.5 or later"**
4. Copy the connection string (looks like this):
   ```
   mongodb+srv://ezprep-api:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. **Replace `<password>`** with the password you saved earlier
6. **Add database name** before the `?`:
   ```
   mongodb+srv://ezprep-api:YourPassword@cluster0.xxxxx.mongodb.net/ezprep-production?retryWrites=true&w=majority
   ```

**Save this connection string securely** - you'll need it later!

### MongoDB Free Tier Limits (M0)

| Resource | Limit | Good For |
|----------|-------|----------|
| Storage | 512MB | ~5,000-10,000 users with test data |
| RAM | Shared | Low-traffic apps |
| Bandwidth | Unlimited | ✅ Perfect! |
| Connections | 500 | Enough for 1-2 droplets |
| Cost | **FREE forever** | 🎉 |

**When to Upgrade?**
- **M2 ($9/month)**: When storage > 400MB or need 1000+ connections
- **M10 ($57/month)**: When users > 5000 or need dedicated resources

---

## Phase 2: DigitalOcean Account Setup

### Step 2.1: Create DigitalOcean Account

1. Go to [https://www.digitalocean.com/](https://www.digitalocean.com/)
2. Sign up (Get $200 credit for 60 days with referral codes - search "DigitalOcean promo")
3. Add payment method (credit/debit card)
4. Verify email

### Step 2.2: Setup SSH Key (for secure server access)

**On Windows (PowerShell)**:

```powershell
# Generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Press Enter to save in default location
# Set a passphrase (or press Enter for no passphrase)

# Copy public key to clipboard
Get-Content C:\Users\YourUsername\.ssh\id_ed25519.pub | Set-Clipboard

# Or display it to copy manually
Get-Content C:\Users\YourUsername\.ssh\id_ed25519.pub
```

**Add SSH Key to DigitalOcean**:

1. In DigitalOcean dashboard, go to **Settings → Security**
2. Click **"Add SSH Key"**
3. Paste your public key (the one you copied)
4. Name it: "My Laptop" or "Windows PC"
5. Click **"Add SSH Key"**

---

## Phase 3: Create Your First Droplet

### Step 3.1: Create Droplet

1. Click **"Create" → "Droplets"**
2. **Choose Image**:
   - **Ubuntu 22.04 LTS x64** (most stable)
3. **Choose Size**:
   - **Basic** plan
   - **Regular (Disk type: SSD)**
   - Select **$12/month** (2GB RAM, 1 vCPU, 50GB SSD)
4. **Choose Datacenter**:
   - Select closest to your users (Bangalore/Singapore for India)
5. **Authentication**:
   - Select **SSH Key** (the one you added earlier)
   - ✅ This is more secure than password
6. **Finalize**:
   - Quantity: **1 droplet**
   - Hostname: `ezprep-api-prod-01`
   - Tags: `production`, `api`, `nodejs`
   - **Enable Monitoring** (free!) ✅
   - **Enable Backups** ($2.40/month - 20% of droplet cost) - RECOMMENDED ✅
7. Click **"Create Droplet"**

⏱️ **Wait 1-2 minutes** for droplet to be created.

### Step 3.2: Note Your Droplet IP

Once created, you'll see your droplet's **IP address** (e.g., `143.198.123.45`)

**Save this IP address** - you'll use it throughout setup!

---

## Phase 4: Server Configuration

### Step 4.1: Connect to Your Droplet

**From Windows PowerShell**:

```powershell
# Replace with YOUR droplet IP
ssh root@143.198.123.45
```

Type `yes` when asked about fingerprint.

You're now connected to your Ubuntu server! 🎉

### Step 4.2: Initial Server Setup

```bash
# Update system packages
apt update && apt upgrade -y

# Install Node.js 20 LTS (required for NestJS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x

# Install PM2 (process manager - keeps your app running)
npm install -g pm2

# Install Nginx (web server / reverse proxy)
apt install -y nginx

# Install Git (to clone your code)
apt install -y git

# Install UFW (firewall)
apt install -y ufw
```

### Step 4.3: Create Application User (Security Best Practice)

```bash
# Don't run apps as root! Create a dedicated user
adduser ezprep --disabled-password --gecos ""

# Add to sudo group (for administrative tasks)
usermod -aG sudo ezprep

# Setup SSH for new user
mkdir -p /home/ezprep/.ssh
cp /root/.ssh/authorized_keys /home/ezprep/.ssh/
chown -R ezprep:ezprep /home/ezprep/.ssh
chmod 700 /home/ezprep/.ssh
chmod 600 /home/ezprep/.ssh/authorized_keys

# Switch to new user
su - ezprep
```

### Step 4.4: Configure Firewall

```bash
# Allow SSH (so you don't lock yourself out!)
sudo ufw allow OpenSSH

# Allow HTTP (port 80)
sudo ufw allow 80/tcp

# Allow HTTPS (port 443)
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Phase 5: Deploy Application

### Step 5.1: Clone Your Repository

```bash
# Go to home directory
cd ~

# Clone your repo (replace with YOUR GitHub URL)
git clone https://github.com/yourusername/ez-prep-api.git

# Navigate to project
cd ez-prep-api
```

**Don't have GitHub repo yet?** Create one:
1. Go to GitHub → New Repository
2. Push your local code:
   ```bash
   git remote add origin https://github.com/yourusername/ez-prep-api.git
   git push -u origin main
   ```

### Step 5.2: Create Environment File

```bash
# Create production environment file
nano .env
```

Paste this content (replace with YOUR values):

```bash
# Node Environment
NODE_ENV=production

# Server Configuration
PORT=3000

# MongoDB Configuration (from Atlas - Step 1.3)
MONGODB_URI=mongodb+srv://ezprep-api:YourPassword@cluster0.xxxxx.mongodb.net/ezprep-production?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-random-string
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# MSG91 Configuration (for OTP)
MSG91_AUTH_KEY=your-msg91-auth-key
MSG91_TEMPLATE_ID=your-template-id
MSG91_WIDGET_ID=your-widget-id

# API Keys (if any)
# Add other API keys here
```

**Press**: `Ctrl + X` → `Y` → `Enter` to save

**🔐 Security Tip**: Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5.3: Install Dependencies & Build

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Verify build succeeded
ls -la dist/
```

### Step 5.4: Test Application (Quick Check)

```bash
# Start app temporarily to test
npm run start:prod
```

Open another terminal and test:
```bash
curl http://localhost:3000/api/v1/health
```

Should return: `{"status":"ok",...}`

**Press `Ctrl + C`** to stop the test server.

### Step 5.5: Start with PM2 (Production Process Manager)

```bash
# Start app with PM2
pm2 start dist/main.js --name "ezprep-api" --instances 1 --max-memory-restart 400M

# Save PM2 configuration
pm2 save

# Setup PM2 to start on server reboot
pm2 startup
# Copy and run the command it shows

# Check status
pm2 status

# View logs
pm2 logs ezprep-api --lines 50
```

**PM2 Commands Reference**:
```bash
pm2 status              # Check app status
pm2 logs ezprep-api     # View live logs
pm2 restart ezprep-api  # Restart app
pm2 stop ezprep-api     # Stop app
pm2 delete ezprep-api   # Remove from PM2
pm2 monit               # Real-time monitoring
```

---

## Phase 6: Domain & SSL Setup

### Option A: Use Domain Name (Recommended)

**Prerequisites**: You own a domain (e.g., `api.ezprep.in`)

#### Step 6.1: Point Domain to Droplet

1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Add an **A Record**:
   - Host: `api` (or `@` for root domain)
   - Value: Your droplet IP (`143.198.123.45`)
   - TTL: 3600 (1 hour)
3. Wait 5-30 minutes for DNS propagation

#### Step 6.2: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/ezprep-api
```

Paste this configuration:

```nginx
# HTTP server (redirect to HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name api.ezprep.in;  # Replace with YOUR domain

    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server (will be configured after SSL)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.ezprep.in;  # Replace with YOUR domain

    # SSL certificates (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/api.ezprep.in/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/api.ezprep.in/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Proxy to Node.js app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (no auth required)
    location /api/v1/health {
        proxy_pass http://localhost:3000/api/v1/health;
        access_log off;
    }

    # Increase client body size (for file uploads)
    client_max_body_size 10M;

    # Logging
    access_log /var/log/nginx/ezprep-api.access.log;
    error_log /var/log/nginx/ezprep-api.error.log;
}
```

Save and enable the configuration:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ezprep-api /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### Step 6.3: Install SSL Certificate (Free with Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with YOUR domain)
sudo certbot --nginx -d api.ezprep.in

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose redirect HTTP to HTTPS (option 2)

# Verify auto-renewal
sudo certbot renew --dry-run
```

**🎉 Done!** Your API is now accessible at `https://api.ezprep.in`

Test it:
```bash
curl https://api.ezprep.in/api/v1/health
```

### Option B: Use IP Address (No Domain)

If you don't have a domain, configure Nginx to use IP:

```bash
sudo nano /etc/nginx/sites-available/ezprep-api
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name _;  # Accept any hostname

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    client_max_body_size 10M;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ezprep-api /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

**Access via**: `http://143.198.123.45/api/v1/health` (replace with your IP)

⚠️ **Note**: No SSL without domain, so data is not encrypted in transit.

---

## Phase 7: Monitoring & Backups

### Step 7.1: DigitalOcean Monitoring (Free!)

1. In DO dashboard, go to your droplet
2. Click **"Monitoring"** tab
3. View graphs for:
   - CPU usage
   - Memory usage
   - Disk I/O
   - Bandwidth

**Set up alerts**:
1. Click **"Create Alert Policy"**
2. Configure alerts for:
   - CPU > 80% for 5 minutes
   - Memory > 90% for 5 minutes
   - Disk usage > 80%
3. Add your email for notifications

### Step 7.2: Application Monitoring

**Check PM2 Dashboard**:
```bash
pm2 status
pm2 monit
```

**View Application Logs**:
```bash
# Live logs
pm2 logs ezprep-api

# Last 100 lines
pm2 logs ezprep-api --lines 100

# Error logs only
pm2 logs ezprep-api --err

# Application log files (Winston)
tail -f ~/ez-prep-api/logs/error.log
tail -f ~/ez-prep-api/logs/combined.log
```

### Step 7.3: Setup Log Rotation

```bash
# Create PM2 log rotation config
pm2 install pm2-logrotate

# Configure rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### Step 7.4: Automated Backups

**MongoDB Backups** (handled by Atlas):
- M0 (Free): No automated backups
- M2+ ($9+/month): Automated backups included
- Manual backup: Download via Atlas UI

**Droplet Backups** ($2.40/month):
- Enabled during droplet creation
- Weekly snapshots automatically
- Restore entire droplet if needed

**Manual Backup Script** (for code/configs):

```bash
# Create backup script
nano ~/backup.sh
```

```bash
#!/bin/bash
# Backup script for EZ Prep API

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/ezprep/backups"
APP_DIR="/home/ezprep/ez-prep-api"

mkdir -p $BACKUP_DIR

# Backup application code & configs
tar -czf $BACKUP_DIR/ezprep-backup-$DATE.tar.gz \
    $APP_DIR/.env \
    $APP_DIR/dist \
    /etc/nginx/sites-available/ezprep-api

# Keep only last 7 backups
cd $BACKUP_DIR
ls -t | tail -n +8 | xargs -r rm

echo "Backup completed: ezprep-backup-$DATE.tar.gz"
```

```bash
# Make executable
chmod +x ~/backup.sh

# Test backup
~/backup.sh

# Setup daily backup cron job
crontab -e
```

Add this line:
```
0 2 * * * /home/ezprep/backup.sh >> /home/ezprep/backup.log 2>&1
```

This runs backup daily at 2 AM.

---

## 🚀 Deployment Complete! Test Your API

### Test Endpoints

```bash
# Health check
curl https://api.ezprep.in/api/v1/health

# Swagger docs
curl https://api.ezprep.in/api/docs

# Get users (if public endpoint)
curl https://api.ezprep.in/api/v1/users
```

### Update Frontend to Use Production API

In your frontend app, update API URL:

```javascript
// Before (development)
const API_URL = 'http://localhost:3000/api/v1';

// After (production)
const API_URL = 'https://api.ezprep.in/api/v1';
```

---

## 📈 Scaling Strategy

### When to Scale?

Monitor these metrics weekly:

| Metric | Threshold | Action |
|--------|-----------|--------|
| CPU Usage | > 70% sustained | Add more droplets |
| Memory Usage | > 85% sustained | Upgrade droplet size |
| Response Time | > 500ms average | Add load balancer + droplets |
| Active Users | > 500 concurrent | Add load balancer |
| MongoDB Storage | > 400MB | Upgrade to M2 ($9/month) |
| API Errors | > 1% of requests | Investigate logs, fix bugs |

### Scaling Steps

#### Level 1 → Level 2: Add Load Balancer (500-1500 users)

**Cost**: Add $12 for load balancer + $12 per extra droplet

1. **Create 2 more droplets** (same as Step 3)
2. **Deploy app on each** (same as Phase 5)
3. **Create Load Balancer**:
   - In DO dashboard: Create → Load Balancers
   - Region: Same as droplets
   - Add all 3 droplets
   - Health checks: `/api/v1/health`
   - SSL: Upload your certificate OR use DO's Let's Encrypt integration
4. **Update DNS**:
   - Point domain to Load Balancer IP instead of droplet IP
5. **Update MongoDB Atlas**:
   - Upgrade to M2 for more connections

**New Cost**: $12 (LB) + $36 (3 droplets) + $9 (MongoDB M2) = **$57/month**

#### Level 2 → Level 3: Upgrade Droplet Size (1500-5000 users)

**Cost**: ~$150/month

1. **Resize droplets** to 4GB ($24/month each)
2. **Add more droplets** (5 total)
3. **Upgrade MongoDB** to M10 ($57/month) for dedicated resources
4. **Consider Redis** for caching (DigitalOcean Managed Redis: $15/month)

---

## 🔧 Common Operations

### Deploy New Code (Updates)

```bash
# SSH into droplet
ssh ezprep@143.198.123.45

# Navigate to project
cd ~/ez-prep-api

# Pull latest code
git pull origin main

# Install new dependencies (if any)
npm install

# Rebuild
npm run build

# Restart app with zero downtime
pm2 reload ezprep-api

# Check status
pm2 status

# View logs
pm2 logs ezprep-api --lines 50
```

### Update Environment Variables

```bash
# Edit .env file
nano ~/ez-prep-api/.env

# Make changes, save (Ctrl+X, Y, Enter)

# Restart app to apply changes
pm2 restart ezprep-api
```

### Database Operations

**Connect to MongoDB Atlas**:
1. Go to Atlas dashboard
2. Click "Connect" → "MongoDB Shell"
3. Install MongoDB Shell on your local machine
4. Run connection command

**View Database Statistics**:
- In Atlas: Dashboard shows storage usage, connections, operations

**Create Database Indexes** (if needed):
```javascript
// Connect via MongoDB Compass or Shell
db.users.createIndex({ email: 1 }, { unique: true })
db.mocktests.createIndex({ exam: 1, subject: 1 })
```

### View Server Resources

```bash
# CPU & Memory usage
htop

# Disk usage
df -h

# Nginx status
sudo systemctl status nginx

# PM2 monitoring
pm2 monit
```

---

## 🐛 Troubleshooting

### Issue: App won't start

**Solution**:
```bash
# Check PM2 logs
pm2 logs ezprep-api --err

# Common issues:
# 1. MongoDB connection failed - check MONGODB_URI in .env
# 2. Port 3000 already in use - check: sudo netstat -tulpn | grep 3000
# 3. Missing dependencies - run: npm install

# Try starting manually to see error
cd ~/ez-prep-api
npm run start:prod
```

### Issue: 502 Bad Gateway

**Solution**:
```bash
# Check if app is running
pm2 status

# If stopped, restart
pm2 restart ezprep-api

# Check Nginx error logs
sudo tail -f /var/log/nginx/ezprep-api.error.log

# Verify Nginx config
sudo nginx -t
```

### Issue: MongoDB connection timeout

**Solution**:
```bash
# 1. Check if IP is whitelisted in Atlas
# In Atlas: Network Access → Add IP Address → Add droplet IP

# 2. Test connection from droplet
node -e "const mongoose = require('mongoose'); mongoose.connect('YOUR_MONGODB_URI').then(() => console.log('Connected!')).catch(e => console.log(e));"

# 3. Check firewall
sudo ufw status
```

### Issue: SSL certificate expired

**Solution**:
```bash
# Certbot auto-renews, but if it fails:
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run

# Check certificate status
sudo certbot certificates
```

### Issue: Out of disk space

**Solution**:
```bash
# Check disk usage
df -h

# Find large files
du -h ~ | sort -hr | head -20

# Clean old logs
pm2 flush

# Clean old backups
rm ~/backups/*.tar.gz  # Keep recent ones manually

# Clean system packages
sudo apt autoremove
sudo apt autoclean
```

### Issue: High CPU usage

**Solution**:
```bash
# Check what's using CPU
htop

# Check PM2 stats
pm2 monit

# View app logs for errors
pm2 logs ezprep-api

# Possible causes:
# 1. Infinite loop in code
# 2. Too many requests (add rate limiting)
# 3. Inefficient database queries (add indexes)
# 4. Need to scale (add more droplets)
```

---

## 💰 Final Cost Breakdown

### Startup Phase (0-500 users) - **$12-14/month**

| Service | Plan | Cost |
|---------|------|------|
| DigitalOcean Droplet | 2GB RAM, 1 vCPU | $12/month |
| MongoDB Atlas | M0 Free Tier | **$0** |
| SSL Certificate | Let's Encrypt | **$0** |
| Backups (optional) | Droplet backups | +$2.40/month |
| **Total** | | **$12-14/month** |

### Growth Phase (500-1500 users) - **$66/month**

| Service | Plan | Cost |
|---------|------|------|
| DigitalOcean Droplets (3x) | 2GB RAM each | $36/month |
| Load Balancer | Standard | $12/month |
| MongoDB Atlas | M2 (2GB) | $9/month |
| Backups | 3 droplets | $7.20/month |
| **Total** | | **$66/month** |

### Plus:
- **Domain**: ~$10-15/year (one-time yearly)
- **DigitalOcean $200 Credit**: Covers first ~6 months if you get promo code!

---

## ✅ Post-Deployment Checklist

- [ ] Application is running (`pm2 status` shows "online")
- [ ] Health endpoint works: `https://api.ezprep.in/api/v1/health`
- [ ] Swagger docs accessible: `https://api.ezprep.in/api/docs`
- [ ] MongoDB connection successful (check logs)
- [ ] SSL certificate installed (green padlock in browser)
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] PM2 startup script enabled (survives server reboot)
- [ ] Monitoring alerts configured in DigitalOcean
- [ ] Backup strategy in place
- [ ] Frontend updated with production API URL
- [ ] DNS propagated (domain resolves to droplet IP)
- [ ] Test user registration/login flow
- [ ] Test core API endpoints
- [ ] Monitor logs for first 24 hours

---

## 🎯 Success Metrics to Monitor

Track these weekly:

1. **Uptime**: Should be > 99.5% (use UptimeRobot.com - free monitoring)
2. **Response Time**: Should be < 300ms average
3. **Error Rate**: Should be < 0.1% of requests
4. **Active Users**: Track growth
5. **Database Size**: Watch MongoDB storage usage
6. **Server CPU/Memory**: Should stay under 70%

---

## 📚 Additional Resources

### Documentation
- [DigitalOcean Tutorials](https://www.digitalocean.com/community/tutorials)
- [MongoDB Atlas Docs](https://www.mongodb.com/docs/atlas/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/getting-started/)

### Tools
- [Postman](https://www.postman.com/) - API testing
- [UptimeRobot](https://uptimerobot.com/) - Free uptime monitoring
- [MongoDB Compass](https://www.mongodb.com/products/compass) - Database GUI
- [PM2 Plus](https://pm2.io/) - Advanced monitoring (paid)

### Support
- DigitalOcean Support: Available via dashboard tickets
- MongoDB Atlas Support: Community forum + paid support
- NestJS Discord: Active community

---

## 🚨 Emergency Contacts

Keep these handy:

```
DigitalOcean Status: status.digitalocean.com
MongoDB Atlas Status: status.mongodb.com

DigitalOcean Droplet IP: ____________
MongoDB Connection String: ____________ (keep secure!)
Domain Registrar: ____________
SSH Key Location: C:\Users\YourUsername\.ssh\id_ed25519

Emergency Restart:
1. SSH: ssh ezprep@YOUR_IP
2. Restart: pm2 restart ezprep-api
3. Check: pm2 logs ezprep-api
```

---

## 🎉 You're Production Ready!

**What you've achieved**:
✅ Professional production deployment  
✅ Secure SSL encryption  
✅ Automated process management  
✅ Monitoring and backups  
✅ Ready to scale to 1000+ users  
✅ Total cost: $12-14/month to start!  

**Next Steps**:
1. Deploy your frontend
2. Test thoroughly with real users
3. Monitor performance daily for first week
4. Scale when metrics indicate (see Scaling Strategy)
5. Focus on building features and getting users!

---

**Remember**: Start small, ship fast, scale when needed. Your infrastructure can grow with your user base. Don't over-engineer early!

**Good luck with your launch! 🚀**

---

*Last Updated: May 19, 2026*  
*Maintained by: EZ Prep Development Team*
