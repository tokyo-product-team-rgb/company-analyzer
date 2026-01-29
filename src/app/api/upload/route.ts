import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname: string) => {
        // Allow any upload
        return {
          allowedContentTypes: [
            'application/pdf',
            'text/plain',
            'text/csv',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/vnd.ms-powerpoint',
            'application/msword',
            'application/json',
            'text/markdown',
            'text/html',
            'image/png',
            'image/jpeg',
            'image/webp',
            'application/octet-stream',
          ],
          maximumSizeInBytes: 1024 * 1024 * 1024, // 1GB
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('Upload completed:', blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
