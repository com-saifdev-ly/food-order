# 🍔 Food Order

A modern food ordering web application built with React, Vite, and Supabase. Features user authentication, multi-language support (English/Arabic), and Progressive Web App (PWA) capabilities.

## 🚀 Features

### Current Features
- **User Authentication**: Sign up, sign in, password reset
- **User Roles**: Customer and Delivery account types
- **Multi-language Support**: English and Arabic with RTL support
- **User Dashboard**: Profile management with role-based views
- **Database Integration**: Supabase profiles table for user data
- **PWA Support**: Installable as a desktop/mobile app
- **Responsive Design**: Works on all device sizes
- **Real-time Updates**: Powered by Supabase real-time database

### Coming Soon
- Restaurant browsing and menu display
- Shopping cart functionality
- Order placement and tracking
- Payment integration
- Delivery driver dashboard
- Order history and favorites

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 8
- **Backend**: Supabase (Authentication, Database, Real-time)
- **Database**: PostgreSQL with Row Level Security
- **Styling**: CSS with modern design system
- **PWA**: Service Worker, Web App Manifest
- **Language**: JavaScript (ES6+)

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account and project
- Modern web browser

## 🔧 Installation

1. **Clone the repository**
```bash
git clone https://github.com/com-saifdev-ly/food-order.git
cd food-order
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Set up Supabase database**
Run the SQL script in `supabase/setup_profiles.sql` in your Supabase SQL Editor.

5. **Configure Supabase**
- Go to Authentication > URL Configuration in your Supabase dashboard
- Set Site URL to your frontend URL
- Add your domain to Redirect URLs
- Configure email templates if desired

6. **Start the development server**
```bash
npm start
```

The app will be available at `http://localhost:3001`

## 📱 Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests

## 🗄️ Database Schema

### Profiles Table
```sql
CREATE TABLE public.profiles (
  id uuid references auth.users(id),
  full_name text,
  role user_role (customer/delivery),
  avatar_url text,
  email varchar,
  created_at timestamp
);
```

**Benefits of database table over metadata:**
- SQL query capabilities
- Data relationships with other tables
- Performance with indexes
- Better scalability
- Analytics and reporting

See `supabase/setup_profiles.sql` for complete setup including RLS policies and triggers.

## 🌐 Deployment

### Environment Variables
Ensure these are set in your deployment environment:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Deployment Platforms
- **Vercel**: Recommended for React apps
- **Netlify**: Easy setup with git integration
- **AWS Amplify**: Full AWS integration

### Supabase Configuration
- Site URL: Your production domain
- Redirect URLs: Add your domain(s)
- Email templates: Customize as needed

## 🎨 Customization

### Branding
See `ASSETS_GUIDE.md` for adding custom logos and icons:
- Shopping cart emoji 🛒 at `/assets/logo.svg`
- App icons in SVG format (scalable)
- Conversion instructions for PNG format if needed

### Colors
Primary theme colors:
- Primary: `#f97316` (Orange)
- Background: `#0f172a` (Dark Blue)
- Text: `#eff6ff` (Light)

## 📄 Project Structure

```
food-order/
├── public/           # Static assets
│   └── assets/       # Logo and favicon files
├── src/
│   ├── components/   # Reusable components
│   ├── lib/         # Utilities and helpers
│   │   ├── profile.js  # Database operations
│   │   └── supabase.js  # Supabase client
│   ├── pages/       # Page components
│   ├── App.jsx      # Main app component
│   └── App.css      # Global styles
├── supabase/        # Database setup scripts
└── package.json
```

## 🔐 Security

- Row Level Security (RLS) on profiles table
- Users can only access their own data
- Database triggers for automatic profile creation
- Environment variables for sensitive data
- Secure authentication flow with Supabase
- Input validation on all forms

## 🌍 Internationalization

Supported languages:
- English (en)
- Arabic (ar) with RTL support

Add new languages in `src/lib/i18n.js`

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👥 Authors

- **Saif Khalifa** - *Initial development*

## 🙏 Acknowledgments

- Supabase for the excellent backend services
- Vite for the fast development experience
- React community for the amazing ecosystem

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check the documentation in `SUPABASE_SETUP.md`
- Review the assets guide in `ASSETS_GUIDE.md`

## 🔮 Roadmap

- [ ] Restaurant management system
- [ ] Menu and food item display
- [ ] Shopping cart functionality
- [ ] Order placement and processing
- [ ] Payment gateway integration
- [ ] Delivery driver dashboard
- [ ] Real-time order tracking
- [ ] User reviews and ratings
- [ ] Advanced search and filtering
- [ ] Admin dashboard

---

Built with ❤️ for food lovers everywhere
