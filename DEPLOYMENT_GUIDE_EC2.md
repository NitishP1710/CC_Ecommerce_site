# Deployment Guide: React + Express + MongoDB Atlas on Amazon EC2

This guide deploys a sample e-commerce app on an Ubuntu EC2 VM using MongoDB Atlas as the managed database.

## 1) Architecture

- Browser -> Nginx (port 80/443)
- Nginx serves React static build
- Nginx proxies `/api/*` -> Express backend on `127.0.0.1:4000`
- Express connects to MongoDB Atlas using `MONGODB_URI`

## 2) Prerequisites

- AWS account
- MongoDB Atlas cluster and connection string (URI)
- Domain name (optional, for HTTPS)
- Local SSH key pair for EC2

## 3) Launch EC2 Instance

1. Create EC2 instance:
   - AMI: Ubuntu Server 22.04 LTS
   - Instance type: t2.micro (or larger)
   - Storage: 16 GB+
2. Security Group inbound rules:
   - SSH: 22 from your IP
   - HTTP: 80 from anywhere
   - HTTPS: 443 from anywhere
3. Connect by SSH:

```bash
ssh -i /path/to/key.pem ubuntu@<EC2_PUBLIC_IP>
```

## 4) Install Runtime Dependencies on EC2

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm install -g pm2
node -v
npm -v
```

## 5) Copy Project to EC2

Option A: Clone from Git repository

```bash
git clone <your-repo-url> ecommerce
cd ecommerce
```

Option B: SCP from local machine

```bash
scp -i /path/to/key.pem -r /local/path/E-Commerce ubuntu@<EC2_PUBLIC_IP>:/home/ubuntu/ecommerce
ssh -i /path/to/key.pem ubuntu@<EC2_PUBLIC_IP>
cd /home/ubuntu/ecommerce
```

## 6) Configure Backend

```bash
cd /home/ubuntu/ecommerce/backend
npm install
cp .env.example .env
```

Edit `/home/ubuntu/ecommerce/backend/.env` with your Atlas connection string and values:

```env
PORT=4000
MONGODB_URI='mongodb+srv://<user>:<password>@cluster0.mongodb.net/<dbname>?retryWrites=true&w=majority'
FRONTEND_ORIGIN=http://<EC2_PUBLIC_IP>
```

Notes:

- For Atlas use the `mongodb+srv://` or standard `mongodb://` URI shown in the Atlas UI.
- Ensure your Atlas IP whitelist allows the EC2 instance IP (or 0.0.0.0/0 for quick testing).

Initialize schema and seed data (the project provides `init-db` which seeds sample products into MongoDB):

```bash
npm run init-db
```

Start backend with PM2 (simple example without an ecosystem file):

```bash
cd /home/ubuntu/ecommerce/backend
pm2 start src/server.js --name ecommerce-backend --watch
pm2 status
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Run the command PM2 prints at the end (usually with sudo) so backend starts on reboot.

## 7) Configure Frontend

```bash
cd /home/ubuntu/ecommerce/frontend
npm install
cp .env.example .env
```

Set API URL for browser:

```env
VITE_API_URL=http://<EC2_PUBLIC_IP>
```

Build frontend:

```bash
npm run build
```

Copy build files to Nginx web root:

```bash
sudo mkdir -p /var/www/ecommerce-frontend
sudo cp -r dist/* /var/www/ecommerce-frontend/
```

## 8) Configure Nginx Reverse Proxy

Create Nginx config:

```bash
sudo tee /etc/nginx/sites-available/ecommerce > /dev/null << 'EOF'
server {
  listen 80;
  server_name _;

  root /var/www/ecommerce-frontend;
  index index.html;

  location / {
    try_files $uri /index.html;
  }

  location /api {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /api/health {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
EOF

sudo ln -s /etc/nginx/sites-available/ecommerce /etc/nginx/sites-enabled/ecommerce
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

```bash
sudo chmod o+x /home/ubuntu
sudo chmod -R 755 /home/ubuntu/ecommerce
sudo systemctl restart nginx
```

Now test in browser:

- `http://<EC2_PUBLIC_IP>` should load React app
- `http://<EC2_PUBLIC_IP>/api/health` should return status JSON

## 9) Optional HTTPS with Let’s Encrypt

If you have a domain pointing to your EC2 public IP:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot updates Nginx config and sets auto-renewal.

## 10) Verify Application Behavior

1. Browse product cards on homepage.
2. Submit a demo purchase.
3. Confirm stock decreases after purchase.

API tests:

```bash
curl http://127.0.0.1:4000/api/products
# productId is a MongoDB ObjectId string; replace <PRODUCT_OBJECT_ID> with a real id from the products list
curl -X POST http://127.0.0.1:4000/api/purchases \
  -H "Content-Type: application/json" \
  -d '{"productId":"<PRODUCT_OBJECT_ID>","quantity":1,"buyerEmail":"demo@shop.com"}'
```

## 11) Basic Production Hardening Checklist

- Use non-root SSH user (default ubuntu user already non-root).
- Restrict SSH source IP in Security Group.
- Keep system updated regularly.
- Store secrets only in `.env` on server, never commit secrets.
- Use HTTPS in production and update `FRONTEND_ORIGIN`/`VITE_API_URL` to your domain.
- Add CloudWatch or PM2 log rotation for log management.

## 12) Common Issues and Fixes

- CORS error in browser:
  - Ensure `FRONTEND_ORIGIN` exactly matches frontend URL.
    -- Database connection failure:
  - Verify `MONGODB_URI` and Atlas cluster access settings; confirm the EC2 IP is allowed in Atlas Network Access (IP whitelist).
  - If using `mongodb+srv://` include the correct DNS seed list and ensure DNS resolution is available on the VM.
- Nginx 502 Bad Gateway:
  - Check backend process: `pm2 status`
  - Check backend logs: `pm2 logs ecommerce-backend`
- React routes not loading on refresh:
  - Confirm `try_files $uri /index.html;` is present in Nginx config.

Your sample e-commerce app is now deployed on EC2 with Neon PostgreSQL.
