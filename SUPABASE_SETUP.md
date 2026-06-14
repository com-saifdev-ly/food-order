# Supabase Setup Guide

## Prerequisites
- A Supabase project created at https://supabase.com
- Environment variables set in `.env` file:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

## Database Setup

### Run the SQL Setup Script
Run the SQL script in `supabase/setup_profiles.sql` in your Supabase SQL Editor.

This will:
- Create `user_role` enum type ('customer', 'delivery')
- Create `profiles` table with proper constraints
- Set up Row Level Security (RLS) policies
- Create automatic profile creation trigger on user signup

### Database Schema

#### Profiles Table
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

The profiles table stores user profile data separately from Supabase auth, allowing for:
- **SQL queries** on user data
- **Data relationships** with other tables (orders, addresses, etc.)
- **Scalability** for future features
- **Performance** with proper indexing

### User Data Flow

1. **User signs up** → Data stored in Supabase auth + metadata
2. **Database trigger** → Automatically creates profile in profiles table
3. **Dashboard loads** → Fetches from profiles table (not metadata)
4. **Profile updates** → Direct database operations

### Email Configuration
Configure your Supabase project's email settings:
- Go to Authentication > URL Configuration
- Set Site URL to your frontend URL (e.g., https://foodorder.com.ly for production)
- Add your domain to Redirect URLs: `https://foodorder.com.ly/**`
- The application will send reset emails that redirect to `/reset-password`

### Password Reset
The application has a built-in password reset flow at `/reset-password`.

## Environment Variables
Create a `.env` file in the project root:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Features Implemented
1. **PWA Support**: Progressive Web App with offline capability
2. **User Dashboard**: Shows user profile data from profiles table
3. **Account Types**: Customer and Delivery roles
4. **Password Reset**: Custom password reset flow
5. **Home Button Navigation**: Appears on non-root pages
6. **Database Integration**: Proper profile table with RLS
7. **Multi-language Support**: English and Arabic with RTL

## Security
- Row Level Security (RLS) enabled on profiles table
- Users can only access their own profiles
- Database trigger ensures profile creation on signup
- Environment variables for sensitive data

## Scaling Benefits
Using a database table instead of metadata provides:
- **Query capabilities**: Can run SQL queries on user data
- **Relationships**: Can link to orders, addresses, reviews, etc.
- **Performance**: Database indexes and optimization
- **Analytics**: Better reporting and data analysis
- **Backup**: Proper database backup strategies
