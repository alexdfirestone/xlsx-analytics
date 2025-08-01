import { streamText, generateObject } from 'ai';
import { z } from 'zod';
import type { ChatMessage, DatabaseMetadata, StreamChunk, DatabaseManager } from './types';
import { sqlQuerySchema } from './types';
import { openai, langfuse, createSpan, logEvent } from './langfuse';

// Model Configuration - Easy to see and change models for each step
const MODEL_CONFIG = {
  sqlGeneration: {
    model: 'gpt-4.1',
    temperature: 0.1,
  },
  responseGeneration: {
    model: 'gpt-4.1',
    temperature: 0.3,
  },
} as const;

export class LLMService {
  private trace: any;

  constructor(trace?: any) {
    this.trace = trace;
  }
  
  async generateSqlQuery(
    messages: ChatMessage[], 
    metadata: DatabaseMetadata,
    dbManager?: DatabaseManager
  ): Promise<string> {
    const maxRetries = 2;
    let lastError: Error | null = null;
    let lastQuery: string | null = null;
    let tableSamples: Record<string, unknown[][]> = {};

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const sqlPrompt: string = attempt === 0 
          ? this.buildSqlPrompt(messages, metadata)
          : this.buildRetrySqlPrompt(messages, metadata, lastQuery!, lastError!, tableSamples);
        
        // Create span for SQL generation
        const sqlSpan = this.trace ? createSpan(this.trace, `sql-generation-attempt-${attempt + 1}`, {
          model: MODEL_CONFIG.sqlGeneration.model,
          temperature: MODEL_CONFIG.sqlGeneration.temperature,
          prompt_length: sqlPrompt.length,
          tables_count: metadata?.sheets?.length || 0,
          attempt: attempt + 1,
        }) : null;

        try {
          // Log SQL generation start
          if (this.trace) {
            logEvent(this.trace, `sql-generation-attempt-${attempt + 1}-started`, {
              model: MODEL_CONFIG.sqlGeneration.model,
              temperature: MODEL_CONFIG.sqlGeneration.temperature,
              prompt_length: sqlPrompt.length,
              messages_count: messages.length,
              tables_available: metadata?.sheets?.length || 0,
              attempt: attempt + 1,
            });
          }
          
          // Log input to Langfuse
          if (sqlSpan) {
            logEvent(this.trace, `sql-generation-attempt-${attempt + 1}-start`, {
              messages_count: messages.length,
              last_user_message: messages[messages.length - 1]?.content?.slice(0, 100),
              available_tables: metadata?.sheets?.map(s => s.table) || [],
              attempt: attempt + 1,
              is_retry: attempt > 0,
            });
          }

          const startTime = Date.now();
          const { object: sqlResult }: { object: { query: string } } = await generateObject({
            model: openai(MODEL_CONFIG.sqlGeneration.model),
            prompt: sqlPrompt,
            schema: sqlQuerySchema,
            temperature: MODEL_CONFIG.sqlGeneration.temperature,
          });
          const duration = Date.now() - startTime;

          const cleanSqlQuery: string = sqlResult.query.trim();
          lastQuery = cleanSqlQuery;
          
          // Log successful SQL generation
          if (this.trace) {
            logEvent(this.trace, `sql-query-generated-attempt-${attempt + 1}`, {
              sql_query: cleanSqlQuery,
              generation_time_ms: duration,
              query_length: cleanSqlQuery.length,
              model: MODEL_CONFIG.sqlGeneration.model,
              attempt: attempt + 1,
            });
          }
          
          // Log successful generation to Langfuse
          if (sqlSpan) {
            sqlSpan.generation({
              name: `sql-query-generation-attempt-${attempt + 1}`,
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
                attempt: attempt + 1,
              }
            });

            logEvent(this.trace, `sql-generation-attempt-${attempt + 1}-success`, {
              sql_query: cleanSqlQuery,
              duration_ms: duration,
              query_length: cleanSqlQuery.length,
              attempt: attempt + 1,
            });

            sqlSpan.end();
          }

          // If we have a database manager, try to execute the query
          if (dbManager && attempt < maxRetries) {
            try {
              await dbManager.executeQuery(cleanSqlQuery);
              // If execution succeeds, return the query
              return cleanSqlQuery;
            } catch (executionError) {
              lastError = executionError as Error;
              
              // Get table samples for the retry
              if (attempt === 0) {
                tableSamples = await this.getTableSamples(dbManager, cleanSqlQuery);
              }
              
              if (this.trace) {
                logEvent(this.trace, `sql-execution-attempt-${attempt + 1}-failed`, {
                  sql_query: cleanSqlQuery,
                  error: lastError.message,
                  attempt: attempt + 1,
                  will_retry: attempt < maxRetries,
                });
              }
              
              // Continue to next attempt if we haven't exhausted retries
              if (attempt < maxRetries) {
                continue;
              }
            }
          } else {
            // No database manager or final attempt, return the query
            return cleanSqlQuery;
          }
          
        } catch (error) {
          // Log error to Langfuse
          if (sqlSpan) {
            logEvent(this.trace, `sql-generation-attempt-${attempt + 1}-error`, {
              error: error instanceof Error ? error.message : 'Unknown error',
              attempt: attempt + 1,
            });
            sqlSpan.end();
          }
          throw error;
        }
      } catch (error) {
        lastError = error as Error;
        
        if (this.trace) {
          logEvent(this.trace, `sql-generation-attempt-${attempt + 1}-failed`, {
            error: lastError.message,
            attempt: attempt + 1,
            will_retry: attempt < maxRetries,
          });
        }
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError;
        }
      }
    }
    
    // This should never be reached, but just in case
    throw lastError || new Error('SQL generation failed after all retries');
  }

  async createResponseStream(
    sqlQuery: string, 
    rows: unknown[][], 
    executionTime: number,
    metadata?: DatabaseMetadata
  ): Promise<ReadableStream> {
    // Build the response prompt first (this includes column header extraction)
    const responsePrompt = await this.buildResponsePrompt(sqlQuery, rows, metadata);
    
    // Create span for response generation (after prompt is built)
    const responseSpan = this.trace ? createSpan(this.trace, 'response-generation', {
      model: MODEL_CONFIG.responseGeneration.model,
      temperature: MODEL_CONFIG.responseGeneration.temperature,
      sql_query: sqlQuery,
      row_count: rows.length,
      query_execution_time: executionTime,
      prompt_length: responsePrompt.length,
    }) : null;

    // Log start of response generation
    if (this.trace) {
      logEvent(this.trace, 'response-generation-start', {
        sql_query: sqlQuery,
        row_count: rows.length,
        execution_time_ms: executionTime,
        prompt_length: responsePrompt.length,
        model: MODEL_CONFIG.responseGeneration.model,
        temperature: MODEL_CONFIG.responseGeneration.temperature,
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
    // Format schema in a clean, readable way
    const formattedSchema = this.formatDatabaseSchema(metadata?.table_schemas);
    
    return `You are a SQL expert. Based on the following database schema and user conversation, generate a SQL query to answer the user's question.

Database Schema:
${formattedSchema}

Available Tables:
${(metadata?.sheets || []).map((sheet) => `- ${sheet.table} (originally "${sheet.original_name}")`).join('\n')}

User Conversation:
${messages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

IMPORTANT: When referencing tables in your SQL query, you MUST prefix each table name with "source_db." (e.g., "source_db.sheet_sheet1" instead of just "sheet_sheet1").

Generate ONLY a valid SQL SELECT query. Do not include any explanations or markdown formatting. Only use the tables and columns that exist in the schema above.`;
  }

  private formatDatabaseSchema(tableSchemas?: Record<string, unknown>): string {
    if (!tableSchemas || Object.keys(tableSchemas).length === 0) {
      return 'No database schema available.';
    }

    const formattedTables = Object.entries(tableSchemas).map(([tableName, schema]) => {
      if (typeof schema === 'string') {
        // The schema is already formatted as a string, just return it
        return schema;
      } else {
        // Fallback for unexpected schema format
        return `Table: ${tableName}\nColumns: Schema format not recognized`;
      }
    });

    return formattedTables.join('\n\n');
  }

  private buildRetrySqlPrompt(
    messages: ChatMessage[], 
    metadata: DatabaseMetadata, 
    failedQuery: string, 
    error: Error, 
    tableSamples: Record<string, unknown[][]>
  ): string {
    // Format schema in a clean, readable way
    const formattedSchema = this.formatDatabaseSchema(metadata?.table_schemas);
    
    // Format table samples for better readability
    const formattedSamples = Object.entries(tableSamples).map(([tableName, rows]) => {
      const sampleData = rows.slice(0, 3).map(row => 
        row.map((cell, index) => `${index}: ${cell}`).join(', ')
      ).join('\n');
      
      return `Table: ${tableName}\nSample Data (first 3 rows):\n${sampleData}`;
    }).join('\n\n');
    
    return `You are a SQL expert. The previous SQL query failed to execute. Please generate a corrected SQL query based on the error message and the actual data structure.

Database Schema:
${formattedSchema}

Available Tables:
${(metadata?.sheets || []).map((sheet) => `- ${sheet.table} (originally "${sheet.original_name}")`).join('\n')}

User Conversation:
${messages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

FAILED QUERY:
${failedQuery}

ERROR MESSAGE:
${error.message}

ACTUAL DATA SAMPLES:
${formattedSamples}

IMPORTANT: 
1. When referencing tables in your SQL query, you MUST prefix each table name with "source_db." (e.g., "source_db.sheet_sheet1" instead of just "sheet_sheet1").
2. Analyze the error message and the actual data samples to understand what went wrong.
3. Generate ONLY a valid SQL SELECT query that will execute successfully.
4. Do not include any explanations or markdown formatting.
5. Only use the tables and columns that exist in the schema above.`;
  }

  private async getTableSamples(dbManager: DatabaseManager, query: string): Promise<Record<string, unknown[][]>> {
    const tableSamples: Record<string, unknown[][]> = {};
    
    try {
      // Extract table names from the query (simple regex for now)
      const tableMatches = query.match(/source_db\.(\w+)/g);
      if (!tableMatches) return tableSamples;
      
      const tableNames = [...new Set(tableMatches.map(match => match.replace('source_db.', '')))];
      
      for (const tableName of tableNames) {
        try {
          const sampleQuery = `SELECT * FROM source_db.${tableName} LIMIT 3`;
          const rows = await dbManager.executeQuery(sampleQuery);
          tableSamples[tableName] = rows;
        } catch (error) {
          // If we can't get samples for this table, skip it
          console.warn(`Could not get samples for table ${tableName}:`, error);
        }
      }
    } catch (error) {
      console.warn('Error getting table samples:', error);
    }
    
    return tableSamples;
  }

  private async buildResponsePrompt(sqlQuery: string, rows: unknown[][], metadata?: DatabaseMetadata): Promise<string> {
    // Create span for response prompt building
    const promptSpan = this.trace ? createSpan(this.trace, 'response-prompt-building', {
      sql_query: sqlQuery,
      rows_count: rows.length,
      has_metadata: !!metadata,
    }) : null;

    try {
      // Log response prompt building start
      if (this.trace) {
        logEvent(this.trace, 'response-prompt-building-started', {
          sql_query: sqlQuery,
          rows_count: rows.length,
          has_metadata: !!metadata,
        });
      }

      // Extract column headers from the SQL query and metadata
      const columnHeaders = await this.extractColumnHeaders(sqlQuery, metadata);
      
      // Format data with headers if available
      const formattedData = this.formatDataWithHeaders(rows, columnHeaders);
      
      const responsePrompt = `You are a master data analyst with 20+ years of experience. Analyze the query results below and provide a direct, actionable response. Cut through the noise and focus on what matters.

Query: ${sqlQuery}
Rows: ${rows.length}

Data:
${formattedData} ${rows.length > 100 ? '\n... (showing first 100 rows)' : ''}

Give me the key findings. Be conversational but concise. No fluff, no obvious statements. What insights should I act on? Respond in plain text only - no markdown or formatting.`;

      // Log successful response prompt building
      if (this.trace) {
        logEvent(this.trace, 'response-prompt-building-success', {
          prompt_length: responsePrompt.length,
          has_column_headers: !!columnHeaders,
          headers_count: columnHeaders?.length || 0,
          data_format: columnHeaders ? 'markdown_table' : 'json',
        });
      }

      // Log successful prompt building to Langfuse
      if (promptSpan) {
        promptSpan.generation({
          name: 'response-prompt-building',
          model: 'none', // This is just prompt building, not LLM generation
          input: {
            sql_query: sqlQuery,
            rows_count: rows.length,
            metadata: metadata,
            column_headers: columnHeaders,
          },
          output: {
            response_prompt: responsePrompt,
          },
          metadata: {
            prompt_length: responsePrompt.length,
            has_column_headers: !!columnHeaders,
            headers_count: columnHeaders?.length || 0,
            data_format: columnHeaders ? 'markdown_table' : 'json',
          }
        });

        promptSpan.end();
      }

      return responsePrompt;
    } catch (error) {
      // Log error to Langfuse
      if (promptSpan) {
        logEvent(this.trace, 'response-prompt-building-error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        promptSpan.end();
      }
      throw error;
    }
  }

  private async extractColumnHeaders(sqlQuery: string, metadata?: DatabaseMetadata): Promise<string[] | null> {
    if (!metadata?.table_schemas) {
      return null;
    }

    // Create span for column header extraction
    const columnSpan = this.trace ? createSpan(this.trace, 'column-header-extraction', {
      model: 'gpt-4o-mini',
      temperature: 0.1,
      sql_query: sqlQuery,
      tables_count: Object.keys(metadata.table_schemas || {}).length,
    }) : null;

    try {
      // Log column header extraction start
      if (this.trace) {
        logEvent(this.trace, 'column-header-extraction-started', {
          model: 'gpt-4o-mini',
          temperature: 0.1,
          sql_query: sqlQuery,
          tables_available: Object.keys(metadata.table_schemas || {}),
        });
      }

      // Use GPT-4o-mini to analyze the SQL query and generate accurate column headers
      const columnAnalysisPrompt = `Analyze this SQL query and determine the exact column names that will be returned in the result set.

SQL Query: ${sqlQuery}

Available table schemas:
${Object.entries(metadata.table_schemas || {}).map(([tableName, schema]) => 
  `Table: ${tableName}\n${schema}`
).join('\n\n')}

Rules:
1. Only include columns that are explicitly SELECTed in the query
2. For calculated columns (using AS), use the alias name
3. For aggregated functions, use descriptive names
4. Return ONLY the column names as a JSON array of strings
5. Do not include any explanations or markdown formatting

Example output: ["park_name", "visitor_difference"]`;

      const startTime = Date.now();
      const { object: columnResult }: { object: { columns: string[] } } = await generateObject({
        model: openai('gpt-4o-mini'),
        prompt: columnAnalysisPrompt,
        schema: z.object({
          columns: z.array(z.string()).describe('Array of column names that will be returned by the SQL query')
        }),
        temperature: 0.1,
      });
      const duration = Date.now() - startTime;

      const columnHeaders = columnResult.columns;

      // Log successful column header extraction
      if (this.trace) {
        logEvent(this.trace, 'column-header-extraction-success', {
          column_headers: columnHeaders,
          generation_time_ms: duration,
          headers_count: columnHeaders.length,
          model: 'gpt-4o-mini',
        });
      }

      // Log successful generation to Langfuse
      if (columnSpan) {
        columnSpan.generation({
          name: 'column-header-extraction',
          model: 'gpt-4o-mini',
          input: {
            prompt: columnAnalysisPrompt,
            sql_query: sqlQuery,
            metadata: metadata
          },
          output: {
            column_headers: columnHeaders,
          },
          usage: {
            total_tokens: Math.ceil(columnAnalysisPrompt.length / 4), // Rough estimate
          },
          metadata: {
            duration_ms: duration,
            temperature: 0.1,
            headers_count: columnHeaders.length,
          }
        });

        columnSpan.end();
      }

      return columnHeaders;
    } catch (error) {
      // Log error to Langfuse
      if (columnSpan) {
        logEvent(this.trace, 'column-header-extraction-error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        columnSpan.end();
      }

      console.warn('Failed to extract column headers using LLM, falling back to basic parsing:', error);
      return this.extractColumnHeadersFallback(sqlQuery, metadata);
    }
  }

  private extractColumnHeadersFallback(sqlQuery: string, metadata?: DatabaseMetadata): string[] | null {
    if (!metadata?.table_schemas) {
      return null;
    }

    // Log fallback method usage
    if (this.trace) {
      logEvent(this.trace, 'column-header-extraction-fallback-used', {
        sql_query: sqlQuery,
        fallback_method: 'basic_parsing',
      });
    }

    // Extract table names from the SQL query
    const tableMatches = sqlQuery.match(/source_db\.(\w+)/g);
    if (!tableMatches) {
      return null;
    }

    const tableNames = [...new Set(tableMatches.map(match => match.replace('source_db.', '')))];
    
    // For now, we'll use the first table's schema as column headers
    // In a more sophisticated implementation, we could parse the SELECT clause
    // to determine which columns are being selected
    for (const tableName of tableNames) {
      const tableSchema = metadata.table_schemas[tableName];
      if (tableSchema && typeof tableSchema === 'string') {
        // Parse the schema string to extract column names
        const columnMatches = tableSchema.match(/- (\w+) \(/g);
        if (columnMatches) {
          const headers = columnMatches.map(match => match.replace('- ', '').replace(' (', ''));
          
          // Log fallback success
          if (this.trace) {
            logEvent(this.trace, 'column-header-extraction-fallback-success', {
              table_name: tableName,
              column_headers: headers,
              headers_count: headers.length,
            });
          }
          
          return headers;
        }
      }
    }

    // Log fallback failure
    if (this.trace) {
      logEvent(this.trace, 'column-header-extraction-fallback-failed', {
        sql_query: sqlQuery,
        table_names: tableNames,
      });
    }

    return null;
  }

  private formatDataWithHeaders(rows: unknown[][], columnHeaders: string[] | null): string {
    if (!columnHeaders || columnHeaders.length === 0 || rows.length === 0) {
      // Log fallback to JSON format
      if (this.trace) {
        logEvent(this.trace, 'data-formatting-fallback-json', {
          reason: 'no_headers_or_empty_data',
          rows_count: rows.length,
          has_headers: !!columnHeaders,
          headers_count: columnHeaders?.length || 0,
        });
      }
      // Fallback to original format if no headers available
      return JSON.stringify(rows.slice(0, 100), null, 2);
    }

    // Log markdown table formatting
    if (this.trace) {
      logEvent(this.trace, 'data-formatting-markdown-table', {
        column_headers: columnHeaders,
        headers_count: columnHeaders.length,
        rows_count: rows.length,
        max_rows_formatted: Math.min(100, rows.length),
      });
    }

    // Format as markdown table
    const maxRows = Math.min(100, rows.length);
    let formattedData = '';

    // Add header row
    formattedData += '| ' + columnHeaders.join(' | ') + ' |\n';
    formattedData += '|' + columnHeaders.map(() => '---').join('|') + '|\n';

    // Add data rows
    for (let i = 0; i < maxRows; i++) {
      const row = rows[i];
      const formattedRow = row.map(cell => {
        const cellStr = String(cell || '');
        // Escape pipe characters in cell content
        return cellStr.replace(/\|/g, '\\|');
      });
      formattedData += '| ' + formattedRow.join(' | ') + ' |\n';
    }

    return formattedData;
  }
} 