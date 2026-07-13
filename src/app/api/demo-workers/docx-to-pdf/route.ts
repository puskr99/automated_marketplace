import { NextResponse } from "next/server";

// Simulates a THIRD-PARTY DEVELOPER'S hosted service — not a platform
// endpoint. The platform only ever talks to this over HTTP via the
// manifest's `endpoint.url`, exactly as it would a real external server.
// Internally this "developer" happens to implement their service on top of
// ConvertAPI, but that upstream credential (CONVERTAPI_SECRET) is theirs —
// it never appears in the manifest, the job input, or anything the
// platform or buyer can see.

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const fileUrl = body?.file_url;

  if (!fileUrl || typeof fileUrl !== "string") {
    return NextResponse.json({ error: "file_url (string) is required" }, { status: 400 });
  }

  const secret = process.env.CONVERTAPI_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "converter not configured" }, { status: 503 });
  }

  const sourceRes = await fetch(fileUrl);
  if (!sourceRes.ok) {
    return NextResponse.json(
      { error: `could not fetch file_url (status ${sourceRes.status})` },
      { status: 400 },
    );
  }
  const sourceBlob = await sourceRes.blob();

  const form = new FormData();
  form.append("File", sourceBlob, "input.docx");

  const convertRes = await fetch("https://v2.convertapi.com/convert/docx/to/pdf", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    body: form,
  });

  if (!convertRes.ok) {
    return NextResponse.json(
      { error: `conversion failed (status ${convertRes.status})` },
      { status: 502 },
    );
  }

  const result = await convertRes.json();
  const file = result.Files?.[0];
  if (!file) {
    return NextResponse.json({ error: "conversion returned no file" }, { status: 502 });
  }

  return NextResponse.json({
    file_name: file.FileName,
    file_size_bytes: file.FileSize,
    pdf_base64: file.FileData,
  });
}
