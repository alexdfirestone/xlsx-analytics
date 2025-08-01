import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getFileRecord } from '@/app/actions/upload-file/libs/database';
import { handleApiAuthSession } from '@/utils/auth/setAuthSession';

const BUCKET_NAME = 'uploads';

interface DeleteRequest {
  fileId: string;
}

interface DeleteResponse {
  success: boolean;
  message: string;
  error?: string;
  deletedFileId?: string;
  deletedFiles?: string[];
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as DeleteRequest;
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client and authenticate
    const supabase = await createClient();
    await handleApiAuthSession(supabase, request);

    // Get file record from database (RLS will handle access control)
    const fileRecord = await getFileRecord(supabase, fileId);
    if (!fileRecord) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    // Extract folder path from the duckdb_path (e.g., "tenant123/duckdb/abc123/database.duckdb" -> "tenant123/duckdb/abc123/")
    const folderPath = fileRecord.duckdb_path.substring(0, fileRecord.duckdb_path.lastIndexOf('/') + 1);

    try {
      // List all files in the folder to delete them
      const { data: fileList, error: listError } = await supabase.storage
        .from(BUCKET_NAME)
        .list(folderPath);

      if (listError) {
        console.error('Error listing files in folder:', listError);
        // Continue with deletion even if we can't list files
      }

      // Delete all files in the folder
      const deletedFiles: string[] = [];
      
      if (fileList && fileList.length > 0) {
        const filePaths = fileList.map((file: {name: string}) => `${folderPath}${file.name}`);
        
        const { error: deleteFilesError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(filePaths);

        if (deleteFilesError) {
          console.error('Error deleting files from storage:', deleteFilesError);
          throw new Error('Failed to delete files from storage');
        }

        deletedFiles.push(...filePaths);
        console.log(`Deleted ${filePaths.length} files from storage`);
      }

      // Delete the database record (RLS will handle access control)
      const { error: deleteRecordError } = await supabase
        .from('duckdb_files')
        .delete()
        .eq('file_id', fileId);

      if (deleteRecordError) {
        console.error('Error deleting database record:', deleteRecordError);
        throw new Error('Failed to delete database record');
      }

      console.log(`Successfully deleted file record and storage for file_id: ${fileId}`);

      const response: DeleteResponse = {
        success: true,
        message: 'File and associated data deleted successfully',
        deletedFileId: fileId,
        deletedFiles
      };

      return NextResponse.json(response, { status: 200 });

    } catch (storageError) {
      console.error('Storage deletion error:', storageError);
      
      // If storage deletion fails, we might want to mark the record as "deletion_failed"
      // instead of leaving it in an inconsistent state
      try {
        await supabase
          .from('duckdb_files')
          .update({
            status: 'deletion_failed',
            updated_at: new Date().toISOString()
          })
          .eq('file_id', fileId);
      } catch (updateError) {
        console.error('Failed to update status to deletion_failed:', updateError);
      }

      return NextResponse.json(
        { error: 'Failed to delete file from storage' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Delete API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Optional: Add a GET method to check if a file exists before deletion
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    await handleApiAuthSession(supabase, request);

    // Get file record from database (RLS will handle access control)
    const fileRecord = await getFileRecord(supabase, fileId);
    if (!fileRecord) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      exists: true,
      file: fileRecord
    });

  } catch (error) {
    console.error('Check file existence error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}