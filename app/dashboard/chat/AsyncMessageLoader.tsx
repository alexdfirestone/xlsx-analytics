"use client";

import { Suspense, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

// Mock responses for demonstration
const mockResponses = [
  "Based on your spreadsheet data, I can see that sales have increased by 15% compared to last month. The top performing product is Product A with 2,340 units sold.",
  "Looking at the data, there are 3 columns with missing values in rows 45-52. I recommend cleaning these before analysis.",
  "The average transaction value is $127.50. The highest single transaction was $2,450 on March 15th.",
  "I found 12 duplicate entries in your dataset. Would you like me to help you identify and remove them?",
  "Your data shows a clear upward trend in customer satisfaction scores over the past 6 months.",
  "There's an interesting correlation between marketing spend and sales revenue. For every $1 spent on marketing, you're generating $3.20 in sales.",
  "The data indicates that customers from the 25-34 age group are your most valuable segment, with an average lifetime value of $890.",
  "I've identified 5 outliers in your sales data that might need investigation.",
  "Your conversion rate is currently 3.2%, which is above the industry average of 2.8%.",
  "The data suggests that Tuesday and Wednesday are your best performing days for sales.",
  "I can see that your customer retention rate has improved by 8% over the last quarter.",
  "The analysis shows that mobile users have a 23% higher conversion rate than desktop users.",
  "Your data reveals that the most profitable time to send marketing emails is between 2-4 PM on weekdays.",
  "I found that customers who purchase Product B are 40% more likely to become repeat customers.",
  "The seasonal analysis indicates that Q4 is your strongest quarter, accounting for 35% of annual revenue."
];

// Simulate async data fetching with different response times
async function fetchMessageResponse(userMessage: string): Promise<string> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  
  // Simply pick a random response for demo purposes
  return mockResponses[Math.floor(Math.random() * mockResponses.length)];
}

// Loading skeleton component
export function MessageSkeleton() {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[70%] rounded-lg px-4 py-2 bg-muted">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <div className="space-y-2">
            <div className="h-3 bg-gray-300 rounded w-48 animate-pulse"></div>
            <div className="h-3 bg-gray-300 rounded w-32 animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced async component that demonstrates Suspense patterns
async function AsyncMessageResponse({ userMessage }: { userMessage: string }) {
  const response = await fetchMessageResponse(userMessage);
  
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[70%] rounded-lg px-4 py-2 bg-muted">
        <p className="text-sm">{response}</p>
        <p className="text-xs opacity-70 mt-1">
          {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

// Client-side wrapper that provides Suspense boundary
export function AsyncMessageLoader({ userMessage }: { userMessage: string }) {
  return (
    <Suspense fallback={<MessageSkeleton />}>
      <AsyncMessageResponse userMessage={userMessage} />
    </Suspense>
  );
}

// Streaming message component that demonstrates progressive loading
export function StreamingMessage({ userMessage, onComplete }: { userMessage: string; onComplete?: (response: string) => void }) {
  const [streamedContent, setStreamedContent] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const streamResponse = async () => {
      const response = await fetchMessageResponse(userMessage);
      const words = response.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        if (!isMounted) break;
        
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        setStreamedContent(prev => prev + (i === 0 ? '' : ' ') + words[i]);
      }
      
      if (isMounted) {
        setIsComplete(true);
        // Call onComplete with the full response when streaming is done
        if (onComplete) {
          onComplete(response);
        }
      }
    };

    streamResponse();

    return () => {
      isMounted = false;
    };
  }, [userMessage, onComplete]);

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[70%] rounded-lg px-4 py-2 bg-muted">
        <p className="text-sm">
          {streamedContent}
          {!isComplete && <span className="animate-pulse">▋</span>}
        </p>
        <p className="text-xs opacity-70 mt-1">
          {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
} 