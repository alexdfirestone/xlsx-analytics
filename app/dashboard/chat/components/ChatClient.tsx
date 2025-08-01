"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, RotateCcw, Info } from "lucide-react";
import { StreamingMessage } from "./AsyncMessageLoader";
import { useFileMetadata } from "../hooks/useFileMetadata";
import { FileMetadataDisplay } from "./FileMetadataDisplay";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    sqlQuery: string;
    rowCount: number;
    executionTime: number;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface PendingMessage {
  id: string;
  messages: ChatMessage[];
}

// Message bubble component for displaying chat messages
function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className="flex flex-col gap-2 max-w-[70%]">
        {/* SQL query metadata for assistant messages */}
        {message.role === 'assistant' && message.metadata && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-700 font-mono">
                📊 Query: {message.metadata.sqlQuery}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                ⏱️ {message.metadata.executionTime}ms • {message.metadata.rowCount} rows
              </p>
            </div>
          </div>
        )}
        
        {/* Main message content */}
        <div className={`rounded-lg px-4 py-2 ${
          message.role === 'user' 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted'
        }`}>
          <p className="text-sm">{message.content}</p>
          <p className="text-xs opacity-70 mt-1">
            {message.timestamp.toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}

interface ChatClientProps {
  fileId: string | null;
}

// Main chat interface component
export function ChatClient({ fileId }: ChatClientProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [showMetadata, setShowMetadata] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { metadata, loading: metadataLoading, error: metadataError, fetchMetadata } = useFileMetadata();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingMessages]);

  // Convert UI messages to API format
  const getApiMessages = (includeNewMessage?: string): ChatMessage[] => {
    const apiMessages: ChatMessage[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    if (includeNewMessage) {
      apiMessages.push({
        role: 'user',
        content: includeNewMessage
      });
    }
    
    return apiMessages;
  };

  // Handle sending a new message
  const handleSend = async () => {
    if (!input.trim() || !fileId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const pendingId = `pending-${Date.now()}`;
    const apiMessages = getApiMessages(input.trim());

    // Add user message and create pending streaming message
    setMessages(prev => [...prev, userMessage]);
    setPendingMessages(prev => [...prev, { id: pendingId, messages: apiMessages }]);
    setInput("");
  };

  // Handle completion of streaming response
  const handleResponseComplete = (
    pendingId: string, 
    response: string, 
    metadata?: { sqlQuery: string; rowCount: number; executionTime: number }
  ) => {
    const responseMessage: Message = {
      id: `response-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      metadata
    };

    // Add completed message and remove pending message
    setMessages(prev => [...prev, responseMessage]);
    setPendingMessages(prev => prev.filter(msg => msg.id !== pendingId));
  };

  // Handle Enter key press to send message
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle resetting the chat
  const handleReset = () => {
    setMessages([]);
    setPendingMessages([]);
    setInput("");
    setShowMetadata(false);
  };

  // Handle showing file metadata
  const handleShowMetadata = async () => {
    if (!fileId) return;
    
    if (!metadata) {
      await fetchMetadata(fileId);
    }
    setShowMetadata(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with reset button */}
      {fileId && (messages.length > 0 || pendingMessages.length > 0) && (
        <div className="border-b p-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-medium">Chat Session</h3>
              <p className="text-xs text-muted-foreground">File ID: {fileId}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              New Chat
            </Button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Empty state */}
        {messages.length === 0 && pendingMessages.length === 0 && !showMetadata && (
          <div className="text-center text-muted-foreground py-8">
            {fileId ? (
              <>
                <p className="text-lg mb-2">Chat with your spreadsheet data</p>
                <p className="text-sm mb-4">Ask questions and get insights from your uploaded file</p>
                <div className="text-xs space-y-3">
                  <p>💡 Try: &quot;What are the sales trends?&quot; or &quot;Show me the top customers&quot;</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleShowMetadata}
                    disabled={metadataLoading}
                    className="gap-2"
                  >
                    <Info className="h-4 w-4" />
                    {metadataLoading ? 'Loading...' : 'Tell me about this file'}
                  </Button>
                  <p className="text-gray-500">File ID: {fileId}</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-lg mb-2">Select a file to start chatting</p>
                <p className="text-sm mb-4">Choose a file from the sidebar to analyze your data</p>
              </>
            )}
          </div>
        )}

        {/* Metadata display */}
        {showMetadata && fileId && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">File Information</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowMetadata(false)}
              >
                Back to Chat
              </Button>
            </div>
            
            {metadataError ? (
              <div className="text-center text-red-600 py-8">
                <p className="font-medium">Error loading file information</p>
                <p className="text-sm mt-1">{metadataError}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fetchMetadata(fileId)}
                  className="mt-3"
                >
                  Try Again
                </Button>
              </div>
            ) : metadataLoading ? (
              <div className="text-center text-muted-foreground py-8">
                <p>Loading file information...</p>
              </div>
            ) : metadata ? (
              <FileMetadataDisplay metadata={metadata} />
            ) : null}
          </div>
        )}
        
        {/* Completed messages */}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        
        {/* Streaming messages */}
        {pendingMessages.map((pendingMsg) => (
          <StreamingMessage 
            key={pendingMsg.id} 
            messages={pendingMsg.messages}
            fileId={fileId || ''}
            onComplete={(response, metadata) => handleResponseComplete(pendingMsg.id, response, metadata)}
          />
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={fileId ? "Ask a question about your data..." : "Select a file to start chatting..."}
            className="min-h-[60px] resize-none"
            disabled={!fileId}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || !fileId}
            size="icon"
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
