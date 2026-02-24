# Silwane ERP - Complete Enterprise Resource Planning System

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Overview

Silwane ERP is a comprehensive Enterprise Resource Planning system designed for commercial businesses. It includes complete modules for inventory management, purchasing, sales, finance, analytics, and statistics.

## System Architecture

### Backend
- **Framework**: Node.js + Express
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **API**: RESTful Architecture

### Frontend
- **Framework**: React.js
- **State Management**: Redux
- **UI Components**: Material-UI
- **Charts**: Chart.js, Recharts

## Modules Overview

### 🏢 ERP Base (Module ERP)
Core system functionality and configuration

### 💼 M01 - Silwane Commercial
Commercial operations management

### 📦 MC01 - Module Stock (Inventory Management)
- **G01**: Stock Management - Base
- **G02**: Hierarchical Families
- **G05**: Weight, Volume and Dimensions
- **G09**: Stock Movement Journal

### 🛒 MC03 - Module Achats (Purchasing)
- **G11**: Purchase Management - Base

### 💰 MC04 - Module Ventes (Sales)
- **G16**: Sales Management - Base
- **G17**: Quote and Proforma Requests (Client)
- **G18**: Client Orders

### 🏦 MC05 - Module Trésorerie et Finances (Treasury & Finance)
- **G26**: Treasury Management - Base
- **G30**: Categorization and Remarks
- **G08**: Voucher Settlement
- **N75**: Payment Schedule Models

### 📊 MC07 - Module Fiches Analytiques (Analytics)
- **G31**: Product Sheet + Stock Sheet
- **G33**: Client/Supplier Sheet

### 🖥️ MC08 - Module Interface Utilisateurs (User Interface)
- **G35**: Interface - Information Bar
- **G41**: Advanced Searches and Filters
- **N52**: Interface - Column Search

### 📈 MC09 - Module Statistiques (Statistics)
- **G38**: Global Tier Situation
- **G39**: Basic Statistics
- **G40**: Statistical States

## Installation

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn

### Setup Instructions

1. **Clone the repository**
```bash
git clone https://github.com/islamoc/silwane-erp.git
cd silwane-erp
```

2. **Install dependencies**
```bash
npm run install-all
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Setup database**
```bash
psql -U postgres -f database/schema.sql
psql -U postgres -f database/seed.sql
```

5. **Start the application**

**Development mode:**
```bash
npm run dev-all
```

**Production mode:**
```bash
npm run build
npm start
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=silwane_erp
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=24h

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_email_password

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

### Stock Management (MC01)
- `GET /api/stock/products` - List all products
- `POST /api/stock/products` - Create product
- `PUT /api/stock/products/:id` - Update product
- `DELETE /api/stock/products/:id` - Delete product
- `GET /api/stock/families` - List product families
- `GET /api/stock/movements` - Stock movement journal
- `POST /api/stock/movements` - Record stock movement

### Purchasing Management (MC03)
- `GET /api/purchases/orders` - List purchase orders
- `POST /api/purchases/orders` - Create purchase order
- `PUT /api/purchases/orders/:id` - Update purchase order
- `GET /api/purchases/suppliers` - List suppliers

### Sales Management (MC04)
- `GET /api/sales/quotes` - List quotes
- `POST /api/sales/quotes` - Create quote
- `GET /api/sales/orders` - List orders
- `POST /api/sales/orders` - Create order
- `GET /api/sales/customers` - List customers

### Finance Management (MC05)
- `GET /api/finance/transactions` - List transactions
- `POST /api/finance/transactions` - Create transaction
- `GET /api/finance/vouchers` - List vouchers
- `GET /api/finance/payment-schedules` - Payment schedules

### Analytics (MC07)
- `GET /api/analytics/products/:id` - Product analytics
- `GET /api/analytics/customers/:id` - Customer analytics
- `GET /api/analytics/suppliers/:id` - Supplier analytics

### Statistics (MC09)
- `GET /api/statistics/overview` - Global overview
- `GET /api/statistics/sales` - Sales statistics
- `GET /api/statistics/purchases` - Purchase statistics
- `GET /api/statistics/inventory` - Inventory statistics

## Database Schema

The system uses PostgreSQL with the following main tables:

- **users** - User accounts and authentication
- **products** - Product catalog
- **product_families** - Hierarchical product categories
- **stock_movements** - Inventory transactions
- **suppliers** - Supplier information
- **customers** - Customer information
- **purchase_orders** - Purchase order records
- **sales_quotes** - Sales quotations
- **sales_orders** - Sales order records
- **financial_transactions** - Financial records
- **payment_schedules** - Payment schedule templates
- **vouchers** - Payment vouchers

## Features by Module

### MC01 - Stock Management
✅ Complete product catalog management
✅ Hierarchical family structure
✅ Weight, volume, and dimension tracking
✅ Real-time stock movement journal
✅ Multi-warehouse support
✅ Stock level alerts
✅ Barcode/SKU management

### MC03 - Purchasing
✅ Supplier management
✅ Purchase order creation and tracking
✅ Automated reorder points
✅ Purchase history and analytics
✅ Supplier performance tracking

### MC04 - Sales
✅ Customer management
✅ Quote generation and conversion
✅ Proforma invoice creation
✅ Order processing and fulfillment
✅ Sales history tracking
✅ Customer credit management

### MC05 - Finance
✅ Treasury management
✅ Transaction categorization
✅ Voucher processing
✅ Payment schedule templates
✅ Financial reporting
✅ Cash flow tracking

### MC07 - Analytics
✅ Product performance analytics
✅ Stock sheet generation
✅ Customer/Supplier analytics
✅ Profitability analysis
✅ Trend analysis

### MC08 - User Interface
✅ Responsive design
✅ Information dashboard
✅ Advanced search and filtering
✅ Column-based search
✅ Customizable views
✅ Export to Excel/PDF

### MC09 - Statistics
✅ Global tier situation overview
✅ Real-time statistics
✅ Interactive charts and graphs
✅ Custom report generation
✅ Comparative analysis
✅ Trend visualization

## Security Features

- JWT-based authentication
- Password hashing (bcrypt)
- Role-based access control (RBAC)
- Rate limiting
- SQL injection prevention
- XSS protection
- CORS configuration
- Input validation and sanitization

## Performance Optimization

- Database indexing
- Query optimization
- Response compression
- Caching strategies
- Pagination for large datasets
- Lazy loading

## Testing

```bash
# Run backend tests
npm test

# Run frontend tests
cd client && npm test

# Run integration tests
npm run test:integration
```

## Deployment

### Docker Deployment

```bash
# Build Docker image
docker build -t silwane-erp .

# Run container
docker-compose up -d
```

### Manual Deployment

1. Build frontend: `npm run build`
2. Set environment to production
3. Start server: `npm start`

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Email: azeddine.mennouchi@owasp.org
- GitHub Issues: https://github.com/islamoc/silwane-erp/issues

## Author

**Mennouchi Islam Azeddine**
- GitHub: [@islamoc](https://github.com/islamoc)
- Company: Dalil Technology
- Website: http://daliltechnology.com

## Acknowledgments

- Built with modern web technologies
- Follows industry best practices
- Designed for scalability and maintainability

---

© 2026 Silwane ERP. All rights reserved.