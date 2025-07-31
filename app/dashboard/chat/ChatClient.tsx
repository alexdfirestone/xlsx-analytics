"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { MessageSkeleton, StreamingMessage } from "./AsyncMessageLoader";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  isPending?: boolean;
  pendingId?: string; // To track which pending message this corresponds to
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
        message.isUser 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-muted'
      }`}>
        <p className="text-sm">{message.content}</p>
        <p className="text-xs opacity-70 mt-1">
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

// Component that demonstrates Suspense with streaming
function StreamingMessageWrapper({ userMessage, onComplete }: { userMessage: string; onComplete: (response: string) => void }) {
  return (
    <Suspense fallback={<MessageSkeleton />}>
      <StreamingMessage userMessage={userMessage} onComplete={onComplete} />
    </Suspense>
  );
}

export function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingMessages, setPendingMessages] = useState<{ id: string; content: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingMessages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    const pendingId = `pending-${Date.now()}`;

    setMessages(prev => [...prev, userMessage]);
    setPendingMessages(prev => [...prev, { id: pendingId, content: input.trim() }]);
    setInput("");
  };

  const handleResponseComplete = (pendingId: string, response: string) => {
    const responseMessage: Message = {
      id: `response-${Date.now()}`,
      content: response,
      isUser: false,
      timestamp: new Date(),
    };

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
            <p className="text-xs mt-2 text-blue-600">💡 Messages will stream in word by word (Suspense demo)</p>
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
            userMessage={pendingMsg.content} 
            onComplete={(response) => handleResponseComplete(pendingMsg.id, response)}
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
