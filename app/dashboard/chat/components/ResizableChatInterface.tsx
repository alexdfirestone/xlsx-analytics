"use client";

import { useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileSelector } from "../components/FileSelector";
import { ChatClient } from "../components/ChatClient";

export function ResizableChatInterface() {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const handleFileSelect = (fileId: string) => {
    setSelectedFileId(fileId);
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-full rounded-lg border"
    >
      <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
        <FileSelector 
          selectedFileId={selectedFileId}
          onFileSelect={handleFileSelect}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={75}>
        <ChatClient fileId={selectedFileId} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
} 