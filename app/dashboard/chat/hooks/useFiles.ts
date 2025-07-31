import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

interface DuckDbFile {
  file_id: string;
  file_name: string;
  original_name: string;
  duckdb_path: string;
  metadata_path: string;
  sha_hash: string;
  sheets_processed: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface UseFilesReturn {
  files: DuckDbFile[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFiles(): UseFilesReturn {
  const [files, setFiles] = useState<DuckDbFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const supabase = createClient();
      
      const { data, error: fetchError } = await supabase
        .from('duckdb_files')
        .select(`
          file_id,
          file_name,
          original_name,
          duckdb_path,
          metadata_path,
          sha_hash,
          sheets_processed,
          status,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setFiles(data || []);
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  return {
    files,
    loading,
    error,
    refetch: fetchFiles,
  };
} 