import { Code2, Database, Zap, Shield, Cpu, Globe, Layers, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  return (
    <div className="space-y-8 max-w-6xl">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          XLSX Analytics Platform
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          A high-performance analytics platform demonstrating Next.js 15, Vercel AI SDK, DuckDB integration, 
          and modern full-stack architecture patterns built for the Vercel Sales Engineer interview.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Badge variant="secondary">Next.js 15.4.4</Badge>
          <Badge variant="secondary">React 19</Badge>
          <Badge variant="secondary">Vercel AI SDK</Badge>
          <Badge variant="secondary">DuckDB</Badge>
          <Badge variant="secondary">Server Actions</Badge>
          <Badge variant="secondary">Streaming</Badge>
        </div>
      </div>

      {/* Architecture Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Technical Architecture & Stack
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Frontend</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Next.js 15 with App Router</li>
                <li>• React 19 with Server Components</li>
                <li>• TypeScript for type safety</li>
                <li>• Tailwind CSS 4 + shadcn/ui</li>
                <li>• Turbopack for faster builds</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Backend & Data</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• DuckDB for analytics queries</li>
                <li>• Supabase for auth & storage</li>
                <li>• OpenAI GPT-4o via AI SDK</li>
                <li>• Server Actions for security</li>
                <li>• Edge Runtime compatible</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Performance</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Streaming responses</li>
                <li>• Suspense boundaries</li>
                <li>• Error boundaries</li>
                <li>• In-memory processing</li>
                <li>• Progressive enhancement</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Next.js Optimizations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              Next.js 15 Optimizations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">Server Components by Default</h4>
              <div className="bg-muted rounded-md p-3 text-xs font-mono">
                <div className="text-green-600">// Server-side auth with instant redirect</div>
                <div>export default async function HomePage() {`{`}</div>
                <div>  const userInfo = await getUserInfo()</div>
                <div>  if (userInfo) redirect("/dashboard")</div>
                <div>  return &lt;LoginPage /&gt;</div>
                <div>{`}`}</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Strategic Client Components</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Only interactive components use "use client"</li>
                <li>• Minimized client-side JavaScript bundle</li>
                <li>• Chat interface, dropzone, auth forms</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Suspense + Error Boundaries</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Non-blocking UI loading states</li>
                <li>• Graceful error handling</li>
                <li>• Progressive enhancement</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Server Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              Server Actions Implementation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">Secure File Processing</h4>
              <div className="bg-muted rounded-md p-3 text-xs font-mono">
                <div className="text-green-600">'use server';</div>
                <div><br /></div>
                <div>export async function uploadFileAction() {`{`}</div>
                <div>  const supabase = await createClient()</div>
                <div>  // Server-side auth validation</div>
                <div>  // Excel → DuckDB processing</div>
                <div>  // Secure file upload</div>
                <div>{`}`}</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Benefits</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• No client-side file handling</li>
                <li>• Automatic form validation</li>
                <li>• Server-side authentication</li>
                <li>• Progressive enhancement</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Vercel AI SDK */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Vercel AI SDK Streaming
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">Real-time Chat Streaming</h4>
              <div className="bg-muted rounded-md p-3 text-xs font-mono">
                <div>const {`{ textStream }`} = streamText({`{`}</div>
                <div>  model: openai('gpt-4o'),</div>
                <div>  prompt: responsePrompt,</div>
                <div>{`}`})</div>
                <div><br /></div>
                <div className="text-green-600">// Stream to client via SSE</div>
                <div>return new Response(stream)</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">AI-Powered Features</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Natural language → SQL generation</li>
                <li>• Real-time streaming responses</li>
                <li>• Schema-aware query building</li>
                <li>• Performance metrics tracking</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* DuckDB Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-500" />
              DuckDB Analytics Engine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">High-Performance Processing</h4>
              <div className="bg-muted rounded-md p-3 text-xs font-mono">
                <div>// In-memory instance for speed</div>
                <div>const instance = await DuckDBInstance</div>
                <div>  .create(':memory:')</div>
                <div><br /></div>
                <div>// Attach uploaded database</div>
                <div>await connection.run(</div>
                <div>  `ATTACH '${`localDbPath`}' AS source_db`</div>
                <div>)</div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Excel → DuckDB Pipeline</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• XLSX parsing with data sanitization</li>
                <li>• Bulk insert with prepared statements</li>
                <li>• Schema generation and validation</li>
                <li>• Automatic cleanup and optimization</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vercel Platform Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            Vercel Platform Integration & Optimizations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                Edge Runtime
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Force dynamic for real-time data</li>
                <li>• Extended duration for complex queries</li>
                <li>• Global edge distribution ready</li>
                <li>• Optimized cold start performance</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Performance
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Turbopack development builds</li>
                <li>• Server-sent events streaming</li>
                <li>• Optimized webpack externals</li>
                <li>• Font loading optimization</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Security
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Server-side authentication</li>
                <li>• Row-level security (RLS)</li>
                <li>• SQL injection protection</li>
                <li>• Secure file processing</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                Developer Experience
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Type-safe throughout</li>
                <li>• Hot module replacement</li>
                <li>• Modern component patterns</li>
                <li>• Comprehensive error handling</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>🎨 Advanced UI/UX Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm">Resizable Interface</h4>
              <p className="text-sm text-muted-foreground">Split-panel chat interface with file selector</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm">Drag & Drop Upload</h4>
              <p className="text-sm text-muted-foreground">React Dropzone with progress tracking</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm">Real-time Messaging</h4>
              <p className="text-sm text-muted-foreground">Streaming chat with SQL query metadata</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm">Loading States</h4>
              <p className="text-sm text-muted-foreground">Suspense boundaries and skeleton loaders</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🚀 Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm">Query Execution</h4>
              <p className="text-sm text-muted-foreground">Sub-second DuckDB analytics with timing</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm">File Processing</h4>
              <p className="text-sm text-muted-foreground">Excel → DuckDB conversion with progress</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm">Memory Management</h4>
              <p className="text-sm text-muted-foreground">Automatic cleanup and resource optimization</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm">Network Optimization</h4>
              <p className="text-sm text-muted-foreground">Streaming responses and efficient caching</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Differentiators */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">🏆 Key Differentiators for Vercel Platform</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-sm text-blue-900 mb-2">Modern Architecture</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Next.js 15 + React 19 bleeding edge</li>
                <li>• Server Actions replacing REST APIs</li>
                <li>• Streaming-first real-time experience</li>
                <li>• Edge Runtime optimization</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-blue-900 mb-2">Production Ready</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Comprehensive error boundaries</li>
                <li>• Security-first authentication</li>
                <li>• Type-safe end-to-end</li>
                <li>• Performance monitoring ready</li>
              </ul>
            </div>
          </div>
          <div className="bg-white/70 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-900 font-medium">
              💡 This implementation showcases the full power of Vercel's platform: from Edge Runtime optimization 
              and AI SDK integration to modern deployment patterns and developer experience innovations.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Navigation CTA */}
      <Card className="text-center">
        <CardContent className="py-8">
          <h3 className="text-lg font-semibold mb-2">Ready to Explore?</h3>
          <p className="text-muted-foreground mb-4">
            Try the Upload feature to process Excel files, or Chat to interact with existing data using natural language.
          </p>
          <div className="flex justify-center gap-3">
            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
              → Upload: Process Excel files into queryable databases
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
              → Chat: Natural language data analysis
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
