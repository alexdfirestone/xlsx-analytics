export interface IngestRequest {
  file_id: string;
}

export interface DuckDBFileRecord {
  file_id: string;
  file_name: string;
  original_name: string;
  duckdb_path: string;
  metadata_path: string;
  sha_hash: string;
  sheets_processed: number;
  status: 'created' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface ProcessedExcelResult {
  sha: string;
  dbFile: string;
  metadata: ExcelMetadata;
  sheetsProcessed: number;
  tableColumnMappings: Record<string, string[]>;
}

export interface ExcelMetadata {
  workbook_id: string;
  file_id: string;
  sheets: SheetInfo[];
  table_schemas: Record<string, string>;
}

export interface SheetInfo {
  table: string;
  original_name: string;
}

export interface TableSchema {
  tableName: string;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  description: string;
}

export interface StorageUploadResult {
  success: boolean;
  path: string;
  error?: string;
}

export interface FileStatusUpdate {
  status: string;
  metadata?: Record<string, any>;
} 