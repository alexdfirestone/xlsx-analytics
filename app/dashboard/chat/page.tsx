import { ResizableChatInterface } from "./ResizableChatInterface";
import { SuspenseErrorBoundary } from "./ErrorBoundary";

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-3rem)]">
      <SuspenseErrorBoundary>
        <ResizableChatInterface />
      </SuspenseErrorBoundary>
    </div>
  );
}
