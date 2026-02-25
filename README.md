# Silwane ERP

**Complete Enterprise Resource Planning System for GK PRO STONES**

A modern, full-stack ERP solution built for stone and marble businesses in Constantine, Algeria.

## 🎯 Overview

Silwane ERP is a comprehensive business management system covering all aspects of enterprise operations:

- 📦 **Stock Management** - Products, families, movements, traceability
- 🛒 **Purchase Management** - Orders, suppliers, procurement
- 💰 **Sales Management** - Quotes, orders, invoices, customers
- 💵 **Finance & Treasury** - Transactions, reconciliation, cash flow
- 📊 **Analytics** - VAT declarations, balance sheets, reports
- 📈 **Statistics** - KPIs, dashboards, business intelligence
- 👥 **User Management** - Roles, permissions, access control

## 🏗️ Architecture

### Backend (Node.js + Express + PostgreSQL)
- RESTful API with 70+ endpoints
- JWT authentication with role-based access control
- PostgreSQL database with comprehensive schema
- Express middleware for security and validation
- Transaction management for data integrity

### Frontend (React + Material-UI)
- Modern React 18 application
- Material-UI component library
- Responsive design for all devices
- Real-time data visualization with Recharts
- Intuitive navigation and user experience

## 📋 Prerequisites

- **Node.js** 16+ and npm
- **PostgreSQL** 13+
- **Git**

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/islamoc/silwane-erp.git
cd silwane-erp
```

### 2. Backend Setup

#### Install Dependencies
```bash
npm install
```

#### Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=silwane_erp
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_REFRESH_EXPIRES_IN=7d

# Security
BCRYPT_ROUNDS=10
```

#### Create Database
```bash
# Using psql
psql -U postgres
CREATE DATABASE silwane_erp;
\q

# Run database schema
psql -U postgres -d silwane_erp -f database/schema.sql
```

#### Start Backend
```bash
npm run dev
```

Backend will run at **http://localhost:5000**

### 3. Frontend Setup

#### Navigate to Frontend
```bash
cd frontend
```

#### Install Dependencies
```bash
npm install
```

#### Configure Environment
```bash
cp .env.example .env
```

Edit `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_NAME=Silwane ERP
REACT_APP_COMPANY=GK PRO STONES
```

#### Start Frontend
```bash
npm start
```

Frontend will open at **http://localhost:3000**

## 🌐 Accessing the Application

### Web Interface
1. Open browser to **http://localhost:3000**
2. Login with your credentials:
   - Email: `admin@gkprostones.dz`
   - Password: (configured during setup)

### API Access
- Base URL: **http://localhost:5000/api**
- Health Check: **http://localhost:5000/health**
- API Documentation: See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)

## 📁 Project Structure

```
silwane-erp/
├── backend/
│   ├── config/             # Configuration files
│   ├── controllers/        # Route controllers
│   ├── database/           # Database schema and migrations
│   ├── middleware/         # Express middleware
│   ├── routes/             # API routes
│   ├── utils/              # Utility functions
│   └── server.js           # Entry point
├── frontend/
│   ├── public/             # Static files
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── App.js          # Main app
│   └── package.json
├── DEPLOYMENT_GUIDE.md     # Production deployment
├── IMPLEMENTATION_STATUS.md # Feature documentation
└── README.md               # This file
```

## 🎨 Features

### Dashboard
- Real-time KPIs and business metrics
- Sales trends and analytics
- Top products visualization
- Financial summaries
- Quick action links

### Stock Management (MC01)
- Product catalog with SKU tracking
- Product families and categories
- Stock movements (in/out/adjustment)
- Full traceability history
- Low stock alerts
- Min/max stock levels

### Purchase Management (MC03)
- Purchase order creation and tracking
- Supplier management
- Order status workflow
- Supplier performance tracking

### Sales Management (MC04)
- Quote generation and management
- Quote to order conversion
- Customer order tracking
- Invoice generation
- Payment status tracking
- Customer management

### Finance & Treasury (MC05)
- Transaction management
- Bank reconciliation
- Cash flow analysis and forecasting
- Chart of accounts (5 types)
- Financial summary statements
- Multi-currency support

### Analytics (MC07)
- VAT declaration reports
- Balance sheet generation
- Profit & loss statements
- Period comparisons

### Statistics (MC09)
- Dashboard KPIs
- Sales analytics with trends
- Invoice statistics
- Product performance
- Customer segmentation

### User Management (MC08)
- User account management
- 7 role-based access levels
- JWT authentication
- Password management
- Activity logging

## 🔐 Security Features

- **JWT Authentication** - Secure token-based auth
- **Role-Based Access Control** - 7 permission levels
- **Password Hashing** - bcrypt with 10 rounds
- **SQL Injection Protection** - Parameterized queries
- **CORS Protection** - Configured origins
- **Rate Limiting** - API request throttling
- **Input Validation** - Request sanitization
- **Audit Trails** - Complete activity logging

## 📊 API Endpoints

### Core Modules (70+ endpoints)

**Authentication**
- POST `/api/auth/login` - User login
- POST `/api/auth/register` - User registration
- POST `/api/auth/refresh` - Token refresh

**Products**
- GET `/api/products` - List products
- GET `/api/products/:id` - Get product
- POST `/api/products` - Create product
- PUT `/api/products/:id` - Update product
- DELETE `/api/products/:id` - Delete product

**Sales**
- GET `/api/quotes` - List quotes
- POST `/api/quotes` - Create quote
- POST `/api/quotes/:id/convert` - Convert to order
- GET `/api/orders` - List orders
- GET `/api/invoices` - List invoices

**Finance**
- GET `/api/finance/transactions` - List transactions
- POST `/api/finance/transactions` - Create transaction
- GET `/api/finance/cashflow` - Cash flow analysis
- GET `/api/finance/summary` - Financial summary

**Analytics**
- GET `/api/analytics/vat` - VAT declaration
- GET `/api/analytics/balance-sheet` - Balance sheet

**Statistics**
- GET `/api/statistics/dashboard` - Dashboard stats
- GET `/api/statistics/sales` - Sales analytics
- GET `/api/statistics/invoices` - Invoice stats

See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for complete API documentation.

## 🚀 Production Deployment

For detailed production deployment instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

### Quick Production Setup

#### 1. Build Frontend
```bash
cd frontend
npm run build
```

#### 2. Configure Nginx
```nginx
server {
    listen 80;
    server_name erp.gkprostones.dz;

    # Frontend
    root /var/www/silwane-erp/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 3. Enable HTTPS
```bash
sudo certbot --nginx -d erp.gkprostones.dz
```

#### 4. Start with PM2
```bash
pm2 start server.js --name silwane-erp
pm2 save
pm2 startup
```

## 🧪 Testing

### Test API with cURL
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@gkprostones.dz", "password": "your_password"}'

# Get products (with token)
curl http://localhost:5000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test with Postman
1. Import API collection
2. Set environment variables
3. Test all endpoints

## 📖 Documentation

- [Implementation Status](IMPLEMENTATION_STATUS.md) - Complete feature matrix and API docs
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Production deployment instructions
- [Frontend README](frontend/README.md) - Frontend-specific documentation

## 🛠️ Development

### Adding New Features
1. Create controller in `controllers/`
2. Define routes in `routes/`
3. Update database schema if needed
4. Create frontend pages in `frontend/src/pages/`
5. Add API calls in `frontend/src/services/api.js`
6. Update navigation in `frontend/src/components/Layout.js`

### Code Style
- Backend: Node.js with ES6+
- Frontend: React with functional components
- Use async/await for async operations
- Follow REST API conventions
- Material-UI for consistent styling

## 🐛 Troubleshooting

### Backend Issues

**Database connection failed**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify credentials in .env
# Test connection
psql -h localhost -U postgres -d silwane_erp
```

**Port 5000 already in use**
```bash
# Change port in .env
PORT=5001

# Or kill process
lsof -ti:5000 | xargs kill -9
```

### Frontend Issues

**Cannot connect to backend**
- Verify backend is running
- Check `REACT_APP_API_URL` in `.env`
- Verify CORS configuration

**Build fails**
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install
```

## 📞 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/islamoc/silwane-erp/issues)
- **Documentation**: Check documentation files
- **Email**: contact@gkprostones.dz

## 🚀 Roadmap

### Phase 1 (Complete) ✅
- [x] Core backend API
- [x] Database schema
- [x] All 29 features implemented
- [x] Authentication and authorization
- [x] React frontend with all modules
- [x] Dashboard with charts
- [x] Complete CRUD operations

### Phase 2 (Future)
- [ ] Real-time notifications
- [ ] Email integration
- [ ] PDF generation for invoices
- [ ] Advanced reporting
- [ ] Mobile app (React Native)
- [ ] Multi-language support (French/Arabic)
- [ ] Barcode scanning
- [ ] Inventory optimization

## 📄 License

Proprietary - GK PRO STONES © 2026

## 👏 Acknowledgments

- Built for **GK PRO STONES**, Constantine, Algeria
- Implementing requirements from **Proforma FP26002386**
- Complete ERP solution for stone and marble industry

---

**🌟 Status: PRODUCTION READY**

Full-stack application with backend API (29 features) and React frontend complete!
