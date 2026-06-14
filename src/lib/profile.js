import { supabase } from './supabase';

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

export async function createProfile(userId, email, fullName, accountType) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        full_name: fullName,
        role: accountType || 'customer',
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

export async function getOrCreateProfile(userId, email, fullName, accountType) {
  // Try to get existing profile first
  let profile = await getProfile(userId);

  // If profile doesn't exist, create it
  if (!profile) {
    profile = await createProfile(userId, email, fullName, accountType);
  }

  return profile;
}
