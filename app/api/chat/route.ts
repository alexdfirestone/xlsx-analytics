import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getFileRecord } from '@/app/actions/upload-file/libs/database';
import { handleApiAuthSession } from '@/utils/auth/setAuthSession';
import { downloadFileFromStorage, cleanupTempFiles } from '@/app/actions/upload-file/libs/storage';
import { DuckDBInstance } from '@duckdb/node-api';
import path from 'node:path';
import fs from 'node:fs/promises';

interface QueryRequest {
  query: string;
  file_id: string;
}

interface QueryResponse {
  success: boolean;
  data?: any[];
  columns?: string[];
  rowCount?: number;
  error?: string;
  executionTime?: number;
  metadata?: any;
}

// Helper function to analyze data types from sample data
function analyzeDataTypes(sampleData: any[]): { [columnIndex: number]: string } {
  const dataTypes: { [columnIndex: number]: string } = {};
  
  if (sampleData.length === 0) return dataTypes;
  
  const numColumns = sampleData[0].length;
  
  for (let colIndex = 0; colIndex < numColumns; colIndex++) {
    const values = sampleData.map(row => row[colIndex]).filter(val => val !== null && val !== undefined);
    
    if (values.length === 0) {
      dataTypes[colIndex] = 'unknown';
      continue;
    }
    
    // Check if all values are numbers (including decimals)
    const allNumbers = values.every(val => {
      const num = parseFloat(val);
      return !isNaN(num);
    });
    
    if (allNumbers) {
      // Check if any have decimals
      const hasDecimals = values.some(val => {
        const num = parseFloat(val);
        return num % 1 !== 0;
      });
      
      dataTypes[colIndex] = hasDecimals ? 'decimal' : 'integer';
    } else {
      dataTypes[colIndex] = 'text';
    }
  }
  
  return dataTypes;
}

// Helper function to detect if a column is VARCHAR but contains numeric data
function detectVarcharNumericColumns(sampleData: any[], columnNames: string[]): string[] {
  const varcharNumericColumns: string[] = [];
  
  if (sampleData.length === 0) return varcharNumericColumns;
  
  for (let colIndex = 0; colIndex < sampleData[0].length; colIndex++) {
    const values = sampleData.map(row => row[colIndex]).filter(val => val !== null && val !== undefined);
    
    if (values.length === 0) continue;
    
    // Check if all values are numbers (including decimals)
    const allNumbers = values.every(val => {
      const num = parseFloat(val);
      return !isNaN(num);
    });
    
    if (allNumbers && columnNames[colIndex]) {
      varcharNumericColumns.push(columnNames[colIndex]);
    }
  }
  
  return varcharNumericColumns;
}

// Function to discover table schemas from DuckDB database
async function discoverTableSchemas(dbPath: string): Promise<string> {
  try {
    const instance = await DuckDBInstance.create(dbPath);
    const connection = await instance.connect();
    
    // Get all tables
    const tablesResult = await connection.run("SHOW TABLES");
    const tables = await tablesResult.getRows();
    
    if (tables.length === 0) {
      return 'No tables found in database';
    }
    
    // Start with available tables list
    const tableNames = tables.map((row: any) => row[0]);
    let schema = `Available tables in the database:\n${tableNames.join(', ')}\n\n`;
    
    const schemas: string[] = [];
    
    for (const tableRow of tables) {
      const tableName = tableRow[0];
      
      // Get table schema
      const schemaResult = await connection.run(`DESCRIBE ${tableName}`);
      const columns = await schemaResult.getRows();
      
      // Get sample data for better understanding
      const sampleResult = await connection.run(`
        SELECT * FROM ${tableName} 
        WHERE (${columns.map(col => `${col[0]} IS NOT NULL AND ${col[0]} != ''`).join(' OR ')})
        LIMIT 3
      `);
      const sampleData = await sampleResult.getRows();
      
      let tableSchema = `Table: ${tableName}\nColumns:`;
      
      for (const column of columns) {
        const columnName = column[0];
        const dataType = column[1];
        tableSchema += `\n- ${columnName} (${dataType})`;
      }
      
      // Add sample data for context, only if non-empty data exists
      if (sampleData.length > 0) {
        // Convert BigInt values to strings for better readability
        const safeSampleData = sampleData.map(row => 
          row.map(cell => typeof cell === 'bigint' ? cell.toString() : cell)
        );
        
        // Analyze data types from sample data
        const dataTypes = analyzeDataTypes(safeSampleData);
        
        tableSchema += `\n\nSample data (first 3 rows):\n${JSON.stringify(safeSampleData, null, 2)}`;
        
        // Add data type analysis
        if (Object.keys(dataTypes).length > 0) {
          tableSchema += `\n\nData type analysis from sample:`;
          for (let i = 0; i < columns.length; i++) {
            const columnName = columns[i][0];
            const dataType = dataTypes[i] || 'unknown';
            tableSchema += `\n- Column ${i}: ${columnName} appears to be ${dataType}`;
          }
          
          // Detect VARCHAR columns that contain numeric data
          const columnNames = columns.map(col => String(col[0]));
          const varcharNumericCols = detectVarcharNumericColumns(safeSampleData, columnNames);
          if (varcharNumericCols.length > 0) {
            tableSchema += `\n\n⚠️ IMPORTANT: These VARCHAR columns contain numeric data and need casting for comparisons:`;
            varcharNumericCols.forEach(col => {
              tableSchema += `\n- ${col}: Use CAST(${col} AS DOUBLE) for numeric comparisons`;
            });
          }
        }
      }
      
      schemas.push(tableSchema);
    }
    
    return schema + schemas.join('\n\n');
  } catch (error) {
    console.error('Error discovering table schemas:', error);
    return 'Error discovering table schemas';
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let localDbPath: string | null = null;
  let duckdbInstance: any = null;
  let connection: any = null;
  let metadata: any = null;
  let body: QueryRequest | null = null;

  try {
    // Parse request body ONCE
    body = await request.json();
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid request body', metadata },
        { status: 400 }
      );
    }
    const { query, file_id } = body;

    if (!query || !file_id) {
      return NextResponse.json(
        { error: 'Missing required parameters: query and file_id', metadata },
        { status: 400 }
      );
    }

    // Validate SQL query (basic security check)
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.startsWith('delete') || 
        normalizedQuery.startsWith('drop') || 
        normalizedQuery.startsWith('alter') ||
        normalizedQuery.startsWith('create') ||
        normalizedQuery.startsWith('insert') ||
        normalizedQuery.startsWith('update')) {
      return NextResponse.json(
        { error: 'Only SELECT queries are allowed for security reasons', metadata },
        { status: 400 }
      );
    }

    // Initialize Supabase client and authenticate
    const supabase = await createClient();
    await handleApiAuthSession(supabase, request);

    // Get file record from database (RLS will handle tenant access control)
    const fileRecord = await getFileRecord(supabase, file_id);
    if (!fileRecord) {
      return NextResponse.json(
        { error: 'File not found or access denied', metadata },
        { status: 404 }
      );
    }

    // Check if file is ready for querying
    if (fileRecord.status !== 'completed') {
      return NextResponse.json(
        { error: `File is not ready for querying. Current status: ${fileRecord.status}`, metadata },
        { status: 400 }
      );
    }

    // Download and parse metadata file
    try {
      const dbDir = path.dirname(fileRecord.duckdb_path);
      const metadataStoragePath = path.join(dbDir, 'metadata.json');
      const localMetadataPath = await downloadFileFromStorage(supabase, metadataStoragePath);
      const metadataContent = await fs.readFile(localMetadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);
      await cleanupTempFiles(localMetadataPath);
    } catch (metadataError) {
      console.warn('Failed to load metadata:', metadataError);
      metadata = { error: 'Failed to load metadata file' };
    }

    // Download the DuckDB file from storage
    console.log(`Downloading database file: ${fileRecord.duckdb_path}`);
    localDbPath = await downloadFileFromStorage(supabase, fileRecord.duckdb_path);

    // Discover table schemas from the database
    console.log('Discovering table schemas from database...');
    const tableSchemas = await discoverTableSchemas(localDbPath);
    console.log('Table schemas discovery completed');

    // Create in-memory DuckDB instance
    duckdbInstance = await DuckDBInstance.create(':memory:');
    connection = await duckdbInstance.connect();

    // Attach the downloaded database
    await connection.run(`ATTACH '${localDbPath}' AS source_db`);
    console.log('Database attached to memory instance');

    // Execute the query
    console.log(`Executing query: ${query}`);
    const result = await connection.run(query);
    const rows = await result.getRows();

    const executionTime = Date.now() - startTime;

    const response: QueryResponse = {
      success: true,
      data: rows,
      rowCount: rows.length,
      executionTime,
      metadata
    };

    console.log(`Query executed successfully in ${executionTime}ms. Returned ${rows.length} rows.`);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Query execution error:', error);
    
    const executionTime = Date.now() - startTime;
    
    // Check if this is a SQL error (should return 200) vs server error (should return 500)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const isSqlError = errorMessage.toLowerCase().includes('syntax') || 
                      errorMessage.toLowerCase().includes('no such table') ||
                      errorMessage.toLowerCase().includes('column') ||
                      errorMessage.toLowerCase().includes('table') ||
                      errorMessage.toLowerCase().includes('duckdb');
    
    const response: QueryResponse = {
      success: false,
      error: errorMessage,
      executionTime,
      metadata
    };

    return NextResponse.json(response, { status: isSqlError ? 200 : 500 });
  } finally {
    // Clean up resources
    try {
      if (connection) {
        try {
          connection.disconnectSync(); // or connection.closeSync();
        } catch (closeError) {
          console.warn('Connection close error:', closeError);
        }
      }
      if (duckdbInstance) {
        try {
          // duckdbInstance.close(); // No documented close method
        } catch (closeError) {
          console.warn('DuckDB instance close error:', closeError);
        }
      }
      if (localDbPath) {
        await cleanupTempFiles(localDbPath);
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
}

// Optional: Add a GET method to get available tables for a file
export async function GET(request: NextRequest) {
  let metadata: any = null;
  let fileRecord: any = null;
  try {
    const { searchParams } = new URL(request.url);
    const file_id = searchParams.get('file_id');

    if (file_id) {
      const supabase = await createClient();
      fileRecord = await getFileRecord(supabase, file_id);
      if (fileRecord && fileRecord.duckdb_path) {
        try {
          const dbDir = path.dirname(fileRecord.duckdb_path);
          const metadataStoragePath = path.join(dbDir, 'metadata.json');
          const localMetadataPath = await downloadFileFromStorage(supabase, metadataStoragePath);
          const metadataContent = await fs.readFile(localMetadataPath, 'utf-8');
          metadata = JSON.parse(metadataContent);
          await cleanupTempFiles(localMetadataPath);
        } catch (metadataError) {
          metadata = { error: 'Failed to load metadata file' };
        }
      }
    }
  } catch (e) {
    // ignore, metadata will be null
  }

  try {
    const { searchParams } = new URL(request.url);
    const file_id = searchParams.get('file_id');

    if (!file_id) {
      return NextResponse.json(
        { error: 'Missing file_id parameter', metadata },
        { status: 400 }
      );
    }

    // Initialize Supabase client and authenticate
    const supabase = await createClient();
    await handleApiAuthSession(supabase, request);

    // Get file record from database (RLS will handle tenant access control)
    fileRecord = fileRecord || await getFileRecord(supabase, file_id);
    if (!fileRecord) {
      return NextResponse.json(
        { error: 'File not found or access denied', metadata },
        { status: 404 }
      );
    }

    // Check if file is ready
    if (fileRecord.status !== 'completed') {
      return NextResponse.json(
        { error: `File is not ready. Current status: ${fileRecord.status}`, metadata },
        { status: 400 }
      );
    }

    // Download and inspect the database
    let localDbPath: string | null = null;
    let duckdbInstance: any = null;
    let connection: any = null;

    try {
      localDbPath = await downloadFileFromStorage(supabase, fileRecord.duckdb_path);
      
      // Discover table schemas from the database
      console.log('Discovering table schemas from database...');
      const tableSchemas = await discoverTableSchemas(localDbPath);
      console.log('Table schemas discovery completed');
      
      duckdbInstance = await DuckDBInstance.create(':memory:');
      connection = await duckdbInstance.connect();
      
      await connection.run(`ATTACH '${localDbPath}' AS source_db`);

      // Get list of tables that actually exist in the database
      const tablesResult = await connection.run("SHOW TABLES");
      const tables = await tablesResult.getRows();
      const tableNames = tables.map((row: any) => row[0] as string);
      
      console.log('Available tables in database:', tableNames);

      // Get schema information for each table
      const schemas: Record<string, any[]> = {};
      for (const tableName of tableNames) {
        const schemaResult = await connection.run(`DESCRIBE ${tableName}`);
        const columns = await schemaResult.getRows();
        schemas[tableName] = columns.map((row: any) => ({
          name: row[0] as string,
          type: row[1] as string
        }));
      }

      return NextResponse.json({
        success: true,
        file_id: file_id,
        tables: tableNames,
        schemas: schemas,
        sheets_processed: fileRecord.sheets_processed,
        metadata: metadata
      });

    } finally {
      // Clean up resources
      try {
        if (connection) {
          try {
            connection.disconnectSync(); // or connection.closeSync();
          } catch (closeError) {
            console.warn('Connection close error:', closeError);
          }
        }
        if (duckdbInstance) {
          try {
            // duckdbInstance.close(); // No documented close method
          } catch (closeError) {
            console.warn('DuckDB instance close error:', closeError);
          }
        }
        if (localDbPath) {
          await cleanupTempFiles(localDbPath);
        }
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

  } catch (error) {
    console.error('Schema inspection error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        metadata
      },
      { status: 500 }
    );
  }
}
