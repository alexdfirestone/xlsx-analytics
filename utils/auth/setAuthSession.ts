// ... existing code ...
import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";

async function handleApiAuthSession(supabase: SupabaseClient, request: Request) {
    const accessToken = request.headers.get('access_token'); // Extract access_token from headers
    const refreshToken = request.headers.get('refresh_token'); // Extract refresh_token from headers

    // Check if both tokens are present
    if (!accessToken || !refreshToken) {
        return NextResponse.json({ error: 'Tokens are required' }, { status: 400 });
    }

    // Set the auth session
    const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
    });

    if (error) {
        return NextResponse.json({ error: 'Invalid or expired tokens' }, { status: 401 });
    }
    return data; // Return data if successful
}

export { handleApiAuthSession }
