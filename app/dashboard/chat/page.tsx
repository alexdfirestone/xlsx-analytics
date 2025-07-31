import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatClient } from "./ChatClient";
import { SuspenseErrorBoundary } from "./ErrorBoundary";
import { Loader2 } from "lucide-react";

// Loading component for the main chat area
function ChatLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-center text-muted-foreground py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading chat interface...</p>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Next.js Suspense Demo</h1>
        <p className="text-muted-foreground">
          Demonstrating streaming with Suspense - messages appear word by word
        </p>
      </div>

      <Card className="h-[60vh]">
        <CardHeader>
          <CardTitle>Real-time Chat with Suspense</CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-full">
          <SuspenseErrorBoundary>
            <Suspense fallback={<ChatLoading />}>
              <ChatClient />
            </Suspense>
          </SuspenseErrorBoundary>
        </CardContent>
      </Card>
    </div>
  );
}
