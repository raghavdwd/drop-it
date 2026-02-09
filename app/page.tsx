import FileUpload06 from "@/components/file-upload-06";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen justify-center">
      <div className="flex flex-col items-center justify-center gap-4 border p-10 rounded-lg m-30 ml-40">
        <h1 className="text-4xl font-bold">Welcome to Drop It!</h1>
        <p className="text-lg text-gray-600">
          A simple file sharing app built with Next.js and TypeScript.
        </p>
        <form>
          <FileUpload06 />
        </form>
      </div>
    </div>
  );
}
