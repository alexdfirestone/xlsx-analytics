"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { UploadClient } from "../upload/upload-client";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess?: () => void;
}

export function UploadModal({ open, onOpenChange, onUploadSuccess }: UploadModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload New File</DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx) to analyze and chat with your data.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <UploadClient 
            onUploadSuccess={() => {
              onUploadSuccess?.();
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
} 