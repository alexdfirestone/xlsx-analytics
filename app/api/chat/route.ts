import { NextRequest, NextResponse } from 'next/server';

// Simulate streaming response
async function* streamResponse(message: string) {
  const responses = [
    "Based on your spreadsheet data, I can see that sales have increased by 15% compared to last month.",
    "Looking at the data, there are 3 columns with missing values in rows 45-52.",
    "The average transaction value is $127.50. The highest single transaction was $2,450.",
    "I found 12 duplicate entries in your dataset. Would you like me to help you identify and remove them?",
    "Your data shows a clear upward trend in customer satisfaction scores over the past 6 months."
  ];
  
  const response = responses[Math.floor(Math.random() * responses.length)];
  const words = response.split(' ');
  
  for (const word of words) {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    yield word + ' ';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResponse(message)) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  // Health check endpoint
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Chat API is running',
    features: ['streaming', 'suspense', 'server-components']
  });
}
