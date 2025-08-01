import { DuckDBInstance } from '@duckdb/node-api';
import type { DuckDBConnection } from './types';
import { logEvent } from './langfuse';

export class DatabaseManager {
  private instance: DuckDBInstance | null = null;
  private connection: DuckDBConnection | null = null;
  private trace: any = null;

  setTrace(trace: any) {
    this.trace = trace;
  }

  async initialize(localDbPath: string): Promise<void> {
    if (this.trace) {
      logEvent(this.trace, 'database-initialization-started', {
        local_db_path: localDbPath,
      });
    }
    
    // Create in-memory DuckDB instance
    this.instance = await DuckDBInstance.create(':memory:');
    this.connection = await this.instance.connect();

    // Attach the downloaded database
    await this.connection.run(`ATTACH '${localDbPath}' AS source_db`);
    
    if (this.trace) {
      logEvent(this.trace, 'database-initialization-completed', {
        local_db_path: localDbPath,
        instance_created: true,
        connection_established: true,
        database_attached: true,
      });
    }
  }

  async executeQuery(query: string): Promise<unknown[][]> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    if (this.trace) {
      logEvent(this.trace, 'database-query-execution-started', {
        query: query,
        query_length: query.length,
      });
    }

    const startTime = Date.now();
    const result = await this.connection.run(query);
    const rows = await result.getRows();
    const executionTime = Date.now() - startTime;
    
    if (this.trace) {
      logEvent(this.trace, 'database-query-execution-completed', {
        query: query,
        rows_returned: rows.length,
        execution_time_ms: executionTime,
        query_length: query.length,
      });
    }
    
    return rows;
  }

  async getTableInfo(): Promise<{ tables: string[]; schemas: Record<string, Array<{name: string; type: string}>> }> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    if (this.trace) {
      logEvent(this.trace, 'database-schema-inspection-started', {});
    }

    // Get list of tables that actually exist in the database
    const tablesResult = await this.connection.run("SHOW TABLES");
    const tables = await tablesResult.getRows();
    const tableNames = tables.map((row: unknown[]) => row[0] as string);

    // Get schema information for each table
    const schemas: Record<string, Array<{name: string; type: string}>> = {};
    for (const tableName of tableNames) {
      const schemaResult = await this.connection.run(`DESCRIBE ${tableName}`);
      const columns = await schemaResult.getRows();
      schemas[tableName] = columns.map((row: unknown[]) => ({
        name: row[0] as string,
        type: row[1] as string
      }));
    }

    if (this.trace) {
      logEvent(this.trace, 'database-schema-inspection-completed', {
        tables_found: tableNames.length,
        table_names: tableNames,
        total_columns: Object.values(schemas).reduce((sum, cols) => sum + cols.length, 0),
      });
    }

    return { tables: tableNames, schemas };
  }

  cleanup(): void {
    try {
      if (this.connection) {
        try {
          if (this.connection.disconnectSync) {
            this.connection.disconnectSync();
          } else if (this.connection.closeSync) {
            this.connection.closeSync();
          }
          
          if (this.trace) {
            logEvent(this.trace, 'database-connection-closed', {
              connection_closed: true,
            });
          }
        } catch (closeError) {
          if (this.trace) {
            logEvent(this.trace, 'database-connection-close-error', {
              error: closeError instanceof Error ? closeError.message : 'Unknown error',
            });
          }
        }
      }
      if (this.instance) {
        try {
          // No documented close method for DuckDB instance
          if (this.trace) {
            logEvent(this.trace, 'database-instance-cleanup', {
              instance_cleanup: true,
            });
          }
        } catch (closeError) {
          if (this.trace) {
            logEvent(this.trace, 'database-instance-cleanup-error', {
              error: closeError instanceof Error ? closeError.message : 'Unknown error',
            });
          }
        }
      }
    } catch (cleanupError) {
      if (this.trace) {
        logEvent(this.trace, 'database-cleanup-error', {
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
        });
      }
    }
  }
}

export function validateSqlQuery(query: string): void {
  const normalizedQuery = query.trim().toLowerCase();
  const dangerousOperations = ['delete', 'drop', 'alter', 'create', 'insert', 'update'];
  
  for (const operation of dangerousOperations) {
    if (normalizedQuery.startsWith(operation)) {
      throw new Error('Only SELECT queries are allowed for security reasons');
    }
  }
} 