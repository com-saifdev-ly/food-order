# Supabase Setup Guide

## Prerequisites
- A Supabase project created at https://supabase.com
- Environment variables set in `.env` file:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

## Database Setup

### User Data Storage
This application uses Supabase's built-in `user_metadata` to store user profile information:
- **Full name**: Stored in `user_metadata.full_name`
- **Account type**: Stored in `user_metadata.account_type` ('customer' or 'delivery')
- **Email**: Automatically managed by Supabase auth

### Email Configuration
Configure your Supabase project's email settings:
- Go to Authentication > URL Configuration
- Set Site URL to your frontend URL (e.g., http://localhost:3001 for development)
- Set Redirect URLs to include your callback URL

### Password Reset
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
2. **User Dashboard**: Shows user profile data from user_metadata
3. **Account Types**: Customer and Delivery roles
4. **Password Reset**: Custom password reset flow
5. **Home Button Navigation**: Appears on non-root pages
6. **Expandable Download Section**: Toggle to show platform download options
7. **Multi-language Support**: English and Arabic with RTL

## User Data Schema

### User Metadata Structure
```javascript
{
  full_name: "User's full name",
  account_type: "customer" | "delivery",
  email: "user@example.com" // managed by Supabase
}
```

## Security
- Supabase handles authentication and session management
- User data is stored securely in Supabase's user_metadata
- Password reset flows use secure tokens
- Row-level security can be added if database tables are introduced later

## Scaling Considerations
The current implementation uses Supabase's user_metadata which is:
- **Quick to implement**: No additional database setup needed
- **Sufficient for MVP**: Handles basic user profile information
- **Limited to 2KB**: User metadata has size constraints
- **Not queryable**: Cannot run SQL queries on metadata

If you need to scale to a full database table in the future:
- Create a profiles table similar to the schema discussed earlier
- Migrate existing user_metadata to the new table
- Update the application code to fetch from the database
- Add Row-Level Security policies for data protection
