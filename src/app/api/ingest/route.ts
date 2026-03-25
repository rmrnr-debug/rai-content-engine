import { ingestDrive } from "@/lib/driveIngest";

export async function GET() {
  console.log("EMAIL:", process.env.GOOGLE_CLIENT_EMAIL);
  console.log("KEY LENGTH:", process.env.GOOGLE_PRIVATE_KEY?.length);

  const folderId = "1EulPN9JUikaXjQcOjz14-srbkUDzHxAl";

  const count = await ingestDrive(folderId);

  return Response.json({
    success: true,
    files_ingested: count,
  });
}