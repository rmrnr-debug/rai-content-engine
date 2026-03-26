export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { analyzeImage } from "@/lib/analyzeMedia";
import { google } from "googleapis";
import sharp from "sharp";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =========================
// 🔐 GOOGLE AUTH
// =========================
function getGoogleAuth() {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error("Missing Google credentials");
  }

  key = key.replace(/\\n/g, "\n");

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
}

// =========================
// 📦 MIGRATE + COMPRESS
// =========================
async function migrateToSupabase(item: any): Promise<string | null> {
  if (!item.drive_file_id) return null;

  const auth = getGoogleAuth();
  const client = await auth.getClient();

  const drive = google.drive({
    version: "v3",
    auth: client as any,
  });

  console.log("[migrate] downloading:", item.drive_file_id);

  const res = await drive.files.get(
    { fileId: item.drive_file_id, alt: "media" },
    { responseType: "arraybuffer" }
  );

  // ✅ FIXED TYPE HERE
  let buffer: Buffer = Buffer.from(res.data as ArrayBuffer);

  const mimeType =
    res.headers["content-type"] ||
    item.mime_type ||
    "image/jpeg";

  if (!mimeType.startsWith("image/")) {
    console.log("[SKIP] not image:", item.id);
    return null;
  }

  // 🔥 COMPRESSION
  try {
    buffer = await sharp(buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer(); // ✅ NO CAST NEEDED

    console.log(
      "[COMPRESS]",
      item.id,
      (buffer.length / 1024 / 1024).toFixed(2) + "MB"
    );
  } catch {
    console.log("[COMPRESS FAIL]", item.id);
    return null;
  }

  // size guard
  if (buffer.length > 5 * 1024 * 1024) {
    console.log("[SKIP AFTER COMPRESS]", item.id);
    return null;
  }

  const filename = `${item.id}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(filename, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    console.log("[FAIL upload]:", uploadError.message);
    return null;
  }

  const { data } = supabase.storage
    .from("media")
    .getPublicUrl(filename);

  const newUrl = data.publicUrl;

  await supabase
    .from("media_files")
    .update({ url: newUrl })
    .eq("id", item.id);

  console.log("[migrate] success:", newUrl);

  return newUrl;
}

// =========================
// 🚀 WORKER (PARALLEL)
// =========================
export async function GET() {
  const { data: media, error } = await supabase
    .from("media_files")
    .select("*")
    .eq("status", "pending")
    .limit(3);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  let skipped = 0;

  const jobs = (media || []).map(async (item) => {
    console.log("--------------------------------------------------");
    console.log("[STEP] processing:", item.id);

    try {
      await supabase
        .from("media_files")
        .update({ status: "processing" })
        .eq("id", item.id);

      if (!item.mime_type?.startsWith("image/")) {
        console.log("[SKIP] not image");
        skipped++;
        return;
      }

      let finalUrl: string | null = null;

      if (item.url?.includes("supabase.co")) {
        finalUrl = item.url;
      } else if (item.url?.includes("drive.google.com")) {
        finalUrl = await migrateToSupabase(item);
      }

      if (!finalUrl) {
        console.log("[SKIP] no valid URL");
        skipped++;
        return;
      }

      console.log("[STEP] analyzing:", item.id);

      const result = await analyzeImage(finalUrl);

      const clean = result.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      await supabase.from("media_analysis").insert({
        media_id: item.id,
        ...parsed,
      });

      await supabase
        .from("media_files")
        .update({ status: "done" })
        .eq("id", item.id);

      console.log("[SUCCESS]", item.id);
      processed++;

    } catch (err: any) {
      console.log("[FAIL]", item.id, err.message);

      await supabase
        .from("media_files")
        .update({ status: "pending" })
        .eq("id", item.id);
    }
  });

  await Promise.all(jobs);

  return Response.json({
    processed,
    skipped,
  });
}

// =========================
// 🔁 RESET QUEUE
// =========================
export async function POST() {
  const { error } = await supabase
    .from("media_files")
    .update({ status: "pending" });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}