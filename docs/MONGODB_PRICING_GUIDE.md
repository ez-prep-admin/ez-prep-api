# 📊 MongoDB Pricing & Setup - Quick Reference

**Clear guide to MongoDB options and what to buy**

---

## 🎯 The Confusion Explained

You saw **two different prices** for MongoDB:

### Option 1: MongoDB Atlas (mongodb.com)
- **Website**: https://cloud.mongodb.com
- **M0 (Free)**: $0 - 512MB storage
- **M2**: $9/month - 2GB storage  
- **M10**: $57/month - 10GB storage (dedicated resources)

### Option 2: DigitalOcean Managed MongoDB
- **Website**: digitalocean.com → Databases
- **2GB Plan**: $30/month
- This is DigitalOcean's own MongoDB service

---

## ✅ What I Recommend: MongoDB Atlas M10

### Why MongoDB Atlas?

1. **Official MongoDB service** (not a reseller)
2. **Better pricing** for dedicated resources
3. **More features** (Atlas has more tools)
4. **Can use with any hosting** (DO, AWS, anywhere)
5. **Better support** (MongoDB experts)
6. **Easier migration** (widely used)

### Why M10 Specifically?

Since you said **"database is a choke point"**:

| Feature | M0 (Free) | M2 ($9/mo) | M10 ($57/mo) ✅ |
|---------|-----------|------------|-----------------|
| **Storage** | 512MB | 2GB | 10GB |
| **RAM** | Shared | Shared | 2GB Dedicated |
| **Connections** | 500 | 1,000 | 1,500 |
| **Performance** | Varies | Varies | Consistent |
| **Backups** | No | No | Yes + PITR |
| **Scaling** | No | Limited | Easy |
| **SLA** | No | No | 99.995% |

**M10 = First tier with dedicated resources** = Predictable performance

---

## 💰 Cost Comparison

### If You Use DigitalOcean Managed MongoDB

```
DigitalOcean MongoDB (2GB): $30/month
Total Cost:                 $30/month
```

**Problems**:
- Locked into DigitalOcean
- Harder to migrate later
- Less flexible scaling
- Fewer management tools

### If You Use MongoDB Atlas M10 ✅

```
MongoDB Atlas M10:          $57/month
Total Cost:                 $57/month
```

**Benefits**:
- Works anywhere (can switch from DO to AWS later)
- Better management tools
- Automated backups included
- Point-in-time recovery
- Better performance (dedicated)
- Industry standard

**Extra cost**: +$27/month BUT you get:
- 5x more storage (10GB vs 2GB)
- Dedicated resources (better performance)
- Automatic backups
- Better reliability

---

## 🛒 How to Buy MongoDB Atlas

### Step-by-Step Purchase Guide

#### 1. Create Account (Free)
- Go to: https://cloud.mongodb.com/
- Click "Try Free"
- Sign up with Google/GitHub/Email
- **No credit card required yet!**

#### 2. Create Cluster (Start with Free)
- Click "Build a Database"
- Select **M0 FREE** tier first
- Choose provider: AWS (most reliable)
- Choose region: Closest to your DO droplets
  - India users → Mumbai (ap-south-1)
  - Singapore users → Singapore (ap-southeast-1)
- Cluster name: `ezprep-production`
- Click "Create"

#### 3. Setup Database User
- Username: `ezprep-admin` (your choice)
- Password: Click "Autogenerate" → **SAVE IT!**
- Database User Privileges: `Atlas admin`
- Click "Add User"

#### 4. Setup Network Access
- Click "Add IP Address"
- Add: `0.0.0.0/0` (access from anywhere)
- ⚠️ We'll restrict this later to only your droplets
- Click "Confirm"

#### 5. Test with Free Tier First
- Click "Connect" → "Connect your application"
- Copy connection string
- Test your app with M0 Free tier

#### 6. Upgrade to M10 (When Ready)

**This is where you pay!**

- In Atlas dashboard, click your cluster
- Click "..." (three dots) → **"Edit Configuration"**
- Under "Cluster Tier", select **M10**
- Review changes:
  ```
  Current:  M0 (Free) - 512MB shared
  New:      M10 - 2GB RAM, 10GB storage
  Cost:     $57.00/month
  ```
- **Add payment method** (credit/debit card)
- Click **"Review Changes"**
- Confirm billing email
- Click **"Apply Changes"**
- Wait 5-10 minutes for upgrade (no downtime!)

#### 7. Enable Backups (Included in M10)
- Go to "Backup" tab
- Toggle ON "Cloud Backup"
- Set retention: 7 days (free with M10)
- Enable "Point-in-Time Recovery"
- Save

---

## 🔧 Connection String

After creating cluster, you'll get a connection string like:

```bash
mongodb+srv://ezprep-admin:<password>@ezprep-production.abc123.mongodb.net/?retryWrites=true&w=majority
```

**Update it**:

```bash
# Add database name BEFORE the ?
mongodb+srv://ezprep-admin:YourPassword@ezprep-production.abc123.mongodb.net/ezprep-production?retryWrites=true&w=majority&maxPoolSize=50&minPoolSize=10
```

**Add to your .env file**:

```bash
MONGODB_URI=mongodb+srv://ezprep-admin:YourPassword@ezprep-production.abc123.mongodb.net/ezprep-production?retryWrites=true&w=majority&maxPoolSize=50&minPoolSize=10
```

---

## 📅 When to Upgrade?

### Start with M0 (Free) if:
- ✅ Just testing/development
- ✅ Less than 100 active users
- ✅ Less than 300MB data
- ✅ Can tolerate occasional slowness

### Upgrade to M2 ($9/month) if:
- ✅ 100-500 users
- ✅ 300-800MB data
- ✅ Need better performance
- ✅ Budget is tight

### Upgrade to M10 ($57/month) if: ✅ **RECOMMENDED**
- ✅ 500+ users
- ✅ Database is slow (your case!)
- ✅ Need backups
- ✅ Need consistent performance
- ✅ Production app

### Upgrade to M20 ($129/month) if:
- ✅ 2,000+ users
- ✅ Need 4GB RAM
- ✅ 20GB storage needed

---

## 💳 Billing & Payment

### How Atlas Billing Works

1. **Monthly subscription** (not pay-as-you-go)
2. **Billed monthly** on the date you upgrade
3. **Pro-rated** if you upgrade mid-month
4. **Auto-renews** unless you downgrade/cancel
5. **Can downgrade** anytime (but not below current data size)

### Example Timeline

```
Day 1:  Create M0 Free - Test everything
Day 2:  Deploy app, test with real data
Day 3:  App working great!
Day 7:  Ready to launch - Upgrade to M10
        → Charged $57 immediately
        → Billed monthly from now on
Day 37: Next billing cycle - $57 charged again
```

### Payment Methods

- ✅ Credit Card (Visa, Mastercard, Amex)
- ✅ Debit Card
- ✅ PayPal
- ✅ ACH (US only)
- ❌ No prepaid cards usually

---

## 🔒 Security Best Practices

### After Creating Cluster

1. **Restrict IP Access**:
   ```
   Instead of: 0.0.0.0/0 (anywhere)
   Add only:   YOUR_DROPLET_IPS
   ```
   - In Atlas: Network Access → Edit
   - Remove `0.0.0.0/0`
   - Add each droplet IP individually

2. **Use Strong Password**:
   - Don't use: `password123`
   - Use: Auto-generated 32-character password
   - Store securely (password manager)

3. **Limit User Privileges**:
   - Create app user with only `readWrite` role
   - Keep `Atlas admin` user separate

4. **Enable Audit Logs** (M10+):
   - In Atlas: Security → Audit Log
   - Track all database operations

---

## 📊 Cost Summary - Complete Setup

### Minimal (Start Small)
```
DigitalOcean Droplet (2GB):  $12/month
MongoDB Atlas M0:            $0 (free)
────────────────────────────────────
TOTAL:                       $12/month
Capacity:                    0-500 users
```

### Recommended (Production-Ready) ✅
```
DigitalOcean Droplet (2GB):  $12/month
MongoDB Atlas M10:           $57/month
────────────────────────────────────
TOTAL:                       $69/month
Capacity:                    500-1,000 users
Database:                    Fast, reliable, backed up
```

### Scaling (Growth Phase)
```
DigitalOcean Droplets (3x):  $36/month
Load Balancer:               $12/month
MongoDB Atlas M10:           $57/month
Redis (1GB):                 $15/month
────────────────────────────────────
TOTAL:                       $120/month
Capacity:                    1,000-1,500 users
```

---

## 🎯 Action Plan

### Week 1: Test with Free Tier
1. Create MongoDB Atlas account (5 min)
2. Create M0 Free cluster (5 min)
3. Get connection string (2 min)
4. Update .env on droplet (2 min)
5. Test app (10 min)
6. Monitor performance (ongoing)

### Week 2: Upgrade to M10 (If Needed)
1. Add payment method to Atlas (2 min)
2. Upgrade cluster to M10 (2 min)
3. Wait for upgrade (10 min, automatic)
4. Enable backups (2 min)
5. Test performance improvement
6. Restrict IP access (5 min)

**Total Time**: 30-45 minutes  
**Total Cost**: $57/month (only if you upgrade)

---

## ❓ FAQs

**Q: Can I start with M0 and upgrade later?**  
A: Yes! Upgrade anytime with zero downtime.

**Q: What if I exceed M10 storage?**  
A: Atlas will warn you. Upgrade to M20 (20GB) for $129/month.

**Q: Can I downgrade from M10 to M2?**  
A: Yes, if your data is < 2GB. Downgrade anytime.

**Q: What happens if I don't pay?**  
A: Atlas will warn you → pause cluster → delete after 60 days. Always get warnings first!

**Q: Is there a free trial for M10?**  
A: Sometimes MongoDB offers $200 credits. Check their promotions.

**Q: Can I use both Atlas and DO MongoDB?**  
A: You can, but no reason to. Choose one.

**Q: Is data transfer charged?**  
A: No! Data transfer between your droplet and Atlas is free if in same region.

**Q: What about backups?**  
A: M10 includes 7-day automated backups + point-in-time recovery. No extra cost!

**Q: Can I export my data anytime?**  
A: Yes! Use `mongodump` or Atlas UI export. Your data, always accessible.

---

## 🚨 What You Need to Do NOW

1. **Don't buy anything yet!**
2. **Create Atlas account** (free)
3. **Create M0 cluster** (free)
4. **Test your app** with free tier
5. **Monitor for 1-2 weeks**:
   - Check storage usage
   - Check query performance
   - Check connection count
6. **If you hit limits** → Upgrade to M10
7. **If still OK** → Stay on free tier!

**Start free, upgrade when needed!**

---

## 📞 Support

**MongoDB Atlas Support**:
- Documentation: https://www.mongodb.com/docs/atlas/
- Community Forum: https://www.mongodb.com/community/forums/
- Email: support@mongodb.com (M10+ gets email support)
- Chat: Available in Atlas dashboard (M10+)

**Billing Questions**:
- Email: billing@mongodb.com
- Always respond to billing emails quickly!

---

## ✅ Final Recommendation

**For Your Use Case** ("database is a choke point"):

```
✅ Start with M0 Free to test
✅ If slow or limited → Upgrade to M10 ($57/month)
✅ Don't use DigitalOcean Managed MongoDB
✅ Use MongoDB Atlas M10 for production

Cost: $57/month
Value: Fast, reliable database with backups
ROI: Happy users, better performance, peace of mind
```

---

**Bottom Line**: You're buying **MongoDB Atlas M10** subscription for **$57/month** directly from **cloud.mongodb.com**. It's a monthly subscription, and you can upgrade from the free tier anytime!

---

*Last Updated: May 19, 2026*  
*Questions? Check the full deployment guide or MongoDB Atlas documentation.*
