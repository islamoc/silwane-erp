# Silwane ERP Frontend

Modern React frontend for the Silwane ERP system built for **GK PRO STONES** in Constantine, Algeria.

## 🚀 Features

### Complete Module Coverage
- ✅ **Dashboard** - Real-time KPIs, charts, and business metrics
- ✅ **Stock Management** - Products, families, movements, traceability
- ✅ **Purchase Management** - Purchase orders, supplier management
- ✅ **Sales Management** - Quotes, orders, invoices, customer management
- ✅ **Finance & Treasury** - Transactions, bank reconciliation, cash flow, accounts
- ✅ **Analytics** - VAT declarations, balance sheets
- ✅ **Statistics** - Comprehensive business analytics and reporting
- ✅ **User Management** - User accounts, roles, permissions

### Technology Stack
- **React 18.2** - Modern UI library
- **Material-UI (MUI) 5.15** - Professional component library
- **React Router 6** - Client-side routing
- **Axios** - HTTP client
- **Recharts** - Data visualization
- **JWT Decode** - Token management
- **Date-fns** - Date formatting

## 📋 Prerequisites

- Node.js 16+ and npm/yarn
- Backend API running on http://localhost:5000

## 🔧 Installation

### 1. Navigate to Frontend Directory
```bash
cd frontend
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_NAME=Silwane ERP
REACT_APP_COMPANY=GK PRO STONES
REACT_APP_VERSION=1.0.0
```

### 4. Start Development Server
```bash
npm start
# or
yarn start
```

The application will open at **http://localhost:3000**

## 🏗️ Build for Production

### Build the Application
```bash
npm run build
# or
yarn build
```

This creates an optimized production build in the `build/` directory.

### Serve Production Build Locally (Testing)
```bash
npm install -g serve
serve -s build -l 3000
```

## 🌐 Production Deployment

### Option 1: Deploy with Nginx

#### 1. Build the Frontend
```bash
cd frontend
npm run build
```

#### 2. Copy Build to Server
```bash
scp -r build/* user@your-server:/var/www/silwane-erp/
```

#### 3. Configure Nginx
```nginx
server {
    listen 80;
    server_name erp.gkprostones.dz;

    root /var/www/silwane-erp;
    index index.html;

    # Frontend - serve React app
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API - proxy to backend
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

#### 4. Enable HTTPS (Recommended)
```bash
sudo certbot --nginx -d erp.gkprostones.dz
```

### Option 2: Deploy with Apache

#### Apache Configuration
```apache
<VirtualHost *:80>
    ServerName erp.gkprostones.dz
    DocumentRoot /var/www/silwane-erp

    <Directory /var/www/silwane-erp>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        FallbackResource /index.html
    </Directory>

    # Proxy API requests to backend
    ProxyPass /api http://localhost:5000/api
    ProxyPassReverse /api http://localhost:5000/api
</VirtualHost>
```

### Option 3: Deploy with Docker

#### Dockerfile
```dockerfile
# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Build and Run
```bash
docker build -t silwane-erp-frontend .
docker run -p 80:80 silwane-erp-frontend
```

## 🔐 Authentication

### Login Flow
1. User enters email and password
2. Frontend sends POST request to `/api/auth/login`
3. Backend returns JWT token and user data
4. Token stored in localStorage
5. Token automatically added to all subsequent requests

### Role-Based Access Control
- **super_admin** - Full system access
- **admin** - Administrative access
- **manager** - Management functions
- **accountant** - Financial access
- **sales** - Sales operations
- **warehouse** - Stock operations
- **viewer** - Read-only access

### Protected Routes
All routes except `/login` require authentication. The `PrivateRoute` component automatically redirects unauthenticated users to the login page.

## 📁 Project Structure

```
frontend/
├── public/
│   ├── index.html          # HTML template
│   └── manifest.json       # PWA manifest
├── src/
│   ├── components/         # Reusable components
│   │   ├── Layout.js       # Main layout with sidebar
│   │   └── PrivateRoute.js # Route protection
│   ├── contexts/           # React contexts
│   │   └── AuthContext.js  # Authentication state
│   ├── pages/              # Page components
│   │   ├── Dashboard.js    # Main dashboard
│   │   ├── Login.js        # Login page
│   │   ├── stock/          # Stock management pages
│   │   ├── purchase/       # Purchase pages
│   │   ├── sales/          # Sales pages
│   │   ├── finance/        # Finance pages
│   │   ├── analytics/      # Analytics pages
│   │   ├── statistics/     # Statistics pages
│   │   └── users/          # User management
│   ├── services/           # API services
│   │   └── api.js          # Axios instance & endpoints
│   ├── App.js              # Main app component
│   ├── index.js            # Entry point
│   └── index.css           # Global styles
├── package.json            # Dependencies
└── README.md               # This file
```

## 🎨 UI Components

### Material-UI Components Used
- **Navigation**: AppBar, Drawer, Menu
- **Data Display**: DataGrid, Chip, Avatar
- **Forms**: TextField, Button, Select, Dialog
- **Layout**: Box, Grid, Container, Paper
- **Feedback**: Alert, CircularProgress, Snackbar
- **Charts**: Recharts (LineChart, BarChart, PieChart)

### Custom Theme
The application uses a custom Material-UI theme with:
- Primary color: Blue (#1976d2)
- Secondary color: Pink (#dc004e)
- Custom typography with Roboto font
- Responsive breakpoints
- Custom component overrides

## 🔄 API Integration

### API Service (`src/services/api.js`)

All API calls go through the centralized Axios instance:

```javascript
import { getProducts, createProduct } from '../services/api';

// Fetch products
const response = await getProducts({ page: 1, limit: 10 });

// Create product
const newProduct = await createProduct({
  sku: 'STONE-001',
  name: 'Granite Stone',
  unit_price: 2500.00
});
```

### Available Endpoints
- **Auth**: login, register, refreshToken
- **Products**: CRUD operations, search, filter
- **Families**: Product family management
- **Stock**: Movements, traceability
- **Suppliers**: Supplier management
- **Purchase Orders**: Order management
- **Customers**: Customer management
- **Quotes**: Quote management
- **Orders**: Sales order management
- **Invoices**: Invoice management
- **Finance**: Transactions, accounts, cash flow
- **Analytics**: VAT, balance sheet
- **Statistics**: Dashboard stats, sales analytics
- **Users**: User management

## 🎯 Key Features

### Dashboard
- Real-time KPIs (revenue, orders, products, customers)
- Sales trend charts (12-month history)
- Top products pie chart
- Monthly comparison bar charts
- Financial summary
- Quick statistics

### Product Management
- Full CRUD operations
- Stock level monitoring with low-stock alerts
- Product families
- SKU management
- Pricing (unit price, cost price)
- Min/max stock levels

### Sales Management
- Quote generation
- Quote to order conversion
- Invoice creation
- Customer management
- Payment tracking

### Finance
- Transaction management
- Bank reconciliation
- Cash flow analysis
- Chart of accounts
- Multi-currency support

### Analytics
- VAT declaration reports
- Balance sheet generation
- Financial statements
- Period comparisons

## 🐛 Troubleshooting

### Common Issues

#### 1. Cannot connect to backend
```bash
# Check if backend is running
curl http://localhost:5000/health

# Verify REACT_APP_API_URL in .env
REACT_APP_API_URL=http://localhost:5000
```

#### 2. CORS errors
Ensure backend has CORS enabled:
```javascript
// Backend server.js should have:
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
```

#### 3. Token expiration
Tokens expire after a set period. The app automatically redirects to login on 401 errors.

#### 4. Build fails
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### 5. Port 3000 already in use
```bash
# Use different port
PORT=3001 npm start
```

## 📊 Performance Optimization

### Implemented Optimizations
- Code splitting with React.lazy (future enhancement)
- Material-UI tree shaking
- Production build minification
- Gzip compression
- Image optimization
- API request caching

### Best Practices
- Use pagination for large datasets
- Implement debouncing for search inputs
- Lazy load heavy components
- Optimize re-renders with React.memo
- Use production build for deployment

## 🔒 Security

### Implemented Security Measures
- JWT authentication
- Token stored in localStorage (consider httpOnly cookies for production)
- Automatic token refresh
- Protected routes
- Role-based access control
- Input validation
- XSS protection (React defaults)
- HTTPS in production (recommended)

### Security Best Practices
1. Always use HTTPS in production
2. Implement Content Security Policy (CSP)
3. Regular dependency updates
4. Environment variable protection
5. Secure token storage (consider httpOnly cookies)

## 📝 Development Workflow

### 1. Start Backend
```bash
cd ..
npm run dev
```

### 2. Start Frontend
```bash
cd frontend
npm start
```

### 3. Make Changes
- Edit files in `src/`
- Hot reload automatically updates browser

### 4. Test
- Test features in browser
- Check console for errors
- Verify API calls in Network tab

### 5. Build
```bash
npm run build
```

## 🚀 Future Enhancements

- [ ] Implement real-time updates with WebSocket
- [ ] Add offline support (PWA)
- [ ] Implement advanced search and filters
- [ ] Add export to Excel/PDF functionality
- [ ] Implement print views for invoices
- [ ] Add multi-language support (French/Arabic)
- [ ] Implement dark mode
- [ ] Add data visualization dashboard
- [ ] Implement batch operations
- [ ] Add notifications system

## 📞 Support

For issues or questions:
- Check backend API documentation
- Review browser console for errors
- Verify network requests
- Check environment variables

## 📄 License

Proprietary - GK PRO STONES © 2026
