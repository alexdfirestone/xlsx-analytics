"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

// Hard-coded file ID for demo purposes
const DEMO_FILE_ID = "4f39cd3d-0601-44b7-be29-0379740c7154";

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface StreamChunk {
  type: 'metadata' | 'text' | 'done';
  content?: string;
  sqlQuery?: string;
  rowCount?: number;
  executionTime?: number;
}

interface QueryMetadata {
  sqlQuery: string;
  rowCount: number;
  executionTime: number;
}

// Call the chat API with streaming response
async function streamChatResponse(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  onMetadata: (metadata: QueryMetadata) => void
): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      file_id: DEMO_FILE_ID
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'API request failed');
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6); // Remove "data: " prefix
            if (jsonStr.trim()) {
              const parsed: StreamChunk = JSON.parse(jsonStr);
              
              if (parsed.type === 'metadata') {
                onMetadata({
                  sqlQuery: parsed.sqlQuery || '',
                  rowCount: parsed.rowCount || 0,
                  executionTime: parsed.executionTime || 0
                });
              } else if (parsed.type === 'text' && parsed.content) {
                fullResponse += parsed.content;
                onChunk(parsed.content);
              } else if (parsed.type === 'done') {
                return fullResponse;
              }
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE chunk:', parseError);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullResponse;
}

// Loading skeleton for chat messages
export function MessageSkeleton() {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[70%] rounded-lg px-4 py-2 bg-muted">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <div className="space-y-2">
            <div className="h-3 bg-gray-300 rounded w-48 animate-pulse"></div>
            <div className="h-3 bg-gray-300 rounded w-32 animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Streaming message component that displays real-time responses
export function StreamingMessage({ 
  messages, 
  onComplete 
}: { 
  messages: ChatMessage[]; 
  onComplete?: (response: string, metadata?: QueryMetadata) => void;
}) {
  const [streamedContent, setStreamedContent] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<QueryMetadata | null>(null);

  useEffect(() => {
    let isMounted = true;
    let capturedMetadata: QueryMetadata | null = null;
    
    const streamResponse = async () => {
      try {
        setStreamedContent("");
        setError(null);
        setMetadata(null);
        setIsComplete(false);

        const fullResponse = await streamChatResponse(
          messages,
          (chunk: string) => {
            if (isMounted) {
              setStreamedContent(prev => prev + chunk);
            }
          },
          (meta) => {
            if (isMounted) {
              capturedMetadata = meta;
              setMetadata(meta);
            }
          }
        );
        
        if (isMounted) {
          setIsComplete(true);
          if (onComplete) {
            onComplete(fullResponse, capturedMetadata || undefined);
          }
        }
      } catch (error) {
        if (isMounted) {
          const errorMessage = error instanceof Error ? error.message : 'An error occurred';
          setError(errorMessage);
          setIsComplete(true);
        }
      }
    };

    streamResponse();

    return () => {
      isMounted = false;
    };
  }, [messages, onComplete]);

  return (
    <div className="flex flex-col gap-2">
      {/* Query metadata display */}
      {metadata && (
        <div className="flex justify-start mb-2">
          <div className="max-w-[70%] rounded-lg px-3 py-2 bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-700 font-mono">
              📊 Query: {metadata.sqlQuery}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              ⏱️ {metadata.executionTime}ms • {metadata.rowCount} rows
            </p>
          </div>
        </div>
      )}

      {/* Streaming message content */}
      <div className="flex justify-start mb-4">
        <div className="max-w-[70%] rounded-lg px-4 py-2 bg-muted">
          {error ? (
            <p className="text-sm text-red-600">❌ {error}</p>
          ) : (
            <p className="text-sm">
              {streamedContent}
              {!isComplete && <span className="animate-pulse">▋</span>}
            </p>
          )}
          <p className="text-xs opacity-70 mt-1">
            {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
} 