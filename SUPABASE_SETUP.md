# Supabase Setup Guide

## Prerequisites
- A Supabase project created at https://supabase.com
- Environment variables set in `.env` file:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

## Database Setup

### 1. Create Profiles Table
Run the SQL script in `supabase/setup_profiles.sql` in your Supabase SQL Editor.

This will:
- Create a `user_role` enum type ('customer', 'delivery')
- Create a `profiles` table linked to auth.users
- Set up Row Level Security (RLS) policies
- Create a trigger to automatically create profiles when users sign up

### 2. Email Configuration
Configure your Supabase project's email settings:
- Go to Authentication > URL Configuration
- Set Site URL to your frontend URL (e.g., http://localhost:3001 for development)
- Set Redirect URLs to include your callback URL

### 3. Password Reset
The application has a built-in password reset flow at `/reset-password`.

To configure this in Supabase:
- Go to Authentication > URL Configuration
- Set Site URL to your frontend URL (e.g., https://foodorder.com.ly for production)
- Add your domain to Redirect URLs: `https://foodorder.com.ly/**`
- The application will send reset emails that redirect to `/reset-password` where users can set a new password

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
6. **Expandable Download Section**: Toggle to show platform download options

## Database Schema

### profiles table
- `id` (uuid): References auth.users
- `full_name` (text): User's full name
- `role` (user_role): 'customer' or 'delivery'
- `avatar_url` (text): Optional profile picture URL
- `created_at` (timestamp): Account creation timestamp
- `email` (varchar): User's email address

## Security
- Row Level Security enabled on profiles table
- Users can only access their own profiles
- Profiles automatically created on user signup via database trigger
