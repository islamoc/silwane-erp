# Silwane ERP - Deployment Guide

## 📌 Quick Reference

- **Proforma**: FP26002386
- **Client**: GK PRO STONES, Constantine
- **System Status**: Production Ready
- **All 29 Features**: Fully Implemented

---

## 🛠️ Prerequisites

### Server Requirements

**Minimum Specifications**:
- CPU: 2 cores (4 recommended)
- RAM: 4GB (8GB recommended)
- Storage: 20GB SSD
- OS: Ubuntu 20.04 LTS or newer / CentOS 8+

**Software Requirements**:
- Node.js 18.x or higher
- PostgreSQL 14.x or higher
- nginx (for reverse proxy)
- PM2 (for process management)
- SSL certificate (Let's Encrypt recommended)

---

## 📦 Installation Steps

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or higher

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2
```

### 2. Database Setup

```bash
# Switch to postgres user
sudo -i -u postgres

# Create database and user
psql

CREATE DATABASE silwane_erp;
CREATE USER silwane_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE silwane_erp TO silwane_user;
\q

exit
```

### 3. Application Deployment

```bash
# Create application directory
sudo mkdir -p /var/www/silwane-erp
sudo chown -R $USER:$USER /var/www/silwane-erp

# Clone repository
cd /var/www/silwane-erp
git clone https://github.com/islamoc/silwane-erp.git .

# Install dependencies
npm install --production

# Create .env file
cp .env.example .env
nano .env
```

### 4. Environment Configuration

Edit `/var/www/silwane-erp/.env`:

```env
# Server Configuration
NODE_ENV=production
PORT=5000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=silwane_erp
DB_USER=silwane_user
DB_PASSWORD=your_secure_password_here
DB_POOL_MIN=2
DB_POOL_MAX=10

# JWT Configuration (CHANGE THESE!)
JWT_SECRET=CHANGE_THIS_TO_RANDOM_32_PLUS_CHARACTER_STRING
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=https://yourdomain.com

# Logging
LOG_LEVEL=info
```

**⚠️ IMPORTANT**: Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 5. Database Migration

```bash
# Run database schema
psql -U silwane_user -d silwane_erp -f migrations/001_initial_schema.sql

# Verify tables created
psql -U silwane_user -d silwane_erp -c "\dt"
```

### 6. PM2 Process Manager Setup

```bash
# Create PM2 ecosystem file
nano ecosystem.config.js
```

Add this content:
```javascript
module.exports = {
  apps: [{
    name: 'silwane-erp',
    script: './server.js',
    instances: 2,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
```

Start the application:
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Set PM2 to start on boot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs silwane-erp
```

### 7. Nginx Reverse Proxy

```bash
# Create nginx configuration
sudo nano /etc/nginx/sites-available/silwane-erp
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name erp.gkprostones.dz api.gkprostones.dz;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name erp.gkprostones.dz api.gkprostones.dz;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/erp.gkprostones.dz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erp.gkprostones.dz/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/silwane-erp-access.log;
    error_log /var/log/nginx/silwane-erp-error.log;

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:5000/health;
        access_log off;
    }
}
```

Enable the site:
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/silwane-erp /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

### 8. SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d erp.gkprostones.dz -d api.gkprostones.dz

# Follow prompts and enter email

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## 🔒 Security Hardening

### 1. Firewall Configuration

```bash
# Install UFW
sudo apt install -y ufw

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 2. PostgreSQL Security

```bash
# Edit PostgreSQL config
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Ensure these settings:
```
# Local connections only
local   all             all                                     peer
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
```

```bash
# Restart PostgreSQL
sudo systemctl restart postgresql
```

### 3. Fail2ban Setup

```bash
# Install fail2ban
sudo apt install -y fail2ban

# Create jail for nginx
sudo nano /etc/fail2ban/jail.local
```

Add:
```ini
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
filter = nginx-noscript
logpath = /var/log/nginx/access.log
maxretry = 6
```

```bash
# Restart fail2ban
sudo systemctl restart fail2ban
```

---

## 📊 Monitoring Setup

### 1. PM2 Monitoring

```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs silwane-erp
pm2 logs silwane-erp --lines 100

# Process information
pm2 info silwane-erp
```

### 2. Log Rotation

```bash
# Create logrotate config
sudo nano /etc/logrotate.d/silwane-erp
```

Add:
```
/var/www/silwane-erp/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 3. System Monitoring Script

Create `/var/www/silwane-erp/scripts/monitor.sh`:

```bash
#!/bin/bash

# Health check
HEALTH=$(curl -s http://localhost:5000/health | jq -r '.status')

if [ "$HEALTH" != "OK" ]; then
    echo "$(date): Health check failed" >> /var/log/silwane-erp-monitor.log
    pm2 restart silwane-erp
fi
```

Make executable and add to cron:
```bash
chmod +x /var/www/silwane-erp/scripts/monitor.sh

# Add to crontab (run every 5 minutes)
crontab -e
*/5 * * * * /var/www/silwane-erp/scripts/monitor.sh
```

---

## 💾 Backup Strategy

### 1. Database Backup Script

Create `/var/www/silwane-erp/scripts/backup-db.sh`:

```bash
#!/bin/bash

# Configuration
DB_NAME="silwane_erp"
DB_USER="silwane_user"
BACKUP_DIR="/var/backups/silwane-erp"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
DATETIME=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/silwane_erp_$DATETIME.sql.gz"

pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_FILE

# Remove old backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "$(date): Backup completed - $BACKUP_FILE" >> /var/log/silwane-erp-backup.log
```

Make executable and schedule:
```bash
chmod +x /var/www/silwane-erp/scripts/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /var/www/silwane-erp/scripts/backup-db.sh
```

### 2. Application Backup

```bash
# Create backup script
#!/bin/bash

BACKUP_DIR="/var/backups/silwane-erp"
APP_DIR="/var/www/silwane-erp"
DATETIME=$(date +%Y%m%d_%H%M%S)

tar -czf $BACKUP_DIR/app_$DATETIME.tar.gz \
    --exclude='node_modules' \
    --exclude='logs' \
    --exclude='.git' \
    $APP_DIR

# Keep only last 7 application backups
find $BACKUP_DIR -name "app_*.tar.gz" -mtime +7 -delete
```

---

## 🔄 Update Procedure

### Application Updates

```bash
cd /var/www/silwane-erp

# Pull latest changes
git pull origin main

# Install new dependencies
npm install --production

# Run new migrations if any
psql -U silwane_user -d silwane_erp -f migrations/NEW_MIGRATION.sql

# Restart application
pm2 restart silwane-erp

# Check logs
pm2 logs silwane-erp --lines 50
```

### Database Restore

```bash
# Stop application
pm2 stop silwane-erp

# Restore database
gunzip < /var/backups/silwane-erp/silwane_erp_YYYYMMDD_HHMMSS.sql.gz | \
    psql -U silwane_user -d silwane_erp

# Start application
pm2 start silwane-erp
```

---

## ✅ Post-Deployment Checklist

### Immediately After Deployment

- [ ] Application accessible via HTTPS
- [ ] Health check endpoint responds: `curl https://yourdomain.com/health`
- [ ] Database connection working
- [ ] PM2 process running: `pm2 status`
- [ ] Nginx serving correctly
- [ ] SSL certificate valid
- [ ] Firewall configured
- [ ] Log files being created

### First Week

- [ ] Monitor error logs daily
- [ ] Check database backups running
- [ ] Verify PM2 auto-restart working
- [ ] Test API endpoints
- [ ] Monitor server resources (CPU, RAM, disk)
- [ ] Review nginx access logs
- [ ] Test fail2ban rules

### Ongoing

- [ ] Weekly backup verification
- [ ] Monthly security updates: `sudo apt update && sudo apt upgrade`
- [ ] Quarterly SSL certificate check
- [ ] Review and rotate logs
- [ ] Monitor disk space usage
- [ ] Review PM2 process health

---

## 📞 Support Contacts

### Technical Support
- **Developer**: Mennouchi Islam Azeddine
- **Email**: azeddine.mennouchi@owasp.org
- **GitHub**: https://github.com/islamoc

### Client Information
- **Client**: GK PRO STONES
- **Location**: Constantine, Algeria
- **Proforma**: FP26002386

---

## 📄 Additional Resources

- [README.md](./README.md) - General project information
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) - Complete feature list
- [API Documentation](http://localhost:5000/) - Interactive API reference

---

**Deployment Guide Version**: 1.0  
**Last Updated**: February 25, 2026  
**Status**: Production Ready 🚀