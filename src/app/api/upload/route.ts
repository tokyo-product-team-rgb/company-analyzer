import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';

// Handle both the token generation and the completion callback
export async function POST(req: NextRequest) {
  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        return {
          maximumSizeInBytes: 1024 * 1024 * 1024, // 1GB
        };
      },
      onUploadCompleted: async () => {
        // No-op — we don't need to do anything on completion
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Upload handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
