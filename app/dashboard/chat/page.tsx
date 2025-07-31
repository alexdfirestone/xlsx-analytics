import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatClient } from "./ChatClient";
import { SuspenseErrorBoundary } from "./ErrorBoundary";

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Spreadsheet Analytics Chat</h1>
        <p className="text-muted-foreground">
          Chat with your data and get insights through natural language queries
        </p>
      </div>

      <Card className="h-[70vh]">
        <CardHeader>
          <CardTitle>Data Chat Interface</CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-full">
          <SuspenseErrorBoundary>
            <ChatClient />
          </SuspenseErrorBoundary>
        </CardContent>
      </Card>
    </div>
  );
}
