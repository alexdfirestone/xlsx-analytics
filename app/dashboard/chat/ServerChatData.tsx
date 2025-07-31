import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, Users, DollarSign, AlertCircle } from "lucide-react";

// Simulate server-side data fetching
async function fetchChatStats() {
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  return {
    totalMessages: 1247,
    activeUsers: 23,
    avgResponseTime: "2.3s",
    dataQuality: "92%"
  };
}

async function fetchRecentTopics() {
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1500));
  
  return [
    "Sales trends analysis",
    "Data quality issues",
    "Customer segmentation",
    "Revenue forecasting"
  ];
}

async function fetchSystemStatus() {
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  
  return {
    status: "operational",
    lastUpdate: new Date().toISOString(),
    uptime: "99.8%"
  };
}

// Server Components with Suspense
async function ChatStats() {
  const stats = await fetchChatStats();
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Messages</p>
              <p className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Active Users</p>
              <p className="text-2xl font-bold">{stats.activeUsers}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-yellow-500" />
            <div>
              <p className="text-sm text-muted-foreground">Avg Response</p>
              <p className="text-2xl font-bold">{stats.avgResponseTime}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Data Quality</p>
              <p className="text-2xl font-bold">{stats.dataQuality}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function RecentTopics() {
  const topics = await fetchRecentTopics();
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Recent Topics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {topics.map((topic, index) => (
            <div key={index} className="flex items-center space-x-2 p-2 rounded-md bg-muted/50">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm">{topic}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

async function SystemStatus() {
  const status = await fetchSystemStatus();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">System Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className={`text-sm px-2 py-1 rounded-full ${
              status.status === 'operational' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {status.status}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Uptime</span>
            <span className="text-sm font-medium">{status.uptime}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Last Update</span>
            <span className="text-sm font-medium">
              {new Date(status.lastUpdate).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Loading skeletons for Suspense fallbacks
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-300 rounded animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-300 rounded w-20 animate-pulse"></div>
                <div className="h-6 bg-gray-300 rounded w-12 animate-pulse"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TopicsSkeleton() {
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="h-6 bg-gray-300 rounded w-32 animate-pulse"></div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center space-x-2 p-2">
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse"></div>
              <div className="h-4 bg-gray-300 rounded w-48 animate-pulse"></div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 bg-gray-300 rounded w-32 animate-pulse"></div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="h-4 bg-gray-300 rounded w-20 animate-pulse"></div>
              <div className="h-4 bg-gray-300 rounded w-16 animate-pulse"></div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Main component that demonstrates Suspense boundaries
export function ServerChatData() {
  return (
    <div className="space-y-6">
      {/* Stats with Suspense */}
      <Suspense fallback={<StatsSkeleton />}>
        <ChatStats />
      </Suspense>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Topics with Suspense */}
        <Suspense fallback={<TopicsSkeleton />}>
          <RecentTopics />
        </Suspense>
        
        {/* System Status with Suspense */}
        <Suspense fallback={<StatusSkeleton />}>
          <SystemStatus />
        </Suspense>
      </div>
    </div>
  );
} 