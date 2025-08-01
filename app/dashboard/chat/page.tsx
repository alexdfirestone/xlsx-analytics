import { redirect } from "next/navigation";
import { ResizableChatInterface } from "./components/ResizableChatInterface";
import { SuspenseErrorBoundary } from "./components/ErrorBoundary";
import { isAuthenticated } from "@/utils/auth/getUserInfoServer";

export default async function ChatPage() {
  const isAuth: boolean = await isAuthenticated();

  if (!isAuth) {
    return redirect("/");
  }

  return (
    <div className="h-[calc(100vh-7rem)]">
      <SuspenseErrorBoundary>
        <ResizableChatInterface />
      </SuspenseErrorBoundary>
    </div>
  );
}
