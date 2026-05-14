import { supabase } from "../supabaseClient";

const SUPABASE_URL = "https://gtevlsbundbddlqqslbf.supabase.co";

/**
 * Parse a Supabase storage URL into { bucket, path }.
 * Handles both public and signed URL formats.
 */
function parseStorageUrl(url) {
  // https://xxx.supabase.co/storage/v1/object/public/{bucket}/{path}
  // https://xxx.supabase.co/storage/v1/object/sign/{bucket}/{path}?token=...
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/?]+)\/(.+?)(?:\?|$)/);
  if (match) return { bucket: match[1], path: decodeURIComponent(match[2]) };
  return null;
}

/**
 * Resolves a driver document value to a usable image URL.
 *
 * Strategy:
 * 1. null/empty → return null (show "Not uploaded")
 * 2. Non-Supabase http URL → return as-is
 * 3. Supabase storage URL → extract bucket + path, create signed URL
 * 4. Plain path string → try signed URL with common bucket names
 */
export async function resolveKycImageUrl(value) {
  if (!value) return null;

  // Non-Supabase external URL — use directly
  if (value.startsWith("http") && !value.includes("supabase.co")) {
    return value;
  }

  let bucket = null;
  let path = null;

  if (value.includes("/storage/v1/object/")) {
    // It's a Supabase storage URL — parse it
    const parsed = parseStorageUrl(value);
    if (parsed) {
      bucket = parsed.bucket;
      path = parsed.path;
    }
  } else if (!value.startsWith("http")) {
    // Plain path — try common bucket names
    // We'll try them in order via the signed URL attempts below
    path = value;
  } else {
    // Some other https URL on supabase.co
    const parsed = parseStorageUrl(value);
    if (parsed) {
      bucket = parsed.bucket;
      path = parsed.path;
    } else {
      return value;
    }
  }

  if (!path) return null;

  // Try signed URL — works for both public and private buckets
  const bucketsToTry = bucket
    ? [bucket]
    : ["driver-documents", "drivers", "documents", "kyc", "uploads"];

  for (const b of bucketsToTry) {
    try {
      const { data, error } = await supabase.storage
        .from(b)
        .createSignedUrl(path, 3600);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch {
      // try next bucket
    }
  }

  // Last resort: try constructing a public URL
  if (bucket) {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  }

  return null;
}
