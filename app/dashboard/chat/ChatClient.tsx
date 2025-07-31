"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { MessageSkeleton, StreamingMessage } from "./AsyncMessageLoader";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isPending?: boolean;
  pendingId?: string; // To track which pending message this corresponds to
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

function MessageBubble({ message }: { message: Message }) {
  // Debug log to check if metadata is present
  if (message.role === 'assistant') {
    console.log('MessageBubble - Assistant message metadata:', message.metadata);
  }
  
  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className="flex flex-col gap-2 max-w-[70%]">
        {/* Show metadata for assistant messages if available */}
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

// Component that demonstrates Suspense with streaming
function StreamingMessageWrapper({ 
  messages, 
  onComplete 
}: { 
  messages: ChatMessage[]; 
  onComplete: (response: string, metadata?: { sqlQuery: string; rowCount: number; executionTime: number }) => void;
}) {
  return (
    <Suspense fallback={<MessageSkeleton />}>
      <StreamingMessage messages={messages} onComplete={onComplete} />
    </Suspense>
  );
}

export function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingMessages, setPendingMessages] = useState<{ id: string; messages: ChatMessage[] }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingMessages]);

  // Convert messages to the format expected by the API
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

    setMessages(prev => [...prev, userMessage]);
    setPendingMessages(prev => [...prev, { id: pendingId, messages: apiMessages }]);
    setInput("");
  };

  const handleResponseComplete = (
    pendingId: string, 
    response: string, 
    metadata?: { sqlQuery: string; rowCount: number; executionTime: number }
  ) => {
    console.log('Response complete - metadata:', metadata); // Debug log
    
    const responseMessage: Message = {
      id: `response-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      metadata
    };

    console.log('Created response message:', responseMessage); // Debug log

    setMessages(prev => [...prev, responseMessage]);
    setPendingMessages(prev => prev.filter(msg => msg.id !== pendingId));
  };

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
        {messages.length === 0 && pendingMessages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p>Start a conversation about your spreadsheet data</p>
            <p className="text-xs mt-2">Try asking: "What are the sales trends?" or "Show me the data summary"</p>
            <p className="text-xs mt-2 text-blue-600">💡 Messages will stream from the real API with SQL queries</p>
            <p className="text-xs mt-1 text-gray-500">File ID: 4f39cd3d-0601-44b7-be29-0379740c7154</p>
          </div>
        )}
        
        {/* Display all messages in order */}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        
        {/* Display streaming messages in order */}
        {pendingMessages.map((pendingMsg) => (
          <StreamingMessageWrapper 
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
        
        {/* Debug info */}
        <div className="mt-2 text-xs text-gray-500">
          {messages.length > 0 && (
            <p>Conversation: {messages.length} messages total</p>
          )}
        </div>
      </div>
    </div>
  );
}
