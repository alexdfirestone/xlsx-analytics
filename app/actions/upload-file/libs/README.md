# Excel Processing Utilities

This module provides a clean, modular approach to processing Excel files and converting them to DuckDB databases for analysis.

## Structure

```
utils/excel/
├── index.ts          # Main exports
├── types.ts          # TypeScript interfaces
├── storage.ts        # Storage operations (upload/download)
├── database.ts       # Database operations
├── schema.ts         # Schema generation and column sanitization
├── processor.ts      # Main Excel processing logic
└── README.md         # This file
```

## Features

- **Modular Design**: Each utility has a single responsibility
- **Type Safety**: Full TypeScript support with proper interfaces
- **Error Handling**: Comprehensive error handling throughout
- **Storage Integration**: Seamless Supabase storage integration
- **Schema Generation**: AI-powered table schema descriptions
- **Column Sanitization**: Safe column name conversion for databases

## Usage

### Basic Excel Processing

```typescript
import { processExcelFile } from '@/utils/excel';

const result = await processExcelFile(
  '/path/to/excel/file.xlsx',
  'file-id-123',
  'tenant-id-456'
);

console.log('Processed:', result.sheetsProcessed, 'sheets');
console.log('Database file:', result.dbFile);
```

### File Status Management

```typescript
import { getFileRecord, updateFileStatus } from '@/utils/excel';

// Get file status
const fileRecord = await getFileRecord(supabase, fileId);

// Update status
await updateFileStatus(supabase, fileId, 'processing');
await updateFileStatus(supabase, fileId, 'completed', metadata);
```

### Storage Operations

```typescript
import { uploadToStorage, downloadFileFromStorage } from '@/utils/excel';

// Download file from storage
const localPath = await downloadFileFromStorage(supabase, 'remote/path/file.xlsx');

// Upload processed file
const result = await uploadToStorage(supabase, '/tmp/processed.db', 'remote/path/processed.db');
```

## API Endpoint

The main API endpoint is located at `/api/data/ingest` and supports:

- **POST**: Process Excel files
- **GET**: Check processing status

### POST Request

```typescript
{
  fileId: string;
  userId?: string;
  tenantId?: string;
}
```

### Response

```typescript
{
  success: true;
  message: string;
  data: {
    fileId: string;
    workbookId: string;
    tenantId: string;
    sheetsProcessed: number;
    tableSchemas: Record<string, string>;
  }
}
```

## Dependencies

- `@duckdb/node-api`: DuckDB database operations
- `xlsx`: Excel file parsing
- `slugify`: Column name sanitization
- `openai`: AI-powered schema generation

## Environment Variables

- `OPENAI_API_KEY`: Required for schema generation
- Supabase environment variables (configured in your app)

## Error Handling

All utilities include comprehensive error handling:

- File not found errors
- Processing errors with detailed messages
- Storage upload/download failures
- Database operation failures

## Cleanup

Temporary files are automatically cleaned up after processing, but you can also manually clean up:

```typescript
import { cleanupTempFiles } from '@/utils/excel';

await cleanupTempFiles('/tmp/file1.db', '/tmp/file2.json');
``` 