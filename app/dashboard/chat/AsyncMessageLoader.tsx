"use client";

import { Suspense, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

// Hard-coded file ID for now
const HARDCODED_FILE_ID = "4f39cd3d-0601-44b7-be29-0379740c7154";

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

// Call the real chat API with streaming
async function streamChatResponse(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  onMetadata: (metadata: { sqlQuery: string; rowCount: number; executionTime: number }) => void
): Promise<string> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // In a real app, you'd get these from auth context
        // For now, these will need to be set manually or handled by auth
      },
      body: JSON.stringify({
        messages,
        file_id: HARDCODED_FILE_ID
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
  } catch (error) {
    console.error('Chat API error:', error);
    throw error;
  }
}

// Loading skeleton component
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

// Enhanced async component that demonstrates Suspense patterns
async function AsyncMessageResponse({ messages }: { messages: ChatMessage[] }) {
  // For the suspense pattern, we'll do a simple non-streaming call
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      file_id: HARDCODED_FILE_ID
    })
  });

  if (!response.ok) {
    throw new Error('Failed to fetch response');
  }

  // This is a simplified version - in reality the API streams
  // But for Suspense demo, we'll just show a placeholder
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[70%] rounded-lg px-4 py-2 bg-muted">
        <p className="text-sm">Response will stream below...</p>
        <p className="text-xs opacity-70 mt-1">
          {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

// Client-side wrapper that provides Suspense boundary
export function AsyncMessageLoader({ messages }: { messages: ChatMessage[] }) {
  return (
    <Suspense fallback={<MessageSkeleton />}>
      <AsyncMessageResponse messages={messages} />
    </Suspense>
  );
}

// Streaming message component that calls the real API
export function StreamingMessage({ 
  messages, 
  onComplete 
}: { 
  messages: ChatMessage[]; 
  onComplete?: (response: string, metadata?: { sqlQuery: string; rowCount: number; executionTime: number }) => void;
}) {
  const [streamedContent, setStreamedContent] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{ sqlQuery: string; rowCount: number; executionTime: number } | null>(null);

  useEffect(() => {
    let isMounted = true;
    let capturedMetadata: { sqlQuery: string; rowCount: number; executionTime: number } | null = null;
    
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
            // Use the captured metadata, not the state metadata
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
      {/* Show metadata if available */}
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

      {/* Main streaming message */}
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