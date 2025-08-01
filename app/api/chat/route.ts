import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getFileRecord } from '@/app/actions/upload-file/libs/database';
import { handleApiAuthSession } from '@/utils/auth/setAuthSession';

import { DatabaseManager, validateSqlQuery } from './libs/database';
import { LLMService } from './libs/llm';
import { FileManager } from './libs/file-operations';
import { createChatTrace, langfuse, createSpan, logEvent } from './libs/langfuse';
import type { ChatRequest, FileRecord } from './libs/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // Create main trace for the entire chat session
  const trace = createChatTrace();
  
  const dbManager = new DatabaseManager();
  const llmService = new LLMService(trace);
  const fileManager = new FileManager();
  
  // Set trace for database and file managers
  dbManager.setTrace(trace);
  fileManager.setTrace(trace);
  
  let localDbPath: string | null = null;
  let userId: string | null = null;

  try {
    // 1. Parse and validate request
    const body: ChatRequest = await request.json();
    if (!body?.messages || !Array.isArray(body.messages) || !body.file_id) {
      logEvent(trace, 'request-validation-failed', {
        error: 'Missing required parameters',
        has_messages: !!body?.messages,
        has_file_id: !!body?.file_id,
      });
      return NextResponse.json(
        { error: 'Missing required parameters: messages and file_id' },
        { status: 400 }
      );
    }

    // Update trace with file ID
    trace.update({
      metadata: {
        fileId: body.file_id,
        messagesCount: body.messages.length,
      }
    });

    logEvent(trace, 'request-received', {
      file_id: body.file_id,
      messages_count: body.messages.length,
      last_user_message: body.messages[body.messages.length - 1]?.content?.slice(0, 100),
    });

    // 2. Authenticate user
    const authSpan = createSpan(trace, 'authentication');
    const supabase = await createClient();
    await handleApiAuthSession(supabase, request);
    
    // Try to get user info for better tracking
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
      if (userId) {
        trace.update({ userId });
      }
    } catch {
      // User info not available, continue without it
    }
    
    logEvent(trace, 'authentication-success', { userId: userId || 'anonymous' });
    authSpan.end();

    // 3. Get file record and verify access
    const fileSpan = createSpan(trace, 'file-access', { file_id: body.file_id });
    const fileRecord = await getFileRecord(supabase, body.file_id) as FileRecord;
    if (!fileRecord) {
      logEvent(trace, 'file-access-denied', { file_id: body.file_id });
      fileSpan.end();
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    if (fileRecord.status !== 'completed') {
      logEvent(trace, 'file-not-ready', { 
        file_id: body.file_id, 
        status: fileRecord.status 
      });
      fileSpan.end();
      return NextResponse.json(
        { error: `File is not ready for querying. Current status: ${fileRecord.status}` },
        { status: 400 }
      );
    }

    logEvent(trace, 'file-access-success', {
      file_id: body.file_id,
      status: fileRecord.status,
      sheets_processed: fileRecord.sheets_processed,
    });
    fileSpan.end();

    // 4. Load metadata and setup database
    const setupSpan = createSpan(trace, 'database-setup');
    const metadata = await fileManager.loadMetadata(supabase, fileRecord);
    localDbPath = await fileManager.downloadDatabaseFile(supabase, fileRecord.duckdb_path);
    await dbManager.initialize(localDbPath);
    
    logEvent(trace, 'database-setup-success', {
      has_metadata: !metadata.error,
      tables_available: metadata?.sheets?.length || 0,
    });
    setupSpan.end();

    // 5. Generate and validate SQL query
    const sqlQuery = await llmService.generateSqlQuery(body.messages, metadata);
    validateSqlQuery(sqlQuery);

    // 6. Execute query and get results
    const querySpan = createSpan(trace, 'sql-execution', { sql_query: sqlQuery });
    const queryStartTime = Date.now();
    const rows = await dbManager.executeQuery(sqlQuery);
    const queryExecutionTime = Date.now() - queryStartTime;
    
    logEvent(trace, 'sql-execution-success', {
      sql_query: sqlQuery,
      execution_time_ms: queryExecutionTime,
      rows_returned: rows.length,
    });
    querySpan.end();

    const executionTime = Date.now() - startTime;
    
    // Log successful query execution
    logEvent(trace, 'query-execution-completed', {
      total_execution_time_ms: executionTime,
      sql_query: sqlQuery,
      rows_returned: rows.length,
      query_execution_time_ms: queryExecutionTime,
    });

    // 7. Create streaming response
    const stream = await llmService.createResponseStream(sqlQuery, rows, executionTime);

    // Log successful completion
    logEvent(trace, 'chat-session-success', {
      total_time_ms: executionTime,
      sql_query: sqlQuery,
      rows_returned: rows.length,
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
    
    // Log error to Langfuse
    logEvent(trace, 'chat-session-error', {
      error: errorMessage,
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      total_time_ms: executionTime,
      user_id: userId || 'anonymous',
    });
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      executionTime
    }, { status: 500 });

  } finally {
    // Clean up all resources
    dbManager.cleanup();
    await fileManager.cleanup(localDbPath);
    
    // Ensure Langfuse trace is properly closed
    try {
      await langfuse.shutdownAsync();
    } catch (langfuseError) {
      console.warn('Langfuse shutdown error:', langfuseError);
    }
  }
}

export async function GET(request: NextRequest) {
  const dbManager = new DatabaseManager();
  const fileManager = new FileManager();
  let localDbPath: string | null = null;
  
  try {
    // 1. Parse and validate request
    const { searchParams } = new URL(request.url);
    const file_id = searchParams.get('file_id');

    if (!file_id) {
      return NextResponse.json(
        { error: 'Missing file_id parameter' },
        { status: 400 }
      );
    }

    // 2. Authenticate user
    const supabase = await createClient();
    await handleApiAuthSession(supabase, request);

    // 3. Get file record and verify access
    const fileRecord = await getFileRecord(supabase, file_id) as FileRecord;
    if (!fileRecord) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    if (fileRecord.status !== 'completed') {
      return NextResponse.json(
        { error: `File is not ready. Current status: ${fileRecord.status}` },
        { status: 400 }
      );
    }

    // 4. Load metadata and setup database
    const metadata = await fileManager.loadMetadata(supabase, fileRecord);
    localDbPath = await fileManager.downloadDatabaseFile(supabase, fileRecord.duckdb_path);
    await dbManager.initialize(localDbPath);

    // 5. Get database schema information
    const { tables, schemas } = await dbManager.getTableInfo();

    return NextResponse.json({
      success: true,
      file_id: file_id,
      tables,
      schemas,
      sheets_processed: fileRecord.sheets_processed,
      metadata
    });

  } catch (error) {
    console.error('Schema inspection error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    // Clean up all resources
    dbManager.cleanup();
    await fileManager.cleanup(localDbPath);
  }
}
