import { supabase } from './supabase';

const STORAGE_BUCKET = 'avatars';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const DEFAULT_AVATAR = '/assets/user.svg';
const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

/**
 * Upload avatar file to Supabase storage
 * @param {File} file - The file to upload
 * @returns {Promise<{publicUrl: string, path: string}>}
 */
export async function uploadAvatar(file) {
  try {
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 2MB limit');
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Get file extension
    const extension = file.name.split('.').pop();
    const fileName = `avatar.${extension}`;
    const filePath = `${user.id}/${fileName}`;

    // Upload file to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      throw new Error('Failed to upload avatar: ' + uploadError.message);
    }

    // Save path to profiles table
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_path: filePath })
      .eq('id', user.id);

    if (updateError) {
      throw new Error('Failed to update avatar path: ' + updateError.message);
    }

    // Generate signed URL (expires in 1 hour)
    const { data: { signedUrl } } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

    if (!signedUrl) {
      console.error('Failed to generate signed URL');
      throw new Error('Failed to generate signed URL');
    }

    return {
      publicUrl: signedUrl,
      path: filePath
    };

  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw error;
  }
}

/**
 * Get avatar URL for a user using signed URL
 * @param {string} userId - The user ID
 * @returns {Promise<string>}
 */
export async function getAvatarUrl(userId) {
  try {
    // Fetch avatar_path from profiles table
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('avatar_path')
      .eq('id', userId)
      .single();

    if (error || !profile || !profile.avatar_path) {
      return DEFAULT_AVATAR;
    }

    // Generate signed URL (expires in 1 hour)
    const { data: { signedUrl } } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(profile.avatar_path, SIGNED_URL_EXPIRY);

    if (!signedUrl) {
      console.error('Failed to generate signed URL');
      return DEFAULT_AVATAR;
    }

    return signedUrl;

  } catch (error) {
    console.error('Error getting avatar URL:', error);
    return DEFAULT_AVATAR;
  }
}

/**
 * Update user avatar with a new file
 * @param {File} file - The new avatar file
 * @returns {Promise<string>} - The new public URL
 */
export async function updateAvatar(file) {
  try {
    const result = await uploadAvatar(file);
    return result.publicUrl;
  } catch (error) {
    console.error('Error updating avatar:', error);
    throw error;
  }
}

/**
 * Delete user avatar
 * @returns {Promise<void>}
 */
export async function deleteAvatar() {
  try {
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Get current avatar_path
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('avatar_path')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Failed to fetch user profile');
    }

    // Remove file from storage if avatar_path exists
    if (profile.avatar_path) {
      const { error: deleteError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([profile.avatar_path]);

      if (deleteError) {
        console.error('Error deleting avatar from storage:', deleteError);
      }
    }

    // Set avatar_path to NULL in profiles table
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_path: null })
      .eq('id', user.id);

    if (updateError) {
      throw new Error('Failed to clear avatar path: ' + updateError.message);
    }

  } catch (error) {
    console.error('Error deleting avatar:', error);
    throw error;
  }
}

/**
 * Validate avatar file
 * @param {File} file - The file to validate
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateAvatarFile(file) {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 2MB limit' };
  }

  return { valid: true, error: null };
}