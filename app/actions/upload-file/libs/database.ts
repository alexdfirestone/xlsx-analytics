import { SupabaseClient } from '@supabase/supabase-js';
import { DuckDBFileRecord, FileStatusUpdate } from './types';

/**
 * Get a file record from the duckdb_files table
 */
export async function getFileRecord(
  supabase: SupabaseClient,
  fileId: string
): Promise<DuckDBFileRecord | null> {
  const { data, error } = await supabase
    .from('duckdb_files')
    .select('*')
    .eq('file_id', fileId)
    .single();
    
  if (error) {
    console.error('Error fetching file record:', error);
    return null;
  }
  
  return data as DuckDBFileRecord;
}

/**
 * Update file status in the duckdb_files table
 */
export async function updateFileStatus(
  supabase: SupabaseClient,
  fileId: string,
  status: string,
  metadata?: Record<string, any>
): Promise<void> {
  const updateData: any = { 
    status, 
    updated_at: new Date().toISOString() 
  };
  
  if (metadata) {
    // Update specific fields based on the metadata
    if (metadata.workbook_id) updateData.sha_hash = metadata.workbook_id;
    if (metadata.sheets_processed !== undefined) updateData.sheets_processed = metadata.sheets_processed;
    if (metadata.duckdb_path) updateData.duckdb_path = metadata.duckdb_path;
    if (metadata.metadata_path) updateData.metadata_path = metadata.metadata_path;
  }

  const { error } = await supabase
    .from('duckdb_files')
    .update(updateData)
    .eq('file_id', fileId);
    
  if (error) {
    throw new Error(`Failed to update file status: ${error.message}`);
  }
}

/**
 * Get tenant ID from the database
 */
export async function getTenantID(supabase: SupabaseClient): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .single();
    
    if (error) {
      console.error('Error fetching tenant ID:', error);
      throw new Error(`Error fetching tenant ID: ${error.message}`);
    }
    
    return data.id;
  } catch (err) {
    console.error('Unexpected error:', err);
    throw new Error('An unexpected error occurred while fetching the tenant ID.');
  }
} 