"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { StreamingMessage } from "./AsyncMessageLoader";

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

// Main chat interface component
export function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    if (!input.trim()) return;

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

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Empty state */}
        {messages.length === 0 && pendingMessages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-lg mb-2">Chat with your spreadsheet data</p>
            <p className="text-sm mb-4">Ask questions and get insights from your uploaded file</p>
            <div className="text-xs space-y-1">
              <p>💡 Try: "What are the sales trends?" or "Show me the top customers"</p>
              <p className="text-gray-500">File ID: 4f39cd3d-0601-44b7-be29-0379740c7154</p>
            </div>
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
            placeholder="Ask a question about your data..."
            className="min-h-[60px] resize-none"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
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
