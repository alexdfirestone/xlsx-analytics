'use client'
import { Upload, MessageCircle, Database, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex justify-center">
      <div className="space-y-6 max-w-4xl w-full">
        {/* Simple Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold">XLSX Analytics</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload Excel files and chat with your data using natural language. 
            Built with Next.js 15, DuckDB, Supabase, and the Vercel AI SDK.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center rounded-full bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-semibold">Next.js 15</span>
            <span className="inline-flex items-center rounded-full bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-semibold">React 19</span>
            <span className="inline-flex items-center rounded-full bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-semibold">AI SDK</span>
            <span className="inline-flex items-center rounded-full bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-semibold">DuckDB</span>
            <span className="inline-flex items-center rounded-full bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-semibold">Supabase</span>
          </div>
        </div>

        {/* Quick Start */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-500" />
                Upload Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Drop an Excel file to convert it into a queryable database using DuckDB.
              </p>
              <p className="text-xs text-muted-foreground">
                → Processes sheets into optimized tables<br/>
                → Handles data validation and cleanup<br/>
                → Stores securely with Supabase
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-500" />
                Chat with Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Ask questions in plain English and get insights from your spreadsheets.
              </p>
              <p className="text-xs text-muted-foreground">
                → Natural language to SQL conversion<br/>
                → Real-time streaming responses<br/>
                → Shows query execution details
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Technical Stack */}
        <Card>
          <CardHeader>
            <CardTitle>Technical Stack</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-orange-500" />
                  Frontend
                </h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Next.js 15 with App Router</li>
                  <li>• React 19 Server Components</li>
                  <li>• Server Actions for forms</li>
                  <li>• Streaming with Suspense</li>
                  <li>• Turbopack for development</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-500" />
                  Data & Auth
                </h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Supabase for authentication</li>
                  <li>• PostgreSQL for metadata</li>
                  <li>• Row-level security (RLS)</li>
                  <li>• DuckDB for analytics</li>
                  <li>• File storage with Supabase</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-purple-500" />
                  AI & Performance
                </h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Vercel AI SDK streaming</li>
                  <li>• OpenAI GPT-4o integration</li>
                  <li>• In-memory query processing</li>
                  <li>• Edge Runtime optimization</li>
                  <li>• Real-time streaming responses</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Architecture */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="space-y-2">
                <div className="mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <h4 className="font-medium">1. Upload & Process</h4>
                <p className="text-xs text-muted-foreground">
                  Excel files are processed server-side using Server Actions, converted to DuckDB format, 
                  and metadata stored in Supabase PostgreSQL
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="mx-auto w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Database className="h-6 w-6 text-green-600" />
                </div>
                <h4 className="font-medium">2. Store & Secure</h4>
                <p className="text-xs text-muted-foreground">
                  User authentication via Supabase, file storage with RLS policies, 
                  and optimized data schemas for fast querying
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="mx-auto w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-purple-600" />
                </div>
                <h4 className="font-medium">3. Query & Stream</h4>
                <p className="text-xs text-muted-foreground">
                  Natural language gets converted to SQL via AI, executed on DuckDB, 
                  and results streamed back in real-time
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Why Vercel */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Built for Vercel Platform</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800 mb-4">
              This project showcases modern full-stack patterns that leverage Vercel&apos;s platform capabilities:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div>
                  <strong className="text-blue-900">Performance:</strong>
                  <span className="text-blue-700"> Edge Runtime, streaming API routes, and optimized builds with Turbopack</span>
                </div>
                <div>
                  <strong className="text-blue-900">Developer Experience:</strong>
                  <span className="text-blue-700"> Server Actions, hot reloading, and comprehensive TypeScript support</span>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <strong className="text-blue-900">AI Integration:</strong>
                  <span className="text-blue-700"> Native Vercel AI SDK with streaming responses and OpenAI integration</span>
                </div>
                <div>
                  <strong className="text-blue-900">Scalability:</strong>
                  <span className="text-blue-700"> Serverless functions, automatic scaling, and global edge distribution</span>
                </div>
              </div>
            </div>
            <div className="bg-white/70 rounded-lg p-3 mt-4">
              <p className="text-sm text-blue-900">
                💡 Demonstrates the full power of modern web development with Next.js 15, React 19, 
                and Vercel&apos;s AI SDK working together seamlessly.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center py-6">
          <p className="text-muted-foreground mb-3">
            Ready to try it out? Use the sidebar to navigate to Upload or Chat.
          </p>
          <p className="text-xs text-muted-foreground">
            This demo shows real Excel processing, Supabase authentication, and AI-powered data analysis in action.
          </p>
        </div>
      </div>
    </div>
  );
}
