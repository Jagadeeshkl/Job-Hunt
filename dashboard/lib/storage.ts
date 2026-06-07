// Uploads generated PDFs to Supabase Storage and returns public URLs.
// Ensures the bucket exists (public) on first use.

import { getServiceClient } from './supabase';

const BUCKET = 'documents';
let bucketReady = false;

async function ensureBucket() {
  if (bucketReady) return;
  const supabase = getServiceClient();
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: '5MB',
    });
  }
  bucketReady = true;
}

/**
 * Upload a PDF buffer to `documents/<dir>/<filename>` and return its public URL.
 * Overwrites any existing file at the same path (upsert).
 */
export async function uploadPdf(dir: string, filename: string, pdf: Buffer): Promise<string> {
  await ensureBucket();
  const supabase = getServiceClient();
  const objectPath = `${dir}/${filename}`;

  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, pdf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}
