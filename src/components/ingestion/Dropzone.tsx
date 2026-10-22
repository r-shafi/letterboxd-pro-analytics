import React, { useRef, useState } from 'react';
import { UploadCloud, FileArchive, FolderOpen, Shield, Key, Sparkles } from 'lucide-react';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  onCsvFilesSelect: (files: Record<string, string>) => void;
  onOpenSettings: () => void;
  onLoadDemo?: () => void;
  disabled?: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileSelect,
  onCsvFilesSelect,
  onOpenSettings,
  onLoadDemo,
  disabled = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvFilesInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      // Check if it's a zip file
      const zipFile = files.find((f) => f.name.endsWith('.zip'));
      if (zipFile) {
        onFileSelect(zipFile);
        return;
      }

      // Check if multiple CSVs dropped
      const csvFiles = files.filter((f) => f.name.endsWith('.csv'));
      if (csvFiles.length > 0) {
        const fileContents: Record<string, string> = {};
        for (const file of csvFiles) {
          fileContents[file.name] = await file.text();
        }
        onCsvFilesSelect(fileContents);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleCsvsInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const fileContents: Record<string, string> = {};
      for (const file of files) {
        fileContents[file.name] = await file.text();
      }
      onCsvFilesSelect(fileContents);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
          isDragOver
            ? 'border-[#00e054] bg-[#00e054]/5 scale-[1.01]'
            : 'border-[#2c3440] bg-[#1b2026] hover:border-[#00e054]/50'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2c3440]/60 text-[#00e054]">
          <UploadCloud className="h-8 w-8" />
        </div>

        <h3 className="mt-4 font-display text-xl font-bold text-white">
          Drop your Letterboxd export here
        </h3>
        <p className="mt-2 text-sm text-[#99aabb]">
          Drop your official <span className="font-mono text-[#ccdde6]">.zip</span> archive, or select your extracted CSV files
        </p>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#00e054] px-4 py-2.5 text-sm font-bold text-[#14181c] shadow hover:bg-[#00c047] transition-all"
          >
            <FileArchive className="h-4 w-4" />
            Select .zip archive
          </button>

          <input
            ref={csvFilesInputRef}
            type="file"
            accept=".csv"
            multiple
            className="hidden"
            onChange={handleCsvsInputChange}
          />
          <button
            onClick={() => csvFilesInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2c3440] bg-[#222831] px-4 py-2.5 text-sm font-medium text-white hover:border-[#40bcf4] hover:text-[#40bcf4] transition-all"
          >
            <FolderOpen className="h-4 w-4" />
            Select CSVs
          </button>

          {onLoadDemo && (
            <button
              onClick={onLoadDemo}
              className="inline-flex items-center gap-2 rounded-lg border border-[#ff8000]/40 bg-[#ff8000]/10 px-4 py-2.5 text-sm font-semibold text-[#ff8000] hover:bg-[#ff8000]/20 hover:border-[#ff8000] transition-all"
            >
              <Sparkles className="h-4 w-4" />
              Try Demo Data (Instant)
            </button>
          )}
        </div>

        {/* Help & Privacy banner */}
        <div className="mt-8 flex flex-col items-center justify-between border-t border-[#2c3440] pt-6 sm:flex-row w-full text-xs text-[#99aabb] gap-3">
          <div className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-[#00e054]" />
            <span>100% In-Browser. No account or server required.</span>
          </div>

          <button
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1 text-[#40bcf4] hover:underline"
          >
            <Key className="h-3.5 w-3.5" />
            <span>Custom TMDb Key (BYOK)</span>
          </button>
        </div>
      </div>

      {/* Instructions callout */}
      <div className="mt-6 rounded-lg border border-[#2c3440] bg-[#14181c] p-4 text-xs text-[#99aabb]">
        <div className="font-semibold text-white">How to get your Letterboxd data export:</div>
        <ol className="mt-2 list-decimal pl-4 space-y-1">
          <li>Log in to your account at <a href="https://letterboxd.com" target="_blank" rel="noopener noreferrer" className="text-[#00e054] hover:underline">letterboxd.com</a>.</li>
          <li>Navigate to <strong>Account Settings &rarr; Data</strong>.</li>
          <li>Click <strong>&ldquo;Export your data&rdquo;</strong> to download your official zip archive.</li>
        </ol>
      </div>
    </div>
  );
};
