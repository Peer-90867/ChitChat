import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isPlaceholder = !supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseAnonKey || supabaseAnonKey === 'placeholder';

if (isPlaceholder) {
  console.warn('Supabase credentials missing or using placeholders. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your secrets.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

export const hasValidSupabase = !isPlaceholder;

export const ensureBucketExists = async (bucketName: string) => {
  if (!hasValidSupabase) return false;
  
  try {
    const { data: bucket, error: getError } = await supabase.storage.getBucket(bucketName);
    
    if (getError) {
      if (getError.message.toLowerCase().includes('not found')) {
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
          fileSizeLimit: 5242880 // 5MB
        });
        
        if (createError) {
          console.error(`Failed to create bucket ${bucketName}:`, createError);
          return false;
        }
        return true;
      }
      console.error(`Error checking bucket ${bucketName}:`, getError);
      return false;
    }
    
    return !!bucket;
  } catch (err) {
    console.error(`Unexpected error ensuring bucket ${bucketName}:`, err);
    return false;
  }
};
