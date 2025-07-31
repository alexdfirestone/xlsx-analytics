import { SupabaseClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { StorageUploadResult } from './types';

const BUCKET_NAME = 'uploads';

/**
 * Upload a file to Supabase storage
 */
export async function uploadToStorage(
  supabase: SupabaseClient,
  localPath: string,
  remotePath: string
): Promise<StorageUploadResult> {
  try {
    const data = await fs.readFile(localPath);
    console.log(`📤 Uploading file: ${localPath} (${data.length} bytes) -> ${remotePath}`);
    
    // For DuckDB files, try using a different approach to preserve binary integrity
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(remotePath, data, { 
        upsert: true,
        contentType: 'application/octet-stream' // Force binary content type
      });
    
    if (error) {
      console.error('Upload error:', error);
      return { success: false, path: remotePath, error: error.message };
    }
    
    console.log(`✓ Uploaded ${remotePath}`);
    return { success: true, path: remotePath };
  } catch (error) {
    console.error('Upload failed:', error);
    return { 
      success: false, 
      path: remotePath, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Download a file from Supabase storage to local temp directory
 */
export async function downloadFileFromStorage(
  supabase: SupabaseClient,
  filePath: string
): Promise<string> {
  console.log(`Attempting to download file from storage: ${filePath}`);
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(filePath);
    
  if (error) {
    console.error('Storage download error:', error);
    const errorMessage = error.message || JSON.stringify(error) || 'Unknown storage error';
    throw new Error(`Failed to download file: ${errorMessage}`);
  }
  
  if (!data) {
    throw new Error(`No data received for file: ${filePath}`);
  }
  
  try {
    // Use os.tmpdir() for better compatibility with different environments
    const tmpDir = os.tmpdir();
    const tempPath = path.join(tmpDir, `${Date.now()}_${path.basename(filePath)}`);
    
    console.log(`Saving file to temporary path: ${tempPath}`);
    
    const buffer = Buffer.from(await data.arrayBuffer());
    await fs.writeFile(tempPath, buffer);
    
    // Check file size after download
    const downloadedStats = await fs.stat(tempPath);
    console.log(`📥 Downloaded file size: ${downloadedStats.size} bytes`);
    
    console.log(`✓ Downloaded file to: ${tempPath}`);
    return tempPath;
  } catch (fileError) {
    console.error('File system error:', fileError);
    throw new Error(`Failed to save temporary file: ${fileError instanceof Error ? fileError.message : 'Unknown file system error'}`);
  }
}

/**
 * Clean up temporary files
 */
export async function cleanupTempFiles(...filePaths: string[]): Promise<void> {
  const cleanupPromises = filePaths.map(async (filePath) => {
    try {
      await fs.unlink(filePath);
      console.log(`✓ Cleaned up: ${filePath}`);
    } catch (error) {
      console.warn(`Failed to clean up ${filePath}:`, error);
    }
  });
  
  await Promise.all(cleanupPromises);
} 