#!/bin/bash

# SSL Setup Script for Timetable System
# This script helps you set up free SSL certificates using Let's Encrypt

echo "=========================================="
echo "SSL Setup for Timetable System"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Get domain name
read -p "Enter your domain name (e.g., timetable.example.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "Domain name is required!"
    exit 1
fi

echo ""
echo "Domain: $DOMAIN"
echo ""

# Install Certbot
echo "Installing Certbot..."
apt update
apt install certbot -y

# Stop Docker containers
echo "Stopping Docker containers..."
cd /www/wwwroot/timetable
docker-compose -f docker-compose.prod.yml down

# Obtain certificate
echo "Obtaining SSL certificate from Let's Encrypt..."
certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email

if [ $? -ne 0 ]; then
    echo "Failed to obtain SSL certificate!"
    echo "Make sure:"
    echo "1. Your domain points to this server's IP"
    echo "2. Ports 80 and 443 are open"
    echo "3. No other service is using port 80"
    exit 1
fi

# Update docker-compose.ssl.yml with domain
echo "Updating configuration..."
sed -i "s/yourdomain.com/$DOMAIN/g" docker-compose.ssl.yml

# Start containers with SSL
echo "Starting containers with SSL..."
docker-compose -f docker-compose.ssl.yml up -d --build

# Setup auto-renewal
echo "Setting up auto-renewal..."
(crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet --post-hook 'docker-compose -f /www/wwwroot/timetable/docker-compose.ssl.yml restart frontend'") | crontab -

echo ""
echo "=========================================="
echo "SSL Setup Complete!"
echo "=========================================="
echo ""
echo "Your website is now available at:"
echo "https://$DOMAIN"
echo ""
echo "Certificate will auto-renew every 90 days."
echo ""
