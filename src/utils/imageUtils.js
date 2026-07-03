import { supabase, supabaseUrl } from "../supabaseClient";

const SUPABASE_URL = supabaseUrl;

// All KYC documents live in this single bucket.
// Layout: driver-kyc/<driverId>/<documentName>.jpg
const KYC_BUCKET = "driver-kyc";

/**
 * Parse a Supabase storage URL into its object path (ignores the bucket
 * segment — every KYC file now lives in KYC_BUCKET).
 * Handles /object/public/... and /object/sign/... and /object/authenticated/...
 */
function parseStoragePath(url) {
  const m = url.match(
    /\/storage\/v1\/object\/(?:public|sign(?:ed)?|authenticated)\/[^/?]+\/(.+?)(?:\?|$)/
  );
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Resolves a driver document DB value to a usable image URL.
 *
 * The value may be:
 *   - null / empty          → return null (show "Not uploaded")
 *   - full Supabase URL     → extract object path, sign against driver-kyc
 *   - plain path/filename   → sign against driver-kyc
 *   - non-Supabase URL      → return as-is
 */
export async function resolveKycImageUrl(value) {
  if (!value) return null;

  // Non-Supabase external URL — use directly
  if (value.startsWith("http") && !value.includes("supabase.co")) return value;

  let path = null;

  if (value.includes("/storage/v1/object/")) {
    // Full Supabase storage URL
    path = parseStoragePath(value);
    if (!path) {
      console.warn("[KYC] Could not parse Supabase URL:", value);
      return value;
    }
  } else if (!value.startsWith("http")) {
    // Plain path or filename stored directly
    path = value;
  } else {
    // Some other supabase.co URL
    path = parseStoragePath(value);
    if (!path) return value;
  }

  if (!path) return null;

  // Sign against the single KYC bucket
  const { data, error } = await supabase.storage
    .from(KYC_BUCKET)
    .createSignedUrl(path, 3600);

  if (!error && data?.signedUrl) return data.signedUrl;

  // Last resort: public URL (the bucket is public)
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${KYC_BUCKET}/${path}`;

  console.error(
    `[KYC] Failed to sign image.\n  Raw value: ${value}\n  Bucket: ${KYC_BUCKET}\n  Path: ${path}\n  Error: ${error?.message ?? "none"}\n  Public URL fallback: ${publicUrl}`
  );

  return publicUrl;
}

/**
 * Canonical KYC document slots shown in the dashboard, in display order.
 * `column` is the matching field on the drivers table row.
 */
export const KYC_SLOTS = [
  { column: "passport_photo", label: "Passport Photo" },
  { column: "driving_license", label: "Driving License" },
  { column: "national_id_front", label: "National ID Front" },
  { column: "national_id_back", label: "National ID Back" },
  { column: "vehicle_picture_front", label: "Vehicle Front" },
  { column: "vehicle_picture_back", label: "Vehicle Back" },
  { column: "car_insurance", label: "Car Insurance" },
  { column: "inspection_report", label: "Inspection Report" },
  { column: "company_reg_certificate", label: "Company Reg Cert" },
  { column: "kra", label: "KRA" },
  { column: "certificate_conduct", label: "Certificate of Conduct" },
];

/**
 * Map a storage filename to a slot column, tolerating the two naming
 * conventions in the bucket (e.g. "nationalID_front.jpg" and
 * "nationalIDFront.jpg", "CarInsurance.jpg" and "psvCarInsurance.jpg").
 * Returns null for files that don't map to a known slot.
 */
function classifyKycFilename(name) {
  const n = name.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]/g, "");
  if (n.includes("passport")) return "passport_photo";
  if (n.includes("driving") || n.includes("driverlicense")) return "driving_license";
  if (n.includes("nationalid") && n.includes("front")) return "national_id_front";
  if (n.includes("nationalid") && n.includes("back")) return "national_id_back";
  if (n.includes("vehiclepicture") && n.includes("front")) return "vehicle_picture_front";
  if (n.includes("vehiclepicture") && n.includes("back")) return "vehicle_picture_back";
  if (n.includes("insurance")) return "car_insurance";
  if (n.includes("inspection")) return "inspection_report";
  if (n.includes("companyreg")) return "company_reg_certificate";
  if (n.includes("kra")) return "kra";
  if (n.includes("conduct")) return "certificate_conduct";
  return null;
}

/** Turn a raw storage filename into a readable label for unmapped extras. */
function humanizeKycFilename(name) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build the full ordered list of KYC documents for a driver as
 * `[{ label, src, column }]`, where `src` is either the stored DB value or a
 * `<driverId>/<file>` storage path (both resolvable by resolveKycImageUrl).
 *
 * Some drivers have files in storage but null DB columns, so we list the
 * driver's storage folder to backfill empty slots and surface any extra
 * documents that don't map to a known slot.
 */
export async function getDriverKycDocs(driver) {
  const docs = KYC_SLOTS.map((s) => ({
    label: s.label,
    src: driver?.[s.column] || null,
    column: s.column,
  }));

  let files = [];
  if (driver?.id) {
    try {
      const { data, error } = await supabase.storage
        .from(KYC_BUCKET)
        .list(driver.id, { limit: 100 });
      if (error) console.warn("[KYC] list folder error:", error.message);
      else if (data) files = data.filter((f) => f.id && f.name && !f.name.startsWith("."));
    } catch (e) {
      console.warn("[KYC] list folder threw:", e.message);
    }
  }

  // Backfill empty slots from matching storage files (DB value wins when set).
  for (const f of files) {
    const key = classifyKycFilename(f.name);
    if (!key) continue;
    const slot = docs.find((d) => d.column === key);
    if (slot && !slot.src) slot.src = `${driver.id}/${f.name}`;
  }

  // Surface storage files that don't map to a known slot.
  const extras = files
    .filter((f) => !classifyKycFilename(f.name))
    .map((f) => ({ label: humanizeKycFilename(f.name), src: `${driver.id}/${f.name}`, column: null }));

  return [...docs, ...extras];
}
