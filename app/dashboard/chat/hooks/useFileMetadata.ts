import { useState } from 'react';

interface FileMetadata {
  workbook_id: string;
  file_id: string;
  sheets: Array<{
    table: string;
    original_name: string;
  }>;
  table_schemas: Record<string, string>;
}

interface UseFileMetadataReturn {
  metadata: FileMetadata | null;
  loading: boolean;
  error: string | null;
  fetchMetadata: (fileId: string) => Promise<void>;
}

export function useFileMetadata(): UseFileMetadataReturn {
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetadata = async (fileId: string) => {
    if (!fileId) {
      setError('No file ID provided');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/chat?file_id=${fileId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.metadata) {
        setMetadata(data.metadata);
      } else {
        throw new Error('Failed to fetch metadata');
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch file metadata');
      setMetadata(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    metadata,
    loading,
    error,
    fetchMetadata,
  };
} 