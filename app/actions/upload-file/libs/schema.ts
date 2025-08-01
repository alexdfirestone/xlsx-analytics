import slugify from 'slugify';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Sanitize column names for database compatibility
 */
export function sanitizeColumnName(columnName: string): string {
  let sanitized = slugify(String(columnName), { 
    lower: true, 
    strict: true, 
    replacement: '_' 
  });
  
  // Add prefix if column name starts with a number
  if (/^\d/.test(sanitized)) {
    sanitized = `col_${sanitized}`;
  }
  
  return sanitized;
}

/**
 * Generate table schema description using OpenAI
 */
export async function generateTableSchema(
  tableName: string, 
  sampleData: Record<string, unknown>[], 
  sanitizedColumns: string[]
): Promise<string> {
  if (!sampleData?.length) {
    return `Table: ${tableName}\nColumns: No data available`;
  }

  const sampleRows = sampleData.slice(0, 5);
  const prompt = `Analyze this table data and generate a schema description.
Table name: ${tableName}
Sample data: ${JSON.stringify(sampleRows, null, 2)}
Actual column names in database: ${sanitizedColumns.join(', ')}

Generate schema in format:
Table: ${tableName}
Columns:
- [actual_column_name_from_database] (VARCHAR): [brief description]

Rules:
1. Use exact table name
2. Use ONLY the actual column names from the database: ${sanitizedColumns.join(', ')}
3. All columns must be VARCHAR
4. Keep descriptions brief and factual
5. Do NOT use original Excel header names, use the sanitized database column names`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a database schema expert.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 300
    });

    const schema = completion.choices[0]?.message?.content?.trim() || '';
    return schema || `Table: ${tableName}\nColumns: Schema generation failed`;
  } catch (error) {
    console.error('Error generating schema:', error);
    return `Table: ${tableName}\nColumns: Schema generation failed`;
  }
}

/**
 * Create table name from sheet name
 */
export function createTableName(sheetName: string): string {
  return `sheet_${slugify(sheetName, { 
    lower: true, 
    strict: true, 
    replacement: '_' 
  })}`;
} 