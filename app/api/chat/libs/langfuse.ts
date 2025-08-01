import { Langfuse } from 'langfuse';
import { openai } from '@ai-sdk/openai';
import type { LangfuseTraceClient } from 'langfuse-core';

// Initialize Langfuse client
export const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com',
});

// We'll manually trace the OpenAI calls since we're using Vercel AI SDK
export { openai };

// Helper function to create a trace for the entire chat session
export function createChatTrace(userId?: string, fileId?: string) {
  return langfuse.trace({
    name: 'excel-chat-analysis',
    userId: userId || 'anonymous',
    metadata: {
      fileId,
      endpoint: '/api/chat',
      timestamp: new Date().toISOString(),
    },
    tags: ['excel-analysis', 'chat', 'sql-generation'],
  });
}

// Helper function to create spans for different operations
export function createSpan(trace: LangfuseTraceClient, name: string, metadata?: Record<string, unknown>) {
  return trace.span({
    name,
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString(),
    },
  });
}

// Helper to log custom events
export function logEvent(trace: LangfuseTraceClient, name: string, data: Record<string, unknown>) {
  trace.event({
    name,
    ...data,
  });
} 