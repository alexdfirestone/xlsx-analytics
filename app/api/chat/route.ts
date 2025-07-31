import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getFileRecord } from '@/app/actions/upload-file/libs/database';
import { handleApiAuthSession } from '@/utils/auth/setAuthSession';
import { downloadFileFromStorage, cleanupTempFiles } from '@/app/actions/upload-file/libs/storage';
import { DuckDBInstance } from '@duckdb/node-api';
import { openai } from '@ai-sdk/openai';
import { streamText, generateObject } from 'ai';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs/promises';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  file_id: string;
}

interface ChatResponse {
  success: boolean;
  error?: string;
  executionTime?: number;
  sqlQuery?: string;
  data?: any[];
  rowCount?: number;
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let localDbPath: string | null = null;
  let duckdbInstance: any = null;
  let connection: any = null;
  let metadata: any = null;
  let body: ChatRequest | null = null;

  try {
    // Parse request body
    body = await request.json();
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    const { messages, file_id } = body;

    if (!messages || !Array.isArray(messages) || !file_id) {
      return NextResponse.json(
        { error: 'Missing required parameters: messages and file_id' },
        { status: 400 }
      );
    }

    // Initialize Supabase client and authenticate
    const supabase = await createClient();
    await handleApiAuthSession(supabase, request);

    // Get file record from database (RLS will handle access control)
    const fileRecord = await getFileRecord(supabase, file_id);
    if (!fileRecord) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    // Check if file is ready for querying
    if (fileRecord.status !== 'completed') {
      return NextResponse.json(
        { error: `File is not ready for querying. Current status: ${fileRecord.status}` },
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
      return NextResponse.json(
        { error: 'Failed to load file metadata' },
        { status: 500 }
      );
    }

    // Define the schema for SQL query generation
    const sqlSchema = z.object({
      query: z.string().describe('A valid SQL SELECT query')
    });

    // Generate SQL query using LLM
    const sqlPrompt = `You are a SQL expert. Based on the following database schema and user conversation, generate a SQL query to answer the user's question.

Database Schema:
${JSON.stringify(metadata.table_schemas, null, 2)}

Available Tables:
${metadata.sheets.map((sheet: any) => `- ${sheet.table} (originally "${sheet.original_name}")`).join('\n')}

User Conversation:
${messages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

IMPORTANT: When referencing tables in your SQL query, you MUST prefix each table name with "source_db." (e.g., "source_db.sheet_sheet1" instead of just "sheet_sheet1").

Generate ONLY a valid SQL SELECT query. Do not include any explanations or markdown formatting. Only use the tables and columns that exist in the schema above.`;

    console.log('Generating SQL query with LLM...');
    const { object: sqlResult } = await generateObject({
      model: openai('gpt-4o'),
      prompt: sqlPrompt,
      schema: sqlSchema,
      temperature: 0.1,
    });

    const cleanSqlQuery = sqlResult.query.trim();
    console.log(`Generated SQL query: ${cleanSqlQuery}`);

    // Validate SQL query (basic security check)
    const normalizedQuery = cleanSqlQuery.trim().toLowerCase();
    if (normalizedQuery.startsWith('delete') || 
        normalizedQuery.startsWith('drop') || 
        normalizedQuery.startsWith('alter') ||
        normalizedQuery.startsWith('create') ||
        normalizedQuery.startsWith('insert') ||
        normalizedQuery.startsWith('update')) {
      return NextResponse.json(
        { error: 'Only SELECT queries are allowed for security reasons' },
        { status: 400 }
      );
    }

    // Download the DuckDB file from storage
    console.log(`Downloading database file: ${fileRecord.duckdb_path}`);
    localDbPath = await downloadFileFromStorage(supabase, fileRecord.duckdb_path);

    // Create in-memory DuckDB instance
    duckdbInstance = await DuckDBInstance.create(':memory:');
    connection = await duckdbInstance.connect();

    // Attach the downloaded database
    await connection.run(`ATTACH '${localDbPath}' AS source_db`);
    console.log('Database attached to memory instance');

    // Execute the SQL query
    console.log(`Executing query: ${cleanSqlQuery}`);
    const result = await connection.run(cleanSqlQuery);
    const rows = await result.getRows();

    const executionTime = Date.now() - startTime;
    console.log(`Query executed successfully in ${executionTime}ms. Returned ${rows.length} rows.`);

    // Generate streaming response using LLM
    const responsePrompt = `You are a helpful data analyst. Based on the SQL query results below, provide a clear and insightful analysis of the data. Be conversational and explain what the data shows in plain language.

SQL Query: ${cleanSqlQuery}
Results: ${rows.length} rows returned

Data:
${JSON.stringify(rows.slice(0, 100), null, 2)} ${rows.length > 100 ? '\n... (showing first 100 rows)' : ''}

IMPORTANT: Respond in plain text only. Do not use any markdown formatting, bullet points, or special characters. Write in a natural, conversational tone as if speaking to a colleague.

Provide a natural language explanation of these results:`;

    console.log('Generating streaming response...');

    const { textStream } = streamText({
      model: openai('gpt-4o'),
      prompt: responsePrompt,
      temperature: 0.7,
    });

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial metadata
          const initialData = {
            type: 'metadata',
            sqlQuery: cleanSqlQuery,
            rowCount: rows.length,
            executionTime
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`));

          // Stream the LLM response
          for await (const textPart of textStream) {
            const chunk = {
              type: 'text',
              content: textPart
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }

          // Send completion signal
          controller.enqueue(encoder.encode(`data: {"type": "done"}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      executionTime
    }, { status: 500 });

  } finally {
    // Clean up resources
    try {
      if (connection) {
        try {
          connection.disconnectSync();
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

// Keep the GET method for schema inspection
export async function GET(request: NextRequest) {
  let metadata: any = null;
  let fileRecord: any = null;
  
  try {
    const { searchParams } = new URL(request.url);
    const file_id = searchParams.get('file_id');

    if (!file_id) {
      return NextResponse.json(
        { error: 'Missing file_id parameter' },
        { status: 400 }
      );
    }

    // Initialize Supabase client and authenticate
    const supabase = await createClient();
    await handleApiAuthSession(supabase, request);

    // Get file record from database (RLS will handle access control)
    fileRecord = await getFileRecord(supabase, file_id);
    if (!fileRecord) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    // Check if file is ready
    if (fileRecord.status !== 'completed') {
      return NextResponse.json(
        { error: `File is not ready. Current status: ${fileRecord.status}` },
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
      metadata = { error: 'Failed to load metadata file' };
    }

    // Download and inspect the database
    let localDbPath: string | null = null;
    let duckdbInstance: any = null;
    let connection: any = null;

    try {
      localDbPath = await downloadFileFromStorage(supabase, fileRecord.duckdb_path);
      
      duckdbInstance = await DuckDBInstance.create(':memory:');
      connection = await duckdbInstance.connect();
      
      await connection.run(`ATTACH '${localDbPath}' AS source_db`);

      // Get list of tables that actually exist in the database
      const tablesResult = await connection.run("SHOW TABLES");
      const tables = await tablesResult.getRows();
      const tableNames = tables.map((row: any) => row[0] as string);

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
            connection.disconnectSync();
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
