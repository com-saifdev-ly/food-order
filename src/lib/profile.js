import { supabase } from './supabase';
import { getAvatarUrl } from './avatar';

export async function getProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
}

export async function createProfile(userId, email, fullName, role) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        full_name: fullName,
        role: role || 'customer',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error creating profile:', error);
    return null;
  }
}

export async function updateProfile(userId, updates) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating profile:', error);
    return null;
  }
}

export async function getOrCreateProfile(userId, email, fullName, role) {
  // Try to get existing profile first
  let profile = await getProfile(userId);

  // If profile doesn't exist, create it
  if (!profile) {
    profile = await createProfile(userId, email, fullName, role);
  }

  return profile;
}

export async function getProfileWithFallback(userId, email) {
  try {
    // Try to get profile from database first
    const profile = await getProfile(userId);
    
    if (profile) {
      return {
        fullName: profile.full_name || email?.split('@')[0] || 'Unknown',
        email: profile.email || email || 'Unknown',
        role: profile.role || 'customer',
        avatarPath: profile.avatar_path || null,
      };
    }
    
    // Fallback to metadata
    const { data: { user } } = await supabase.auth.getUser();
    const userMetadata = user?.user_metadata || {};
    
    return {
      fullName: userMetadata.full_name || email?.split('@')[0] || 'Unknown',
      email: email || user.email || 'Unknown',
      role: userMetadata.role || 'customer',
      avatarPath: null,
    };
  } catch (error) {
    console.error('Error fetching profile with fallback:', error);
    
    // Ultimate fallback to email and defaults
    return {
      fullName: email?.split('@')[0] || 'Unknown',
      email: email || 'Unknown',
      role: 'customer',
      avatarPath: null,
    };
  }
}

// Helper function to get avatar URL with fallback
export async function getProfileAvatarUrl(userId) {
  try {
    const avatarUrl = await getAvatarUrl(userId);
    return avatarUrl;
  } catch (error) {
    console.error('Error getting avatar URL:', error);
    return '/assets/user.svg'; // Default fallback
  }
}

export async function updateAvatarUrl(userId, avatarUrl) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ avatar_path: avatarUrl })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating avatar URL:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating avatar URL:', error);
    return null;
  }
}
