import { redirect } from "next/navigation";
import { UploadClient } from "./upload-client";
import { isAuthenticated } from "@/utils/auth/getUserInfoServer";

export default async function UploadPage() {
  const isAuth: boolean = await isAuthenticated();

  if (!isAuth) {
    return redirect("/");
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-lg">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Upload Excel File</h1>
            <p className="text-muted-foreground">
              Select an Excel file to analyze your data
            </p>
          </div>
          
          <UploadClient />
        </div>
      </div>
    </div>
  );
}