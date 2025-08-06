import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getFileRecord } from '@/app/actions/upload-file/libs/database';
import { handleApiAuthSession } from '@/utils/auth/setAuthSession';
import { Langfuse } from 'langfuse';

const BUCKET_NAME = 'uploads';

// Initialize Langfuse client
const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com',
});

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
  const startTime = Date.now();
  
  // Create trace for the delete operation
  const trace = langfuse.trace({
    name: 'file-deletion',
    metadata: {
      endpoint: '/api/delete',
      timestamp: new Date().toISOString(),
    },
    tags: ['file-deletion', 'storage-cleanup'],
  });

  try {
    const body = await request.json() as DeleteRequest;
    const { fileId } = body;

    if (!fileId) {
      trace.event({
        name: 'delete-request-validation-failed',
        metadata: {
          error: 'File ID is required',
        },
      });
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    // Update trace with file ID
    trace.update({
      metadata: {
        fileId,
      }
    });

    trace.event({
      name: 'delete-request-received',
      metadata: {
        file_id: fileId,
      },
    });

    // Initialize Supabase client and authenticate
    const supabase = await createClient();
    await handleApiAuthSession(supabase, request);

    // Get file record from database (RLS will handle access control)
    const fileRecord = await getFileRecord(supabase, fileId);
    if (!fileRecord) {
      trace.event({
        name: 'delete-file-not-found',
        metadata: {
          file_id: fileId,
        },
      });
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    trace.event({
      name: 'delete-file-found',
      metadata: {
        file_id: fileId,
        duckdb_path: fileRecord.duckdb_path,
        status: fileRecord.status,
        sheets_processed: fileRecord.sheets_processed,
      },
    });

    // Extract folder path from the duckdb_path (e.g., "tenant123/duckdb/abc123/database.duckdb" -> "tenant123/duckdb/abc123/")
    const folderPath = fileRecord.duckdb_path.substring(0, fileRecord.duckdb_path.lastIndexOf('/') + 1);

    try {
      // List all files in the folder to delete them
      const { data: fileList, error: listError } = await supabase.storage
        .from(BUCKET_NAME)
        .list(folderPath);

      if (listError) {
        trace.event({
          name: 'delete-storage-list-error',
          metadata: {
            error: listError.message,
            folder_path: folderPath,
          },
        });
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
          trace.event({
            name: 'delete-storage-remove-error',
            metadata: {
              error: deleteFilesError.message,
              file_paths: filePaths,
            },
          });
          throw new Error('Failed to delete files from storage');
        }

        deletedFiles.push(...filePaths);
        
        trace.event({
          name: 'delete-storage-files-removed',
          metadata: {
            files_deleted: filePaths.length,
            file_paths: filePaths,
            folder_path: folderPath,
          },
        });
      }

      // Delete the database record (RLS will handle access control)
      const { error: deleteRecordError } = await supabase
        .from('duckdb_files')
        .delete()
        .eq('file_id', fileId);

      if (deleteRecordError) {
        trace.event({
          name: 'delete-database-record-error',
          metadata: {
            error: deleteRecordError.message,
            file_id: fileId,
          },
        });
        throw new Error('Failed to delete database record');
      }

      const executionTime = Date.now() - startTime;
      
      trace.event({
        name: 'delete-operation-completed',
        metadata: {
          file_id: fileId,
          files_deleted: deletedFiles.length,
          execution_time_ms: executionTime,
        },
      });

      const response: DeleteResponse = {
        success: true,
        message: 'File and associated data deleted successfully',
        deletedFileId: fileId,
        deletedFiles
      };

      return NextResponse.json(response, { status: 200 });

    } catch (storageError) {
      const errorMessage = storageError instanceof Error ? storageError.message : 'Unknown storage error';
      
      trace.event({
        name: 'delete-storage-error',
        metadata: {
          error: errorMessage,
          file_id: fileId,
          folder_path: folderPath,
        },
      });
      
      // If storage deletion fails, we might want to mark the record as "deletion_failed"
      // instead of leaving it in an inconsistent state
      try {
        const { error: updateError } = await supabase
          .from('duckdb_files')
          .update({ status: 'deletion_failed' })
          .eq('file_id', fileId);

        if (updateError) {
          trace.event({
            name: 'delete-status-update-error',
            metadata: {
              error: updateError.message,
              file_id: fileId,
            },
          });
        } else {
          trace.event({
            name: 'delete-status-updated',
            metadata: {
              file_id: fileId,
              new_status: 'deletion_failed',
            },
          });
        }
      } catch (updateError) {
        trace.event({
          name: 'delete-status-update-exception',
          metadata: {
            error: updateError instanceof Error ? updateError.message : 'Unknown error',
            file_id: fileId,
          },
        });
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to delete file and associated data',
        details: errorMessage
      }, { status: 500 });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const executionTime = Date.now() - startTime;
    
    trace.event({
      name: 'delete-operation-error',
      metadata: {
        error: errorMessage,
        error_type: error instanceof Error ? error.constructor.name : 'Unknown',
        execution_time_ms: executionTime,
      },
    });
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });

  } finally {
    // Ensure Langfuse trace is properly closed
    try {
      await langfuse.shutdownAsync();
    } catch (langfuseError) {
      console.warn('Langfuse shutdown error:', langfuseError);
    }
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