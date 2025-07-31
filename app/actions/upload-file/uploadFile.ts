'use server';

import { createClient } from '@/utils/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { 
  processExcelFile,
  uploadToStorage,
  downloadFileFromStorage,
  cleanupTempFiles
} from '@/app/actions/upload-file/libs';
import { DuckDBInstance } from '@duckdb/node-api';

const BUCKET_NAME = 'uploads';

interface UploadResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  message?: string;
  error?: string;
  processingResult?: {
    workbookId: string;
    sheetsProcessed: number;
    tables: {
      name: string;
      rowCount: number;
      columns: string[];
    }[];
  };
}

/**
 * Sanitize filename for storage
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/__/g, "_");
}

/**
 * Generate unique filename with timestamp
 */
function generateUniqueFileName(originalName: string): string {
  const timestamp = Date.now();
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);
  const sanitizedBaseName = sanitizeFileName(baseName);
  return `${sanitizedBaseName}__${timestamp}${extension}`;
}

/**
 * Simple verification - download database and try to query it
 */
async function verifyDatabase(
  supabase: any,
  sha: string,
  expectedSheets: number
): Promise<{
  success: boolean;
  tables: {
    name: string;
    rowCount: number;
    columns: string[];
  }[];
  error?: string;
}> {
  let localDbPath: string | null = null;
  
  try {
    console.log('🔍 Starting database verification...');
    
    // Download the database from storage
    const dbStoragePath = `duckdb/${sha}/${sha}.duckdb`;
    localDbPath = await downloadFileFromStorage(supabase, dbStoragePath);
    console.log(`Database downloaded to: ${localDbPath}`);

    // Check file size
    const fs = require('fs').promises;
    const downloadedStats = await fs.stat(localDbPath);
    console.log(`Downloaded file size: ${downloadedStats.size} bytes`);
    
    if (downloadedStats.size === 0) {
      throw new Error('Downloaded file is empty (0 bytes)');
    }
    
    // Create DuckDB instance and connect
    const instance = await DuckDBInstance.create(localDbPath);
    const connection = await instance.connect();
    console.log('Database connection established');

    // Get table list
    const tablesResult = await connection.run("SHOW TABLES");
    const tables = await tablesResult.getRows();
    const tableNames = tables.map((row: any) => row[0] as string);
    console.log(`Tables found: ${tableNames.length}, Expected: ${expectedSheets}`);

    // Get table information
    const tableInfo = [];
    
    for (const tableName of tableNames) {
      try {
        // Count rows
        const countResult = await connection.run(`SELECT COUNT(*) FROM ${tableName}`);
        const countData = await countResult.getRows();
        const rowCount = Number(countData[0][0]);
        
        // Get column information
        const columnsResult = await connection.run(`DESCRIBE ${tableName}`);
        const columnsData = await columnsResult.getRows();
        const columns = columnsData.map((row: any) => row[0] as string);
        
        console.log(`Table ${tableName}: ${rowCount} rows`);
        
        tableInfo.push({
          name: tableName,
          rowCount,
          columns
        });
        
      } catch (tableError) {
        console.error(`Error querying table ${tableName}:`, tableError);
      }
    }

    // Close connection
    try {
      if (connection && typeof connection.disconnectSync === 'function') {
        connection.disconnectSync();
      } else if (connection && typeof connection.closeSync === 'function') {
        connection.closeSync();
      }
    } catch (closeError) {
      console.error('Error closing connection:', closeError);
    }

    console.log(`Verification complete: ${tableInfo.length} tables`);

    return {
      success: tableInfo.length > 0,
      tables: tableInfo
    };

  } catch (error) {
    console.error('Database verification failed:', error);
    
    return {
      success: false,
      tables: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    // Clean up
    if (localDbPath) {
      await cleanupTempFiles(localDbPath);
    }
  }
}

export async function uploadFileAction(formData: FormData): Promise<UploadResult> {
  try {
    const file = formData.get('file') as File;

    if (!file) {
      return {
        success: false,
        error: 'No file provided'
      };
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Only Excel and CSV files are allowed.'
      };
    }

    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size exceeds 100MB limit'
      };
    }

    // Initialize Supabase client (this will have proper auth context in server action)
    const supabase = await createClient();
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    console.log('Authenticated user:', user.email);

    // Generate unique file ID and filename
    const fileId = uuidv4();
    const uniqueFileName = generateUniqueFileName(file.name);
    
    // Store in the new structure: duckdb/{sha}/original_file.xlsx
    const sha = crypto.createHash('sha256').update(fileId).digest('hex').slice(0, 12);
    const storagePath = `duckdb/${sha}/${uniqueFileName}`;

    let localFilePath: string | null = null;

    try {
      // Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file, { 
          upsert: false,
          contentType: file.type
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return {
          success: false,
          error: 'Failed to upload file to storage: ' + uploadError.message
        };
      }

      // Create duckdb_files record with initial status
      const duckdbRecord = {
        file_id: fileId,
        file_name: uniqueFileName,
        original_name: file.name,
        duckdb_path: `duckdb/${sha}/${sha}.duckdb`,
        metadata_path: `duckdb/${sha}/metadata.json`,
        sha_hash: sha,
        sheets_processed: 0,
        status: 'processing',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: duckdbInsertData, error: duckdbInsertError } = await supabase
        .from('duckdb_files')
        .insert(duckdbRecord)
        .select('*')
        .single();

      if (duckdbInsertError) {
        console.error('DuckDB record insert error:', duckdbInsertError);
        // Clean up uploaded file if duckdb_files insert fails
        await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
        
        return {
          success: false,
          error: 'Failed to create DuckDB file record: ' + duckdbInsertError.message
        };
      }

      // Download file from storage for processing
      localFilePath = await downloadFileFromStorage(supabase, storagePath);

      // Process the Excel file
      const { sha: processedSha, dbFile, metadata, sheetsProcessed } = await processExcelFile(
        localFilePath, 
        fileId
      );

      // Upload processed files to storage
      const dbUploadResult = await uploadToStorage(
        supabase, 
        dbFile, 
        `duckdb/${sha}/${sha}.duckdb`
      );
      
      const metadataPath = path.join(os.tmpdir(), `${sha}.json`);
      const metadataUploadResult = await uploadToStorage(
        supabase, 
        metadataPath, 
        `duckdb/${sha}/metadata.json`
      );

      if (!dbUploadResult.success || !metadataUploadResult.success) {
        throw new Error('Failed to upload processed files to storage');
      }

      // Update file record with completion status and metadata
      const { error: updateError } = await supabase
        .from('duckdb_files')
        .update({
          status: 'completed',
          sheets_processed: sheetsProcessed,
          updated_at: new Date().toISOString()
        })
        .eq('file_id', fileId);

      if (updateError) {
        console.error('Failed to update file status:', updateError);
        throw new Error('Failed to update file status');
      }

      // Verify the uploaded database
      console.log('Starting post-upload verification...');
      const verificationResult = await verifyDatabase(supabase, sha, sheetsProcessed);

      // Clean up temporary files
      await cleanupTempFiles(localFilePath, dbFile, metadataPath);

      return {
        success: true,
        fileId: fileId,
        fileName: file.name,
        message: 'File uploaded and processed successfully',
        processingResult: {
          workbookId: sha,
          sheetsProcessed,
          tables: verificationResult.tables
        }
      };

    } catch (error) {
      console.error('Upload/Processing error:', error);
      
      // Update status to failed if we have a file record
      try {
        await supabase
          .from('duckdb_files')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('file_id', fileId);
      } catch (updateError) {
        console.error('Failed to update status to failed:', updateError);
      }
      
      // Clean up any uploaded file on error
      try {
        await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      } catch (cleanupError) {
        console.error('Failed to clean up file:', cleanupError);
      }

      // Clean up temporary files
      if (localFilePath) {
        await cleanupTempFiles(localFilePath);
      }

      return {
        success: false,
        error: 'Failed to process upload: ' + (error instanceof Error ? error.message : 'Unknown error')
      };
    }

  } catch (error) {
    console.error('Upload action error:', error);
    
    return {
      success: false,
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    };
  }
}