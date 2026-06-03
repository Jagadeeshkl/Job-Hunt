'use client';

import { useEffect, useRef, useState } from 'react';

interface ResumeMeta {
  exists: boolean;
  name?: string;
  size?: number;
  uploadedAt?: string;
}

export function ResumeUpload() {
  const [meta, setMeta] = useState<ResumeMeta | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/resume')
      .then(r => r.json())
      .then(setMeta)
      .catch(() => setMeta({ exists: false }));
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const form = new FormData();
    form.append('resume', file);

    try {
      const res = await fetch('/api/resume', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setMeta({ exists: true, name: data.name, size: data.size, uploadedAt: data.uploadedAt });
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  }

  function formatSize(bytes?: number) {
    if (!bytes) return '';
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="flex items-center gap-3">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleUpload}
      />

      {meta?.exists ? (
        /* Resume exists — show compact card */
        <div className="flex items-center gap-2.5 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2">
          <div className="w-7 h-7 bg-red-900/60 border border-red-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-200 truncate max-w-[160px]">{meta.name}</p>
            <p className="text-[10px] text-gray-500">
              {formatSize(meta.size)}
              {meta.uploadedAt && ` · ${new Date(meta.uploadedAt).toLocaleDateString()}`}
            </p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            title="Replace resume"
            className="ml-1 text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
        </div>
      ) : (
        /* No resume — show upload button */
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-900 hover:bg-gray-800 border border-dashed border-gray-600 hover:border-indigo-500 rounded-xl text-xs text-gray-400 hover:text-gray-200 transition-all"
        >
          {uploading ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5 text-indigo-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Uploading…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Resume
            </>
          )}
        </button>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
