import { redirect } from "next/navigation";
import { Upload, MessageCircle, Database, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAuthenticated } from "@/utils/auth/getUserInfoServer";

export default async function DashboardPage() {
  const isAuth: boolean = await isAuthenticated();

  if (!isAuth) {
    return redirect("/");
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-6xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Welcome to XLSX Analytics</h1>
          <p className="text-muted-foreground">
            Upload and analyze your Excel files with powerful AI-driven insights
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Upload Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-600" />
                Upload Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Upload your Excel files to get started with data analysis
              </p>
              <a 
                href="/dashboard/upload" 
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4"
              >
                Start Upload
              </a>
            </CardContent>
          </Card>

          {/* Chat Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
                AI Chat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Ask questions about your data and get AI-powered insights
              </p>
              <a 
                href="/dashboard/chat" 
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4"
              >
                Start Chat
              </a>
            </CardContent>
          </Card>

          {/* Analytics Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-purple-600" />
                Data Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Advanced analytics and visualizations for your data
              </p>
              <button 
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 py-2 px-4"
                disabled
              >
                Coming Soon
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Features Overview */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Key Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                <span className="text-sm">Excel file upload and processing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-green-600 rounded-full"></div>
                <span className="text-sm">AI-powered data analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-purple-600 rounded-full"></div>
                <span className="text-sm">Interactive chat interface</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-orange-600 rounded-full"></div>
                <span className="text-sm">Data visualization tools</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-medium rounded-full">
                  1
                </div>
                <div>
                  <p className="font-medium">Upload your Excel file</p>
                  <p className="text-sm text-muted-foreground">Choose an Excel file from your computer</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 bg-green-600 text-white text-xs font-medium rounded-full">
                  2
                </div>
                <div>
                  <p className="font-medium">Start analyzing</p>
                  <p className="text-sm text-muted-foreground">Use AI chat to ask questions about your data</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 bg-purple-600 text-white text-xs font-medium rounded-full">
                  3
                </div>
                <div>
                  <p className="font-medium">Get insights</p>
                  <p className="text-sm text-muted-foreground">Receive AI-powered analysis and recommendations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
