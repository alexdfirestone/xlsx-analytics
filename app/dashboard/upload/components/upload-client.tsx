"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileDropzone } from "./FileDropzone";
import { Button } from "@/components/ui/button";
import { uploadFileAction } from "@/app/actions/upload-file/uploadFile";

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadClientProps {
  onUploadSuccess?: () => void;
}

export function UploadClient({ onUploadSuccess }: UploadClientProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setUploadStatus('idle');
    setProgress(0);
    toast.success("File received");
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setUploadStatus('uploading');
    setProgress(25);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      setProgress(50);
      
      const result = await uploadFileAction(formData);
      
      setProgress(100);
      
      if (result.success) {
        setUploadStatus('success');
        toast.success(`File uploaded successfully! ${result.processingResult?.sheetsProcessed || 0} sheets processed.`);
        onUploadSuccess?.();
      } else {
        setUploadStatus('error');
        toast.error(result.error || 'Upload failed');
      }
    } catch (error) {
      setUploadStatus('error');
      setProgress(0);
      toast.error('Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const getProgressValue = () => {
    if (uploadStatus === 'success') return 100;
    if (uploadStatus === 'uploading') return progress;
    if (selectedFile && uploadStatus === 'idle') return 10;
    return 0;
  };

  return (
    <div className="space-y-4">
      <FileDropzone 
        onFile={handleFileSelect}
        progress={getProgressValue()}
      />
      
      {selectedFile && (
        <div className="flex flex-col space-y-2">
          <Button 
            onClick={handleUpload}
            disabled={uploadStatus === 'uploading'}
            className="w-full"
          >
            {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload File'}
          </Button>
          
          {uploadStatus === 'success' && (
            <p className="text-sm text-green-600 text-center">
              ✅ Upload completed successfully!
            </p>
          )}
          
          {uploadStatus === 'error' && (
            <p className="text-sm text-red-600 text-center">
              ❌ Upload failed. Please try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
} 