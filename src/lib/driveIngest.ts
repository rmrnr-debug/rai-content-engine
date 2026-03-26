import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ allowed image types only (strict)
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function ingestDrive(folderId: string) {
  // =========================
  // 🔒 VALIDATE ENV
  // =========================
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !rawKey) {
    throw new Error("Missing Google credentials");
  }

  // =========================
  // 🔧 CLEAN PRIVATE KEY
  // =========================
  const privateKey = rawKey
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "")
    .trim();

  console.log("[INGEST AUTH] EMAIL:", clientEmail);
  console.log("[INGEST AUTH] KEY LENGTH:", privateKey.length);

  // =========================
  // 🔐 AUTH
  // =========================
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const client = await auth.getClient();

  const drive = google.drive({
    version: "v3",
    auth: client as any,
  });

  // =========================
  // 📂 FETCH FILES
  // =========================
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id, name, mimeType)",
    pageSize: 100,
  });

  const files = res.data.files || [];

  let inserted = 0;
  let skipped = 0;

  // =========================
  // 💾 FILTER + STORE
  // =========================
  for (const file of files) {
    if (!file.id) continue;

    const mime = file.mimeType || "";

    // 🚫 STRICT FILTER (ONLY VALID IMAGES)
    if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
      console.log("[INGEST SKIP]", file.name, mime);
      skipped++;
      continue;
    }

    // ✅ STORE CLEAN RECORD
    const { error } = await supabase.from("media_files").upsert({
      drive_file_id: file.id,
      file_name: file.name || "",
      mime_type: mime,
      // 🔥 IMPORTANT: DO NOT TRUST webContentLink
      url: `https://drive.google.com/file/d/${file.id}/view`,
    });

    if (error) {
      console.error("[INGEST FAIL]", file.name, error.message);
      continue;
    }

    console.log("[INGEST OK]", file.name, mime);
    inserted++;
  }

  console.log("=================================");
  console.log("INGEST SUMMARY");
  console.log("Inserted:", inserted);
  console.log("Skipped:", skipped);
  console.log("Total:", files.length);
  console.log("=================================");

  return {
    total: files.length,
    inserted,
    skipped,
  };
}