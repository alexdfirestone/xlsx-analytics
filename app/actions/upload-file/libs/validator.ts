import { DuckDBInstance } from '@duckdb/node-api';
import { createClient } from '@/utils/supabase/server';
import { downloadFileFromStorage } from './storage';

export interface ValidationSchema {
  expectedTables: string[];
  expectedColumns: Record<string, string[]>; // tableName -> columnNames
  expectedDataTypes: Record<string, Record<string, string>>; // tableName -> columnName -> dataType
}

export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    tablesValidated: number;
    columnsValidated: number;
    dataTypesValidated: number;
  };
}

export interface ValidationError {
  type: 'missing_table' | 'missing_column' | 'wrong_data_type' | 'database_error';
  table?: string;
  column?: string;
  expected?: string;
  actual?: string;
  message: string;
}

export interface ValidationWarning {
  type: 'extra_table' | 'extra_column' | 'unexpected_data_type';
  table?: string;
  column?: string;
  expected?: string;
  actual?: string;
  message: string;
}

/**
 * Load DuckDB database from storage into memory and validate schema
 */
export async function validateDatabase(
  tenantId: string,
  workbookId: string,
  expectedSchema: ValidationSchema
): Promise<ValidationResult> {
  console.log('🔍 Starting database validation...');
  console.log('Expected schema:', JSON.stringify(expectedSchema, null, 2));
  
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: [],
    summary: {
      tablesValidated: 0,
      columnsValidated: 0,
      dataTypesValidated: 0
    }
  };

  try {
    // Download database from storage
    const supabase = await createClient();
    const storagePath = `${tenantId}/duckdb/${workbookId}/${workbookId}.duckdb`;
    console.log(`Downloading database for validation from: ${storagePath}`);
    
    const localDbPath = await downloadFileFromStorage(supabase, storagePath);
    console.log(`Database downloaded to: ${localDbPath}`);

    // Load database into memory
    const instance = await DuckDBInstance.create(':memory:');
    const connection = await instance.connect();

    // Attach the downloaded database
    await connection.run(`ATTACH '${localDbPath}' AS source_db`);
    console.log('Database attached to memory instance');

    // Get actual tables from database
    const tablesResult = await connection.run(`
      SELECT name 
      FROM source_db.sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);
    const actualTables = await tablesResult.getRows();
    const actualTableNames = actualTables.map(row => row[0] as string);

    console.log(`Found ${actualTableNames.length} tables in database:`, actualTableNames);
    console.log(`Expected tables:`, expectedSchema.expectedTables);

    // Validate expected tables exist
    for (const expectedTable of expectedSchema.expectedTables) {
      if (!actualTableNames.includes(expectedTable)) {
        console.log(`❌ MISSING TABLE: Expected '${expectedTable}' but not found in database`);
        result.errors.push({
          type: 'missing_table',
          table: expectedTable,
          message: `Expected table '${expectedTable}' not found in database`
        });
        result.success = false;
      } else {
        console.log(`✅ TABLE FOUND: '${expectedTable}' exists in database`);
        result.summary.tablesValidated++;
      }
    }

    // Check for extra tables (warnings)
    for (const actualTable of actualTableNames) {
      if (!expectedSchema.expectedTables.includes(actualTable)) {
        console.log(`⚠️  EXTRA TABLE: Found '${actualTable}' in database but not expected`);
        result.warnings.push({
          type: 'extra_table',
          table: actualTable,
          message: `Unexpected table '${actualTable}' found in database`
        });
      }
    }

    // Validate columns and data types for each expected table
    for (const tableName of expectedSchema.expectedTables) {
      if (!actualTableNames.includes(tableName)) {
        continue; // Skip if table doesn't exist (already reported as error)
      }

      // Get actual columns and their data types
      const columnsResult = await connection.run(`
        SELECT column_name, data_type 
        FROM source_db.information_schema.columns 
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position
      `);
      const actualColumns = await columnsResult.getRows();
      
      const actualColumnMap = new Map<string, string>();
      for (const [columnName, dataType] of actualColumns) {
        actualColumnMap.set(columnName as string, dataType as string);
      }

      console.log(`Table '${tableName}' columns:`, Array.from(actualColumnMap.entries()));
      console.log(`Expected columns for '${tableName}':`, expectedSchema.expectedColumns[tableName] || []);

      // Validate expected columns exist
      const expectedColumns = expectedSchema.expectedColumns[tableName] || [];
      for (const expectedColumn of expectedColumns) {
        if (!actualColumnMap.has(expectedColumn)) {
          console.log(`❌ MISSING COLUMN: Expected '${expectedColumn}' in table '${tableName}' but not found`);
          result.errors.push({
            type: 'missing_column',
            table: tableName,
            column: expectedColumn,
            message: `Expected column '${expectedColumn}' not found in table '${tableName}'`
          });
          result.success = false;
        } else {
          console.log(`✅ COLUMN FOUND: '${expectedColumn}' exists in table '${tableName}'`);
          result.summary.columnsValidated++;
        }
      }

      // Check for extra columns (warnings)
      for (const [actualColumn] of actualColumnMap) {
        if (!expectedColumns.includes(actualColumn)) {
          console.log(`⚠️  EXTRA COLUMN: Found '${actualColumn}' in table '${tableName}' but not expected`);
          result.warnings.push({
            type: 'extra_column',
            table: tableName,
            column: actualColumn,
            message: `Unexpected column '${actualColumn}' found in table '${tableName}'`
          });
        }
      }

      // Validate data types
      const expectedDataTypes = expectedSchema.expectedDataTypes[tableName] || {};
      console.log(`Expected data types for '${tableName}':`, expectedDataTypes);
      
      for (const [columnName, expectedType] of Object.entries(expectedDataTypes)) {
        const actualType = actualColumnMap.get(columnName);
        if (actualType && actualType !== expectedType) {
          console.log(`❌ WRONG DATA TYPE: Column '${columnName}' in table '${tableName}' has type '${actualType}' but expected '${expectedType}'`);
          result.errors.push({
            type: 'wrong_data_type',
            table: tableName,
            column: columnName,
            expected: expectedType,
            actual: actualType,
            message: `Column '${columnName}' in table '${tableName}' has type '${actualType}' but expected '${expectedType}'`
          });
          result.success = false;
        } else if (actualType) {
          console.log(`✅ DATA TYPE MATCH: Column '${columnName}' in table '${tableName}' has correct type '${actualType}'`);
          result.summary.dataTypesValidated++;
        } else {
          console.log(`⚠️  COLUMN NOT FOUND FOR DATA TYPE CHECK: '${columnName}' in table '${tableName}'`);
        }
      }
    }

    // Clean up - DuckDB automatically manages connections
    console.log(`Validation completed: ${result.summary.tablesValidated} tables, ${result.summary.columnsValidated} columns, ${result.summary.dataTypesValidated} data types validated`);
    console.log(`Errors: ${result.errors.length}, Warnings: ${result.warnings.length}`);
    
    if (result.errors.length > 0) {
      console.log('❌ VALIDATION ERRORS:');
      result.errors.forEach(error => console.log(`  - ${error.message}`));
    }
    
    if (result.warnings.length > 0) {
      console.log('⚠️  VALIDATION WARNINGS:');
      result.warnings.forEach(warning => console.log(`  - ${warning.message}`));
    }
    
    console.log(`🔍 Database validation ${result.success ? 'PASSED' : 'FAILED'}`);

  } catch (error) {
    console.error('Database validation error:', error);
    result.errors.push({
      type: 'database_error',
      message: `Failed to validate database: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    result.success = false;
  }

  return result;
}

/**
 * Create validation schema from Excel metadata
 */
export function createValidationSchemaFromMetadata(
  tableSchemas: Record<string, string>,
  expectedColumns: Record<string, string[]>
): ValidationSchema {
  console.log('📋 Creating validation schema from metadata...');
  console.log('Table schemas:', Object.keys(tableSchemas));
  console.log('Expected columns:', expectedColumns);
  
  const expectedTables = Object.keys(tableSchemas);
  const expectedDataTypes: Record<string, Record<string, string>> = {};

  // Parse table schemas to extract expected data types
  for (const [tableName, schema] of Object.entries(tableSchemas)) {
    console.log(`Parsing schema for table '${tableName}':`);
    console.log(schema);
    
    expectedDataTypes[tableName] = {};
    
    // Extract column names and types from schema description
    const lines = schema.split('\n');
    for (const line of lines) {
      if (line.includes(':')) {
        const match = line.match(/- (\w+) \(([^)]+)\):/);
        if (match) {
          const [, columnName, dataType] = match;
          expectedDataTypes[tableName][columnName] = dataType.toUpperCase();
          console.log(`  Extracted: ${columnName} -> ${dataType.toUpperCase()}`);
        }
      }
    }
  }

  const validationSchema = {
    expectedTables,
    expectedColumns,
    expectedDataTypes
  };
  
  console.log('📋 Created validation schema:', JSON.stringify(validationSchema, null, 2));
  
  return validationSchema;
}

/**
 * Validate database using metadata from processing
 */
export async function validateDatabaseWithMetadata(
  tenantId: string,
  workbookId: string,
  tableSchemas: Record<string, string>,
  expectedColumns: Record<string, string[]>
): Promise<ValidationResult> {
  const validationSchema = createValidationSchemaFromMetadata(tableSchemas, expectedColumns);
  return validateDatabase(tenantId, workbookId, validationSchema);
} 