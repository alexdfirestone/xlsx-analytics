import { DuckDBInstance } from '@duckdb/node-api';
import * as XLSX from 'xlsx';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { 
  ProcessedExcelResult, 
  ExcelMetadata, 
  SheetInfo 
} from './types';
import { 
  sanitizeColumnName, 
  generateTableSchema, 
  createTableName 
} from './schema';

/**
 * Process Excel file and convert to DuckDB database
 */
export async function processExcelFile(
  filePath: string, 
  fileId: string
): Promise<ProcessedExcelResult> {
  // Create SHA from file ID for consistency
  const sha = crypto.createHash('sha256')
    .update(fileId)
    .digest('hex')
    .slice(0, 12);
  
  const tmpDir = os.tmpdir();
  const dbFile = path.join(tmpDir, `${sha}.duckdb`);
  console.log(`Processing workbook: ${filePath} (ID: ${sha})`);

  // Read file as buffer first for better reliability
  console.log(`Reading file from path: ${filePath}`);
  const fileBuffer = await fs.readFile(filePath);
  console.log(`File read successfully, buffer size: ${fileBuffer.length} bytes`);
  
  const wb = XLSX.read(fileBuffer, { type: 'buffer' });
  console.log(`Excel file parsed successfully, found ${wb.SheetNames.length} sheets`);

  const instance: any = await DuckDBInstance.create(dbFile);
  const connection: any = await instance.connect();

  // Verify expected number of tables before creation
  const expectedTables = wb.SheetNames.length;
  console.log(`Preparing to create ${expectedTables} tables from Excel sheets...`);

  // Get list of expected table names
  const expectedTableNames = wb.SheetNames.map(name => createTableName(name));

  // Clean up any existing tables that aren't from our sheets
  const existingTablesResult = await connection.run("SHOW TABLES");
  const existingTables = await existingTablesResult.getRows();
  for (const [tableName] of existingTables) {
    if (tableName && typeof tableName === 'string' && !expectedTableNames.includes(tableName)) {
      await connection.run(`DROP TABLE IF EXISTS "${tableName}"`);
      console.log(`Cleaned up unrelated table: ${tableName}`);
    }
  }

  // Store table schemas and column mappings for metadata generation
  const tableSchemas: Record<string, string> = {};
  const tableColumnMappings: Record<string, string[]> = {};

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { 
      defval: null,
      raw: false,
      blankrows: false
    });

    if (!rows.length) {
      console.log(`Skipping empty sheet: ${sheetName}`);
      continue;
    }

    const originalCols = Object.keys(rows[0] as object);
    const colMapping = Object.fromEntries(
      originalCols
        .filter(col => col && !col.startsWith('__EMPTY'))
        .map(col => [
          sanitizeColumnName(String(col)),
          col
        ])
    );

    const cols = Object.keys(colMapping);
    const tbl = createTableName(sheetName);

    console.log(`📊 Processing sheet: ${sheetName} -> table: ${tbl}`);
    console.log(`📋 Original columns: ${originalCols.join(', ')}`);
    console.log(`🔧 Sanitized columns: ${cols.join(', ')}`);
    console.log(`📝 Rows to process: ${rows.length}`);

    // Store the sanitized column names for metadata generation
    tableColumnMappings[tbl] = cols;

    const createTableSQL = `CREATE TABLE ${tbl} (${cols.map(c => `"${c}" TEXT`).join(',')})`;
    await connection.run(`DROP TABLE IF EXISTS ${tbl};`);
    await connection.run(createTableSQL);
    console.log(`✅ Created table: ${tbl}`);
    console.log(`🔧 SQL: ${createTableSQL}`);

    const stmt = await connection.prepare(`INSERT INTO ${tbl} VALUES (${cols.map(() => '?').join(',')})`);
    
    let insertedRows = 0;
    console.log(`📝 Sample data from first 3 rows:`);
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      const row = rows[i] as Record<string, any>;
      const values = cols.map(c => {
        const originalCol = colMapping[c];
        const value = row[originalCol];
        return value === null || value === undefined ? '' : String(value).trim();
      });
      console.log(`  Row ${i + 1}: ${JSON.stringify(values)}`);
    }
    
    for (const row of (rows as Record<string, any>[])) {
      const values = cols.map((c: string) => {
        const originalCol = colMapping[c];
        const value = row[originalCol];
        return value === null || value === undefined ? '' : String(value).trim();
      });
      
      for (let i = 0; i < values.length; i++) {
        stmt.bindVarchar(i + 1, values[i]);
      }
      await stmt.run();
      insertedRows++;
    }
    
    console.log(`📥 Inserted ${insertedRows} rows into ${tbl}`);

    // Verify the data was actually inserted
    const rowCountResult = await connection.run(`SELECT COUNT(*) FROM ${tbl}`);
    const rowCountData = await rowCountResult.getRows();
    const rowCount = Number(rowCountData[0][0]);
    console.log(`✓ Verified ${rowCount} rows in ${tbl} (expected: ${insertedRows})`);
    
    if (rowCount !== insertedRows) {
      console.warn(`⚠️ Row count mismatch: inserted ${insertedRows} but found ${rowCount} in table`);
    }
  }

  // Verify number of tables created
  const tablesResult = await connection.run("SHOW TABLES");
  const tablesData = await tablesResult.getRows();
  const actualTableNames = tablesData.map((row: any) => row[0] as string);
  const tableCount = actualTableNames.length;
  
  console.log(`🔍 Tables found in database: ${actualTableNames.join(', ')}`);
  console.log(`📊 Table count: ${tableCount} (expected: ${expectedTables})`);
  
  if (tableCount !== expectedTables) {
    throw new Error(`Table count mismatch: Created ${tableCount} tables but expected ${expectedTables} (one per sheet)`);
  }
  console.log(`✓ Created ${tableCount} tables from ${expectedTables} sheets`);

  // ===== CRITICAL FIX: Force DuckDB to flush all data to disk =====
  console.log('🔧 Forcing DuckDB to flush all data to disk...');
  
  // 1. Commit any pending transactions
  try {
    await connection.run("COMMIT");
    console.log('✅ Committed all transactions');
  } catch (commitError) {
    console.log('ℹ️ No pending transactions to commit');
  }
  
  // 2. Force a checkpoint to ensure all data is written to disk
  try {
    await connection.run("CHECKPOINT");
    console.log('✅ Checkpoint completed - all data flushed to disk');
  } catch (checkpointError) {
    console.error('⚠️ Checkpoint failed:', checkpointError);
  }
  
  // 3. Close the connection properly to ensure all buffers are flushed
  try {
    if (connection && typeof connection.disconnectSync === 'function') {
      connection.disconnectSync();
      console.log('✅ Database connection closed properly');
    } else if (connection && typeof connection.closeSync === 'function') {
      connection.closeSync();
      console.log('✅ Database connection closed properly');
    } else {
      console.log('ℹ️ Connection close method not available');
    }
  } catch (closeError) {
    console.error('❌ Error closing connection:', closeError);
  }
  
  // 4. Close the instance to release file handles
  try {
    if (instance && typeof instance.close === 'function') {
      await instance.close();
      console.log('✅ DuckDB instance closed');
    } else {
      console.log('ℹ️ Instance close method not available');
    }
  } catch (instanceCloseError) {
    console.error('❌ Error closing instance:', instanceCloseError);
  }

  // Generate table schemas using the actual sanitized column names
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
    if (rows.length > 0) {
      const tableName = createTableName(sheetName);
      const sanitizedColumns = tableColumnMappings[tableName] || [];
      tableSchemas[tableName] = await generateTableSchema(tableName, rows, sanitizedColumns);
    }
  }

  const metadata: ExcelMetadata = {
    workbook_id: sha,
    file_id: fileId,
    sheets: wb.SheetNames.map(n => ({
      table: createTableName(n),
      original_name: n
    })),
    table_schemas: tableSchemas
  };

  const metadataPath = path.join(tmpDir, `${sha}.json`);
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  // Quick verification that the database file was created and has tables
  console.log(`🔍 Verifying database file: ${dbFile}`);
  const fileExists = await fs.access(dbFile).then(() => true).catch(() => false);
  console.log(`📁 Database file exists: ${fileExists}`);
  
  if (fileExists) {
    const fileStats = await fs.stat(dbFile);
    console.log(`📏 Database file size: ${fileStats.size} bytes`);
    
    // Test the database before upload
    console.log('🔍 Testing database before upload...');
    const testInstance = await DuckDBInstance.create(dbFile);
    const testConnection = await testInstance.connect();
    
    const testTablesResult = await testConnection.run("SHOW TABLES");
    const testTables = await testTablesResult.getRows();
    const testTableNames = testTables.map((row: any) => row[0] as string);
    console.log(`📋 Tables in database before upload: ${testTableNames.join(', ')}`);
    
    // Test a simple query on each table
    for (const tableName of testTableNames) {
      try {
        const testCountResult = await testConnection.run(`SELECT COUNT(*) FROM ${tableName}`);
        const testCountData = await testCountResult.getRows();
        const testRowCount = Number(testCountData[0][0]);
        console.log(`📊 Table ${tableName}: ${testRowCount} rows`);
      } catch (error) {
        console.error(`❌ Error testing table ${tableName}:`, error);
      }
    }
  }

  return {
    sha,
    dbFile,
    metadata,
    sheetsProcessed: wb.SheetNames.length,
    tableColumnMappings
  };
} 