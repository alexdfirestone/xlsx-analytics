"use client"
import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError("")
        setIsLoading(true)
        
        try {
            const supabase = createClient()
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            
            if (error) {
                throw new Error(error.message || "Authentication failed")
            }
            
            router.push("/dashboard")
        } catch (error) {
            console.error("Login error:", error)
            setError("Failed to sign in: " + (error as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleLoginAsReviewer = async () => {
        setEmail("test@example.com")
        setPassword("ps thank-you-for-your-consideration")
        
        // Small delay to ensure state is updated before proceeding
        setTimeout(async () => {
            setError("")
            setIsLoading(true)
            
            try {
                const supabase = createClient()
                const { error } = await supabase.auth.signInWithPassword({
                    email: "test@example.com",
                    password: "ps thank-you-for-your-consideration",
                })
                
                if (error) {
                    throw new Error(error.message || "Authentication failed")
                }
                
                router.push("/dashboard")
            } catch (error) {
                console.error("Login error:", error)
                setError("Failed to sign in: " + (error as Error).message)
            } finally {
                setIsLoading(false)
            }
        }, 100)
    }

    // Add function to check if form is valid
    const isFormValid = () => {
        return email.trim() !== "" && password.trim() !== "";
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardContent className="p-8">
                    <div className="mb-6 text-center">
                        <h1 className="text-2xl font-bold">XLSX Analytics</h1>
                        <p className="text-muted-foreground mt-2">Sign in to your account</p>
                    </div>
                    <form onSubmit={handleSignIn}>
                        <div className="mb-6">
                            <Label htmlFor="email" className="text-left block mb-1">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="mb-6">
                            <Label htmlFor="password" className="text-left block mb-1">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                        </div>
                        <Button 
                            type="submit" 
                            variant="default"
                            className="w-full" 
                            disabled={isLoading || !isFormValid()}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : (
                                "Sign In"
                            )}
                        </Button>
                        
                        <Button 
                            type="button" 
                            variant="outline"
                            className="w-full mt-2" 
                            onClick={handleLoginAsReviewer}
                            disabled={isLoading}
                        >
                            {isLoading ? "Signing in..." : "Login as Interviewer"}
                        </Button>

                        {/* <div className="mt-4 text-center text-sm">
                            Don't have an account?{" "}
                            <a href="/signup" className="text-blue-600 hover:underline">
                                Sign up
                            </a>
                        </div> */}
                    </form>
                </CardContent>
            </Card>
        </div>
    )
} 