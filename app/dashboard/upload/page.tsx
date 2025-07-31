import { UploadClient } from "./upload-client";

export default function UploadPage() {
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