"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileIcon, CheckIcon, RefreshCw, AlertCircle, Plus, Trash2 } from "lucide-react";
import { useFiles } from "../hooks/useFiles";
import { UploadModal } from "./UploadModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

interface FileSelectorProps {
  selectedFileId: string | null;
  onFileSelect: (fileId: string) => void;
}

export function FileSelector({ selectedFileId, onFileSelect }: FileSelectorProps) {
  const { files, loading, error, refetch } = useFiles();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null);

  // Auto-select the first file if none selected and files are available
  useEffect(() => {
    if (!selectedFileId && files.length > 0) {
      onFileSelect(files[0].file_id);
    }
  }, [selectedFileId, files, onFileSelect]);

  const handleUploadSuccess = () => {
    refetch(); // Refresh the file list after successful upload
  };

  const handleDeleteFile = (fileId: string, fileName: string) => {
    setFileToDelete({ id: fileId, name: fileName });
    setDeleteModalOpen(true);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;

    setDeletingFileId(fileToDelete.id);
    
    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId: fileToDelete.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete file');
      }

      // If the deleted file was selected, clear the selection
      if (selectedFileId === fileToDelete.id) {
        onFileSelect('');
      }

      // Close modal and refresh the file list
      setDeleteModalOpen(false);
      setFileToDelete(null);
      refetch();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setDeletingFileId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'text-green-600';
      case 'processing':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return '✅';
      case 'processing':
        return '⏳';
      case 'error':
        return '❌';
      default:
        return '📁';
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Files</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={refetch}
            disabled={loading}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading files...
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-600">
            <AlertCircle className="h-6 w-6 mx-auto mb-2" />
            <p className="text-sm font-medium">Error loading files</p>
            <p className="text-xs mt-1">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refetch}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        ) : files.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p>No files uploaded yet</p>
            <p className="text-sm mt-1">Upload a file to get started</p>
          </div>
        ) : (
          <div className="space-y-1">
            {files.map((file) => (
              <div key={file.file_id} className="group relative">
                <Button
                  variant={selectedFileId === file.file_id ? "secondary" : "ghost"}
                  className="w-full justify-start p-4 h-auto text-left pr-12"
                  onClick={() => onFileSelect(file.file_id)}
                >
                  <div className="flex items-start gap-3 w-full">
                    <FileIcon className="h-4 w-4 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {file.original_name}
                        </span>
                        {selectedFileId === file.file_id && (
                          <CheckIcon className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-1">
                        {file.status !== 'completed' && (
                          <div className="flex items-center gap-2">
                            <span className={getStatusColor(file.status)}>
                              {getStatusIcon(file.status)} {file.status}
                            </span>
                          </div>
                        )}
                        <p>{formatDate(file.created_at)}</p>
                        {file.sheets_processed > 0 && (
                          <p>{file.sheets_processed} sheets</p>
                        )}
                      </div>
                    </div>
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(file.file_id, file.original_name);
                  }}
                  disabled={deletingFileId === file.file_id}
                >
                  {deletingFileId === file.file_id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
        
        <div className="p-4 border-t mt-4">
          <Button 
            variant="outline" 
            className="w-full gap-2" 
            size="sm"
            onClick={() => setIsUploadModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Upload New File
          </Button>
        </div>
      </CardContent>

      <UploadModal
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        onUploadSuccess={handleUploadSuccess}
      />

      <DeleteConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={confirmDeleteFile}
        fileName={fileToDelete?.name || ''}
        isDeleting={deletingFileId === fileToDelete?.id}
      />
    </Card>
  );
} 