import type { Metadata } from 'next';
import './globals.css';
import { ResumeUpload } from '../components/ResumeUpload';

export const metadata: Metadata = {
  title: 'Job Agent Dashboard',
  description: 'Autonomous AI job application tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0f0f13] text-gray-100">
        <header className="border-b border-gray-800 px-6 py-3 flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <h1 className="text-lg font-semibold tracking-tight">Job Agent</h1>
          <div className="flex items-center gap-2 ml-3">
            <span className="pill bg-indigo-900/50 border border-indigo-700 text-indigo-300">Chennai</span>
            <span className="pill bg-indigo-900/50 border border-indigo-700 text-indigo-300">Bangalore</span>
          </div>
          <div className="ml-auto">
            <ResumeUpload />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
