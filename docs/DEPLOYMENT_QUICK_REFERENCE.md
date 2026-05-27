# 🚀 Quick Deployment Reference - EZ Prep API

**Cheat sheet for common deployment operations**

---

## 📞 Quick Access

```bash
# SSH into server
ssh ezprep@YOUR_DROPLET_IP

# View app status
pm2 status

# View live logs
pm2 logs ezprep-api

# Restart app
pm2 restart ezprep-api
```

---

## 🔄 Deploy New Code (Most Common Operation)

```bash
# 1. SSH into droplet
ssh ezprep@YOUR_DROPLET_IP

# 2. Navigate to project
cd ~/ez-prep-api

# 3. Pull latest code
git pull origin main

# 4. Install dependencies (if package.json changed)
npm install

# 5. Rebuild
npm run build

# 6. Restart with zero downtime
pm2 reload ezprep-api

# 7. Verify
pm2 logs ezprep-api --lines 20
```

**Time**: ~2 minutes

---

## 🔧 PM2 Commands

```bash
# Status
pm2 status                    # All apps
pm2 describe ezprep-api       # Detailed info

# Logs
pm2 logs ezprep-api           # Live logs
pm2 logs ezprep-api --lines 100   # Last 100 lines
pm2 logs ezprep-api --err     # Error logs only
pm2 flush                     # Clear all logs

# Control
pm2 restart ezprep-api        # Restart (downtime)
pm2 reload ezprep-api         # Zero-downtime restart
pm2 stop ezprep-api           # Stop app
pm2 start ezprep-api          # Start app

# Monitoring
pm2 monit                     # Real-time dashboard
pm2 info ezprep-api          # Memory, CPU, uptime
```

---

## 🌐 Nginx Commands

```bash
# Test configuration
sudo nginx -t

# Reload (no downtime)
sudo systemctl reload nginx

# Restart (brief downtime)
sudo systemctl restart nginx

# Status
sudo systemctl status nginx

# View logs
sudo tail -f /var/log/nginx/ezprep-api.access.log
sudo tail -f /var/log/nginx/ezprep-api.error.log
```

---

## 🗄️ MongoDB Operations

```bash
# Check connection from server
node -e "require('mongoose').connect(process.env.MONGODB_URI || 'YOUR_URI').then(() => console.log('✅ Connected')).catch(e => console.log('❌ Error:', e.message))"

# View MongoDB Atlas dashboard
# → Go to https://cloud.mongodb.com
# → Select your cluster
# → View metrics, storage, connections
```

---

## 📊 Server Monitoring

```bash
# System resources
htop                          # Interactive process viewer
df -h                         # Disk usage
free -h                       # Memory usage
uptime                        # Server uptime & load

# Network
sudo netstat -tulpn           # Open ports
sudo netstat -an | grep :3000 # Check port 3000

# Firewall
sudo ufw status               # Firewall rules
```

---

## 🔐 SSL Certificate

```bash
# Renew certificates (auto-runs, but manual if needed)
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run

# Check certificate status
sudo certbot certificates

# View expiry date
echo | openssl s_client -servername api.ezprep.in -connect api.ezprep.in:443 2>/dev/null | openssl x509 -noout -dates
```

---

## 🧹 Maintenance

```bash
# Clean old logs
pm2 flush

# Update system packages
sudo apt update
sudo apt upgrade -y

# Clean old packages
sudo apt autoremove
sudo apt autoclean

# Check disk space
df -h
du -sh /home/ezprep/*        # Check folder sizes

# Reboot server (if needed)
sudo reboot
```

---

## 🐛 Emergency Troubleshooting

### App won't start

```bash
# Check PM2 logs
pm2 logs ezprep-api --err

# Try manual start to see error
cd ~/ez-prep-api
npm run start:prod

# Check if port 3000 is in use
sudo netstat -tulpn | grep 3000

# Kill process on port 3000 (if needed)
sudo kill -9 $(sudo lsof -t -i:3000)
```

### 502 Bad Gateway

```bash
# Check if app is running
pm2 status

# Restart app
pm2 restart ezprep-api

# Check Nginx error
sudo tail -20 /var/log/nginx/ezprep-api.error.log

# Verify Nginx config
sudo nginx -t
```

### High CPU/Memory

```bash
# Check what's using resources
htop
pm2 monit

# Restart app to free memory
pm2 restart ezprep-api

# Check for memory leaks in logs
pm2 logs ezprep-api | grep -i "memory\|heap"
```

### Can't SSH

```bash
# From your local machine
# Check if droplet is responsive
ping YOUR_DROPLET_IP

# Try SSH with verbose
ssh -v ezprep@YOUR_DROPLET_IP

# If locked out, use DigitalOcean Console:
# → Go to droplet in DO dashboard
# → Click "Access" → "Launch Droplet Console"
# → Login as root or ezprep user
```

---

## 📈 Performance Testing

```bash
# Test API response time
curl -w "\nTime: %{time_total}s\n" https://api.ezprep.in/api/v1/health

# Test from local machine (install Apache Bench)
# 100 requests, 10 concurrent
ab -n 100 -c 10 https://api.ezprep.in/api/v1/health
```

---

## 📝 Environment Variables

```bash
# Edit .env
nano ~/ez-prep-api/.env

# After editing, always restart
pm2 restart ezprep-api

# View current environment (be careful with secrets!)
pm2 env 0
```

---

## 🔄 Rollback to Previous Version

```bash
# View Git history
cd ~/ez-prep-api
git log --oneline -10

# Rollback to previous commit
git reset --hard HEAD~1

# Or specific commit
git reset --hard COMMIT_HASH

# Rebuild and restart
npm run build
pm2 restart ezprep-api
```

---

## 💾 Backup & Restore

### Manual Backup

```bash
# Backup application
cd ~
tar -czf ezprep-backup-$(date +%Y%m%d).tar.gz ez-prep-api/.env ez-prep-api/dist

# Backup Nginx config
sudo cp /etc/nginx/sites-available/ezprep-api ~/nginx-backup-$(date +%Y%m%d).conf

# Download backup to your local machine
# From your Windows PowerShell:
# scp ezprep@YOUR_IP:~/ezprep-backup-*.tar.gz .
```

### Restore from Backup

```bash
# Upload backup to server
# From your Windows PowerShell:
# scp ezprep-backup-20260519.tar.gz ezprep@YOUR_IP:~/

# On server, extract
cd ~
tar -xzf ezprep-backup-20260519.tar.gz

# Restart app
pm2 restart ezprep-api
```

---

## 🎯 Health Checks

```bash
# Quick health check script
cat > ~/health-check.sh << 'EOF'
#!/bin/bash
echo "=== EZ Prep API Health Check ==="
echo "1. PM2 Status:"
pm2 status

echo -e "\n2. Nginx Status:"
sudo systemctl status nginx --no-pager

echo -e "\n3. Disk Space:"
df -h /

echo -e "\n4. Memory Usage:"
free -h

echo -e "\n5. API Response:"
curl -s http://localhost:3000/api/v1/health | head -50

echo -e "\n=== Health Check Complete ==="
EOF

chmod +x ~/health-check.sh

# Run health check
~/health-check.sh
```

---

## 🔔 Setup Alerts (Using Cron + Email)

```bash
# Install mail utility
sudo apt install -y mailutils

# Create alert script
cat > ~/alert.sh << 'EOF'
#!/bin/bash
# Check if app is running
if ! pm2 status | grep -q "online"; then
    echo "EZ Prep API is DOWN! PM2 status: $(pm2 status)" | mail -s "ALERT: API Down" your-email@example.com
fi

# Check disk space
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Disk usage is at ${DISK_USAGE}%" | mail -s "ALERT: High Disk Usage" your-email@example.com
fi
EOF

chmod +x ~/alert.sh

# Run every 5 minutes
crontab -e
# Add: */5 * * * * /home/ezprep/alert.sh
```

---

## 🌐 DNS Management

```bash
# Check DNS propagation
nslookup api.ezprep.in

# Detailed DNS info
dig api.ezprep.in

# Check from multiple locations
# Use: https://www.whatsmydns.net/
```

---

## 📊 View Real-time Metrics

```bash
# Watch PM2 metrics (refresh every 2 seconds)
watch -n 2 pm2 status

# Watch Nginx access logs
sudo tail -f /var/log/nginx/ezprep-api.access.log

# Watch system load
watch -n 1 uptime
```

---

## 🆘 Emergency Restart Everything

```bash
# Nuclear option - restart everything
sudo systemctl restart nginx
pm2 restart all
sudo systemctl restart pm2-ezprep

# Verify
pm2 status
sudo systemctl status nginx
curl http://localhost:3000/api/v1/health
```

---

## 📱 Check from Mobile/External

```bash
# From your phone or external network
# Visit: https://api.ezprep.in/api/v1/health

# Or use online tools:
# https://reqbin.com/
# https://hoppscotch.io/
```

---

## 💡 Pro Tips

1. **Always test locally** before deploying to production
2. **Use git tags** for releases: `git tag v1.0.0 && git push --tags`
3. **Deploy during low-traffic hours** (if possible)
4. **Keep a backup** of working .env file on your local machine
5. **Monitor logs** for first 10 minutes after deployment
6. **Document any manual changes** you make to the server
7. **Use PM2 reload** instead of restart for zero downtime
8. **Set up alerts** early, don't wait for issues
9. **Test rollback procedure** before you need it
10. **Keep MongoDB Atlas and DigitalOcean passwords secure**

---

## 📞 Support Resources

- **DigitalOcean**: Submit ticket via dashboard
- **MongoDB Atlas**: support@mongodb.com
- **This codebase**: Check `/docs` folder for more guides

---

## ⚡ One-Line Commands

```bash
# Full deployment in one command
cd ~/ez-prep-api && git pull && npm install && npm run build && pm2 reload ezprep-api && pm2 logs ezprep-api --lines 20

# Check everything is OK
pm2 status && sudo systemctl status nginx && curl -s http://localhost:3000/api/v1/health && df -h

# Emergency restart
pm2 restart ezprep-api && sudo systemctl restart nginx

# View all important logs
pm2 logs ezprep-api --lines 50 && sudo tail -50 /var/log/nginx/ezprep-api.error.log
```

---

**Keep this file bookmarked for quick reference during operations!**

*Last Updated: May 19, 2026*
