"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileIcon, Sheet } from "lucide-react";

interface FileMetadata {
  workbook_id: string;
  file_id: string;
  sheets: Array<{
    table: string;
    original_name: string;
  }>;
  table_schemas: Record<string, string>;
}

interface FileMetadataDisplayProps {
  metadata: FileMetadata;
}

export function FileMetadataDisplay({ metadata }: FileMetadataDisplayProps) {
  const formatSchemaDescription = (schema: string) => {
    const lines = schema.split('\n');
    const columnLines = lines.slice(2); // Skip "Table:" and "Columns:" lines
    
    return columnLines
      .filter(line => line.trim().startsWith('- '))
      .map(line => {
        const match = line.match(/- (\w+) \((\w+)\): (.+)/);
        if (match) {
          return {
            name: match[1],
            description: match[3]
          };
        }
        return null;
      })
      .filter((column): column is { name: string; description: string } => column !== null);
  };

  return (
    <div className="space-y-4">
      {/* File info header */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <FileIcon className="h-5 w-5 text-muted-foreground" />
        <span className="text-lg font-medium">Your Spreadsheet</span>
        <span className="text-sm text-muted-foreground">• {metadata.sheets.length} sheet{metadata.sheets.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Sheets overview */}
      <div className="space-y-3">
        {Object.entries(metadata.table_schemas).map(([tableName, schema]) => {
          const columns = formatSchemaDescription(schema);
          const sheet = metadata.sheets.find(s => s.table === tableName);
          
          return (
            <Card key={tableName} className="border border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sheet className="h-4 w-4" />
                  {sheet?.original_name || 'Sheet'}
                  <span className="text-sm font-normal text-muted-foreground">({columns.length} columns)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-3">Available data in this sheet:</p>
                  <div className="grid gap-2">
                    {columns.map((column, index) => (
                      <div key={index} className="flex items-start gap-3 p-2 bg-muted/30 rounded">
                        <span className="font-medium text-sm min-w-0 flex-shrink-0">{column.name}</span>
                        <span className="text-sm text-muted-foreground">{column.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
} 