"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface FileDropzoneProps {
  onFile: (file: File) => void;
  progress?: number;
}

export function FileDropzone({ onFile, progress = 0 }: FileDropzoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      onFile(file);
    }
  }, [onFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  return (
    <div className="space-y-4">
      <Card 
        {...getRootProps()} 
        className={`border-dashed cursor-pointer transition-colors hover:bg-muted/50 ${
          isDragActive ? 'border-primary bg-muted/50' : 'border-muted-foreground/25'
        }`}
      >
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">
            {isDragActive ? "Drop the file here" : "Drag & drop or click to select"}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Only .xlsx and .xls files are accepted
          </p>
        </CardContent>
      </Card>

      {selectedFile && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Selected file: {selectedFile.name}</p>
          <Progress value={progress} className="w-full" />
        </div>
      )}
    </div>
  );
}