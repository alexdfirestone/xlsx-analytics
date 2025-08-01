import { z } from 'zod';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  file_id: string;
}

export interface DuckDBConnection {
  run: (sql: string) => Promise<{ getRows: () => Promise<unknown[][]> }>;
  disconnectSync?: () => void;
  closeSync?: () => void;
}

export interface FileRecord {
  status: string;
  duckdb_path: string;
  sheets_processed: number;
}

export interface StreamChunk {
  type: 'metadata' | 'text' | 'done';
  content?: string;
  sqlQuery?: string;
  rowCount?: number;
  executionTime?: number;
}

export interface DatabaseMetadata {
  table_schemas?: Record<string, unknown>;
  sheets?: Array<{table: string; original_name: string}>;
  error?: string;
}

// Validation schemas
export const sqlQuerySchema = z.object({
  query: z.string().describe('A valid SQL SELECT query')
});

export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string()
  })),
  file_id: z.string()
}); 