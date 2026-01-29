import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';

// Client upload handler — generates presigned URLs so files upload
// directly to Vercel Blob, bypassing the serverless body size limit.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Allow all uploads — add auth here if needed
        return {
          allowedContentTypes: [
            'application/pdf',
            'text/plain',
            'text/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/json',
            'image/png',
            'image/jpeg',
            'image/webp',
          ],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Upload completed:', blob.url, tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Client upload error:', error);
    const msg = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
