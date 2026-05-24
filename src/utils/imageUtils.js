import { supabase } from "../supabaseClient";

const SUPABASE_URL = "https://gtevlsbundbddlqqslbf.supabase.co";

// Cached bucket names — discovered once on first use
let _bucketsCache = null;

async function discoverBuckets() {
  if (_bucketsCache) return _bucketsCache;
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (!error && data?.length) {
      _bucketsCache = data.map((b) => b.name);
      console.log("[KYC] Available storage buckets:", _bucketsCache);
      return _bucketsCache;
    }
    if (error) console.warn("[KYC] listBuckets error:", error.message);
  } catch (e) {
    console.warn("[KYC] listBuckets threw:", e.message);
  }
  // Fallback — extend this if auto-discovery fails
  _bucketsCache = [
    "driver-documents",
    "driver-kyc",
    "kyc-documents",
    "drivers",
    "documents",
    "kyc",
    "uploads",
    "images",
  ];
  console.warn("[KYC] Bucket discovery failed, using fallback list:", _bucketsCache);
  return _bucketsCache;
}

/**
 * Parse a Supabase storage URL into { bucket, path }.
 * Handles /object/public/... and /object/sign/... and /object/authenticated/...
 */
function parseStorageUrl(url) {
  const m = url.match(
    /\/storage\/v1\/object\/(?:public|sign(?:ed)?|authenticated)\/([^/?]+)\/(.+?)(?:\?|$)/
  );
  if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
  return null;
}

/**
 * Resolves a driver document DB value to a usable image URL.
 *
 * The value may be:
 *   - null / empty          → return null (show "Not uploaded")
 *   - full Supabase URL     → parse bucket + path, create signed URL
 *   - plain path/filename   → try all known buckets
 *   - non-Supabase URL      → return as-is
 */
export async function resolveKycImageUrl(value) {
  if (!value) return null;

  // Non-Supabase external URL — use directly
  if (value.startsWith("http") && !value.includes("supabase.co")) return value;

  let bucket = null;
  let path = null;

  if (value.includes("/storage/v1/object/")) {
    // Full Supabase storage URL
    const parsed = parseStorageUrl(value);
    if (parsed) {
      bucket = parsed.bucket;
      path = parsed.path;
    } else {
      // Unrecognised format — try as-is
      console.warn("[KYC] Could not parse Supabase URL:", value);
      return value;
    }
  } else if (!value.startsWith("http")) {
    // Plain path or filename stored directly
    path = value;
  } else {
    // Some other supabase.co URL
    const parsed = parseStorageUrl(value);
    if (parsed) { bucket = parsed.bucket; path = parsed.path; }
    else return value;
  }

  if (!path) return null;

  // Build ordered list of buckets to try — known bucket first
  const allBuckets = await discoverBuckets();
  const toTry = bucket
    ? [bucket, ...allBuckets.filter((b) => b !== bucket)]
    : allBuckets;

  for (const b of toTry) {
    const { data, error } = await supabase.storage
      .from(b)
      .createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) {
      if (b !== bucket) {
        console.log(`[KYC] Found "${path}" in bucket "${b}" (stored bucket was "${bucket ?? "unknown"}")`);
      }
      return data.signedUrl;
    }
  }

  // Last resort: public URL (works only if the bucket is public)
  const publicUrl = bucket
    ? `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
    : null;

  console.error(
    `[KYC] Failed to resolve image.\n  Raw value: ${value}\n  Parsed bucket: ${bucket ?? "none"}\n  Parsed path: ${path}\n  Tried buckets: ${toTry.join(", ")}\n  Public URL fallback: ${publicUrl ?? "n/a"}`
  );

  return publicUrl;
}
