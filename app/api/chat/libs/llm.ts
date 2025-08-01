import { streamText, generateObject } from 'ai';
import type { ChatMessage, DatabaseMetadata, StreamChunk } from './types';
import { sqlQuerySchema } from './types';
import { openai, langfuse, createSpan, logEvent } from './langfuse';

// Model Configuration - Easy to see and change models for each step
const MODEL_CONFIG = {
  sqlGeneration: {
    model: 'gpt-4o',
    temperature: 0.1,
  },
  responseGeneration: {
    model: 'gpt-4.1',
    temperature: 0.7,
  },
} as const;

export class LLMService {
  private trace: any;

  constructor(trace?: any) {
    this.trace = trace;
  }
  
  async generateSqlQuery(
    messages: ChatMessage[], 
    metadata: DatabaseMetadata
  ): Promise<string> {
    const sqlPrompt = this.buildSqlPrompt(messages, metadata);
    
    // Create span for SQL generation
    const sqlSpan = this.trace ? createSpan(this.trace, 'sql-generation', {
      model: MODEL_CONFIG.sqlGeneration.model,
      temperature: MODEL_CONFIG.sqlGeneration.temperature,
      prompt_length: sqlPrompt.length,
      tables_count: metadata?.sheets?.length || 0,
    }) : null;

    try {
      // Log SQL generation start
      if (this.trace) {
        logEvent(this.trace, 'sql-generation-started', {
          model: MODEL_CONFIG.sqlGeneration.model,
          temperature: MODEL_CONFIG.sqlGeneration.temperature,
          prompt_length: sqlPrompt.length,
          messages_count: messages.length,
          tables_available: metadata?.sheets?.length || 0,
        });
      }
      
      // Log input to Langfuse
      if (sqlSpan) {
        logEvent(this.trace, 'sql-generation-start', {
          messages_count: messages.length,
          last_user_message: messages[messages.length - 1]?.content?.slice(0, 100),
          available_tables: metadata?.sheets?.map(s => s.table) || [],
        });
      }

      const startTime = Date.now();
      const { object: sqlResult } = await generateObject({
        model: openai(MODEL_CONFIG.sqlGeneration.model),
        prompt: sqlPrompt,
        schema: sqlQuerySchema,
        temperature: MODEL_CONFIG.sqlGeneration.temperature,
      });
      const duration = Date.now() - startTime;

      const cleanSqlQuery = sqlResult.query.trim();
      
      // Log successful SQL generation
      if (this.trace) {
        logEvent(this.trace, 'sql-query-generated', {
          sql_query: cleanSqlQuery,
          generation_time_ms: duration,
          query_length: cleanSqlQuery.length,
          model: MODEL_CONFIG.sqlGeneration.model,
        });
      }
      
      // Log successful generation to Langfuse
      if (sqlSpan) {
        sqlSpan.generation({
          name: 'sql-query-generation',
          model: MODEL_CONFIG.sqlGeneration.model,
          input: {
            prompt: sqlPrompt,
            messages: messages,
            metadata: metadata
          },
          output: {
            sql_query: cleanSqlQuery,
          },
          usage: {
            total_tokens: Math.ceil(sqlPrompt.length / 4), // Rough estimate
          },
          metadata: {
            duration_ms: duration,
            temperature: MODEL_CONFIG.sqlGeneration.temperature,
          }
        });

        logEvent(this.trace, 'sql-generation-success', {
          sql_query: cleanSqlQuery,
          duration_ms: duration,
          query_length: cleanSqlQuery.length,
        });

        sqlSpan.end();
      }
      
      return cleanSqlQuery;
    } catch (error) {
      // Log error to Langfuse
      if (sqlSpan) {
        logEvent(this.trace, 'sql-generation-error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        sqlSpan.end();
      }
      throw error;
    }
  }

  async createResponseStream(
    sqlQuery: string, 
    rows: unknown[][], 
    executionTime: number
  ): Promise<ReadableStream> {
    const responsePrompt = this.buildResponsePrompt(sqlQuery, rows);
    
    // Create span for response generation
    const responseSpan = this.trace ? createSpan(this.trace, 'response-generation', {
      model: MODEL_CONFIG.responseGeneration.model,
      temperature: MODEL_CONFIG.responseGeneration.temperature,
      sql_query: sqlQuery,
      row_count: rows.length,
      query_execution_time: executionTime,
    }) : null;

    // Log start of response generation
    if (responseSpan) {
      logEvent(this.trace, 'response-generation-start', {
        sql_query: sqlQuery,
        row_count: rows.length,
        execution_time_ms: executionTime,
        prompt_length: responsePrompt.length,
      });
    }

    // Log streaming response start
    if (this.trace) {
      logEvent(this.trace, 'response-streaming-started', {
        model: MODEL_CONFIG.responseGeneration.model,
        temperature: MODEL_CONFIG.responseGeneration.temperature,
        sql_query: sqlQuery,
        row_count: rows.length,
        prompt_length: responsePrompt.length,
      });
    }

    const streamStartTime = Date.now();
    const { textStream } = streamText({
      model: openai(MODEL_CONFIG.responseGeneration.model),
      prompt: responsePrompt,
      temperature: MODEL_CONFIG.responseGeneration.temperature,
    });

    const encoder = new TextEncoder();
    let totalStreamedContent = '';
    let streamedChunks = 0;
    
    // Capture trace reference for use in the stream callback
    const trace = this.trace;
    
    return new ReadableStream({
      async start(controller) {
        try {
          // Send initial metadata
          const initialData: StreamChunk = {
            type: 'metadata',
            sqlQuery,
            rowCount: rows.length,
            executionTime
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`));

          // Stream the LLM response
          for await (const textPart of textStream) {
            totalStreamedContent += textPart;
            streamedChunks++;
            
            const chunk: StreamChunk = {
              type: 'text',
              content: textPart
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }

          const streamDuration = Date.now() - streamStartTime;

          // Log successful response generation to Langfuse
          if (responseSpan) {
            responseSpan.generation({
              name: 'response-stream-generation',
              model: MODEL_CONFIG.responseGeneration.model,
              input: {
                prompt: responsePrompt,
                sql_query: sqlQuery,
                row_count: rows.length,
              },
              output: {
                response: totalStreamedContent,
              },
              usage: {
                total_tokens: Math.ceil((responsePrompt.length + totalStreamedContent.length) / 4),
              },
              metadata: {
                stream_duration_ms: streamDuration,
                chunks_streamed: streamedChunks,
                temperature: MODEL_CONFIG.responseGeneration.temperature,
                sql_execution_time_ms: executionTime,
              }
            });

            logEvent(trace, 'response-generation-success', {
              response_length: totalStreamedContent.length,
              stream_duration_ms: streamDuration,
              chunks_streamed: streamedChunks,
              total_session_time_ms: executionTime + streamDuration,
            });

            responseSpan.end();
          }

          // Log streaming completion
          if (trace) {
            logEvent(trace, 'response-streaming-completed', {
              total_content_length: totalStreamedContent.length,
              chunks_streamed: streamedChunks,
              stream_duration_ms: streamDuration,
              model: MODEL_CONFIG.responseGeneration.model,
            });
          }

          // Send completion signal
          const doneChunk: StreamChunk = { type: 'done' };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneChunk)}\n\n`));
          controller.close();
        } catch (error) {
          // Log streaming error to Langfuse
          if (responseSpan) {
            logEvent(trace, 'response-generation-error', {
              error: error instanceof Error ? error.message : 'Unknown error',
              partial_content_length: totalStreamedContent.length,
              chunks_before_error: streamedChunks,
            });
            responseSpan.end();
          }
          
          // Log streaming error
          if (trace) {
            logEvent(trace, 'response-streaming-error', {
              error: error instanceof Error ? error.message : 'Unknown error',
              partial_content_length: totalStreamedContent.length,
              chunks_before_error: streamedChunks,
            });
          }
          
          controller.error(error);
        }
      },
    });
  }

  private buildSqlPrompt(messages: ChatMessage[], metadata: DatabaseMetadata): string {
    return `You are a SQL expert. Based on the following database schema and user conversation, generate a SQL query to answer the user's question.

Database Schema:
${JSON.stringify(metadata?.table_schemas, null, 2)}

Available Tables:
${(metadata?.sheets || []).map((sheet) => `- ${sheet.table} (originally "${sheet.original_name}")`).join('\n')}

User Conversation:
${messages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

IMPORTANT: When referencing tables in your SQL query, you MUST prefix each table name with "source_db." (e.g., "source_db.sheet_sheet1" instead of just "sheet_sheet1").

Generate ONLY a valid SQL SELECT query. Do not include any explanations or markdown formatting. Only use the tables and columns that exist in the schema above.`;
  }

  private buildResponsePrompt(sqlQuery: string, rows: unknown[][]): string {
    return `You are a master data analyst with 20+ years of experience. Analyze the query results below and provide a direct, actionable response. Cut through the noise and focus on what matters.

Query: ${sqlQuery}
Rows: ${rows.length}

Data:
${JSON.stringify(rows.slice(0, 100), null, 2)} ${rows.length > 100 ? '\n... (showing first 100 rows)' : ''}

Give me the key findings. Be conversational but concise. No fluff, no obvious statements. What insights should I act on? Respond in plain text only - no markdown or formatting.`;
  }
} 