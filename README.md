# Food Order Application

A modern food ordering application with AI-powered order parsing, multi-language support (English/Arabic), and role-based access for customers and delivery drivers.

## Features

### For Customers
- **Create Orders**: Create food orders with items, quantities, prices, and delivery preferences
- **AI Order Parsing**: Use natural language to describe orders (e.g., "2 shawarma without garlic") and let AI extract the details
- **Edit Orders**: Modify pending orders before delivery
- **Track Orders**: View order status and delivery progress
- **Profile Management**: Update profile, avatar, and password
- **Delivery Network**: Connect with trusted delivery drivers
- **Multi-language Support**: Full English and Arabic interface

### For Delivery Drivers
- **View Available Orders**: Browse and accept delivery requests from customers
- **Manage Deliveries**: Track assigned deliveries and update status
- **Customer Network**: Connect with customers for future orders
- **Profile Management**: Update profile, avatar, and password
- **Order Detail View**: View detailed order information including items and delivery address

### AI Integration
- **Groq Llama 3.1**: Advanced natural language processing for order parsing
- **Smart Extraction**: Extracts items, quantities, notes, and recommended delivery places
- **Libyan Arabic Support**: Understands Libyan dialect and common expressions
- **Rate Limiting**: 10 requests per minute per user
- **Secure Authentication**: Supabase JWT verification with customer role check

## Tech Stack

### Frontend
- **React 18**: UI framework
- **Vite**: Build tool and development server
- **Supabase**: Authentication, database, and storage
- **Cloudflare Turnstile**: CAPTCHA verification
- **CSS Modules**: Component styling

### Backend (Separate Project)
- **Express.js**: API server
- **Groq API**: AI model integration
- **Supabase**: Authentication and database
- **express-rate-limit**: Rate limiting middleware

### Database
- **Supabase PostgreSQL**: Managed PostgreSQL database
- **Tables**: profiles, orders, order_items, delivery_links, delivery_requests

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Supabase account
- Groq API key (for AI server)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/food-order.git
   cd food-order
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add:
   ```bash
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_AI_SERVER_URL=https://food-order-ai-server.onrender.com
   ```

4. **Set up Supabase database**
   
   Run the SQL migration files in order:
   - `supabase/setup_profiles.sql`
   - `supabase/setup_notifications.sql`
   - `supabase/update_quantity_to_decimal.sql` (for decimal quantity support)

   Use the Supabase SQL Editor to run these migrations.

5. **Start the development server**
   ```bash
   npm start
   ```

6. **Open in browser**
   ```
   http://localhost:3001
   ```

## Project Structure

```
food-order/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable UI components
│   ├── lib/            # Utility functions and configurations
│   │   ├── ai.js       # AI integration
│   │   ├── database.js # Database operations
│   │   ├── i18n.js     # Internationalization
│   │   ├── profile.js  # Profile management
│   │   ├── supabase.js # Supabase client
│   │   └── ...
│   ├── pages/          # Page components
│   │   ├── CreateOrderPage.jsx
│   │   ├── EditOrderPage.jsx
│   │   ├── OrdersPage.jsx
│   │   ├── CustomerDashboardPage.jsx
│   │   ├── DriverDashboardPage.jsx
│   │   └── ...
│   ├── App.jsx         # Main app component
│   ├── index.jsx       # Entry point
│   └── App.css         # Global styles
├── supabase/           # SQL migration files
├── package.json
└── vite.config.js
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key |
| `VITE_AI_SERVER_URL` | Deployed AI server URL |

## Database Schema

### Tables

- **profiles**: User profiles with roles (customer/delivery)
- **orders**: Order records with status and delivery information
- **order_items**: Individual items in orders with quantities and prices
- **delivery_links**: Direct connections between customers and delivery drivers
- **delivery_requests**: Delivery request records

### Important Notes

- `quantity` column in `order_items` is of type `numeric` to support decimal values (0.25, 0.5, etc.)
- Minimum quantity is 0.25 with 0.05 increments
- Status transitions: `pending` → `collected` → `delivered` or `cancelled`

## Deployment

### Frontend Deployment

The frontend can be deployed to:
- Vercel
- Netlify
- GitHub Pages
- Any static hosting service

**Steps for Vercel:**

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

### AI Server Deployment

The AI server is in a separate repository: `food-order-ai-server`

See [AI Server Deployment Guide](../food-order-ai-server/SETUP_GUIDE.md) for details.

## AI Server Setup

The AI server provides:
- `/parse-order` endpoint for natural language order parsing
- JWT authentication with Supabase
- Rate limiting (10 req/min)
- Customer role verification

**Deployed URL**: `https://food-order-ai-server.onrender.com`

## Security

- JWT authentication for all protected routes
- Role-based access control (customer/delivery)
- CAPTCHA verification for sensitive operations
- Rate limiting on AI endpoint
- Environment variables for sensitive data
- Service role key only on server-side

## Multi-language Support

The application supports:
- English (en)
- Arabic (ar)

Language is determined by URL parameter: `?lang=en` or `?lang=ar`

## Troubleshooting

### AI parsing not working
- Check `VITE_AI_SERVER_URL` is set correctly
- Verify AI server is deployed and running
- Check user is authenticated and has customer role

### Quantity field errors
- Ensure database migration `update_quantity_to_decimal.sql` is run
- Verify quantity column is `numeric` type in database

### Authentication issues
- Check Supabase URL and anon key are correct
- Verify user role is set correctly in profiles table
- Check JWT token is valid and not expired

## Development

### Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests

### Code Style

- React functional components with hooks
- Modular CSS with CSS variables
- Separation of concerns (components, utilities, pages)
- Environment-based configuration

## License

ISC

## Support

For issues and questions, open an issue in the GitHub repository.