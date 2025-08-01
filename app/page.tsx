import { redirect } from "next/navigation"
import { getUserInfo } from "@/utils/auth/getUserInfoServer"
import LoginPage from "@/components/auth/LoginPage"

export default async function HomePage() {
    const userInfo = await getUserInfo()

    // If user is authenticated, redirect to dashboard
    if (userInfo) {
        redirect("/dashboard")
    }

    // If not authenticated, show login page
    return <LoginPage />
}
