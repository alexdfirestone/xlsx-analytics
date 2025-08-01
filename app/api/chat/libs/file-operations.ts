import path from 'node:path';
import fs from 'node:fs/promises';
import { downloadFileFromStorage, cleanupTempFiles } from '@/app/actions/upload-file/libs/storage';
import type { DatabaseMetadata, FileRecord } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logEvent } from './langfuse';

export class FileManager {
  private trace: any = null;

  setTrace(trace: any) {
    this.trace = trace;
  }
  
  async loadMetadata(
    supabase: SupabaseClient<any, "public", any>, 
    fileRecord: FileRecord
  ): Promise<DatabaseMetadata> {
    try {
      if (this.trace) {
        logEvent(this.trace, 'metadata-loading-started', {
          duckdb_path: fileRecord.duckdb_path,
          status: fileRecord.status,
          sheets_processed: fileRecord.sheets_processed,
        });
      }

      const dbDir = path.dirname(fileRecord.duckdb_path);
      const metadataStoragePath = path.join(dbDir, 'metadata.json');
      const localMetadataPath = await downloadFileFromStorage(supabase, metadataStoragePath);
      
      const metadataContent = await fs.readFile(localMetadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent) as DatabaseMetadata;
      
      await cleanupTempFiles(localMetadataPath);
      
      if (this.trace) {
        logEvent(this.trace, 'metadata-loading-completed', {
          metadata_size: metadataContent.length,
          sheets_count: metadata?.sheets?.length || 0,
          has_error: !!metadata.error,
        });
      }

      return metadata;
    } catch (error) {
      if (this.trace) {
        logEvent(this.trace, 'metadata-loading-error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      return { error: 'Failed to load metadata file' };
    }
  }

  async downloadDatabaseFile(
    supabase: SupabaseClient<any, "public", any>, 
    duckdbPath: string
  ): Promise<string> {
    if (this.trace) {
      logEvent(this.trace, 'database-file-download-started', {
        duckdb_path: duckdbPath,
      });
    }

    const localPath = await downloadFileFromStorage(supabase, duckdbPath);
    
    if (this.trace) {
      logEvent(this.trace, 'database-file-download-completed', {
        duckdb_path: duckdbPath,
        local_path: localPath,
      });
    }

    return localPath;
  }

  async cleanup(localDbPath: string | null): Promise<void> {
    if (localDbPath) {
      try {
        await cleanupTempFiles(localDbPath);
        
        if (this.trace) {
          logEvent(this.trace, 'file-cleanup-completed', {
            local_db_path: localDbPath,
          });
        }
      } catch (cleanupError) {
        if (this.trace) {
          logEvent(this.trace, 'file-cleanup-error', {
            local_db_path: localDbPath,
            error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
          });
        }
      }
    }
  }
} 