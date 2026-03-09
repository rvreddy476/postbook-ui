'use client';

import React, { useRef, useCallback, useState } from 'react';
import { Camera, Video, X, Plus, FileText } from 'lucide-react';

interface MediaUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
  isVideo: boolean;
  accentColor: string;
  isDarkMode?: boolean;
  altTexts?: Record<number, string>;
  onAltTextChange?: (index: number, value: string) => void;
}

const MediaUploader: React.FC<MediaUploaderProps> = ({ files, onChange, isVideo, accentColor, isDarkMode = false, altTexts = {}, onAltTextChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    onChange([...files, ...Array.from(e.dataTransfer.files)]);
  }, [files, onChange]);

  const removeFile = (index: number) => {
    onChange(files.filter((_, j) => j !== index));
  };

  const maxFiles = isVideo ? 1 : 4;
  const accept = isVideo ? 'video/*' : 'image/*';
  const formats = isVideo ? 'MP4, MOV, WebM' : 'JPG, PNG, WebP';
  const limits = isVideo ? '500 MB limit' : '20 MB each';
  const countLabel = isVideo ? 'Up to 5 minutes' : 'Up to 4 photos';

  if (files.length === 0) {
    return (
      <div className="animate-fadeIn">
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="relative rounded-xl p-8 text-center cursor-pointer transition-all duration-300 group border-2 border-dashed"
          style={{
            borderColor: isDragging ? accentColor : isDarkMode ? 'rgba(148,163,184,0.28)' : '#CBD5E1',
            background: isDragging ? `${accentColor}14` : isDarkMode ? '#10182D' : '#F8FAFC',
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
              style={{ background: `${accentColor}24` }}
            >
              {isVideo ? (
                <Video className="w-6 h-6" style={{ color: accentColor }} />
              ) : (
                <Camera className="w-6 h-6" style={{ color: accentColor }} />
              )}
            </div>
            <div>
              <p className={`text-[13px] font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                {isDragging ? 'Drop to upload' : isVideo ? 'Add your video' : 'Add photos'}
              </p>
              <p className={`text-[11px] mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Drag here or click to browse</p>
            </div>
            <div className="flex gap-1.5 flex-wrap justify-center">
              {[formats, countLabel, limits].map((label, i) => (
                <span
                  key={i}
                  className="px-2.5 py-[3px] rounded-full text-[9px] font-medium tracking-wide border"
                  style={{ background: `${accentColor}1A`, color: isDarkMode ? '#E2E8F0' : accentColor, borderColor: `${accentColor}50` }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={!isVideo}
          onChange={(e) => onChange([...files, ...Array.from(e.target.files || [])])}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-fadeIn">
      <div className={`grid gap-2 ${files.length === 1 ? '' : 'grid-cols-2'}`}>
        {files.map((f, i) => (
          <div key={i} className="space-y-1.5">
            <div
              className="relative group rounded-xl overflow-hidden border"
              style={{
                background: isDarkMode ? '#0F172A' : '#F8FAFC',
                borderColor: isDarkMode ? 'rgba(148,163,184,0.25)' : '#E2E8F0',
                aspectRatio: files.length === 1 ? '16/9' : '4/3',
              }}
            >
              {f.type?.startsWith('video') ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: isDarkMode ? '#0F172A' : '#F8FAFC' }}>
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: `${accentColor}24` }}
                  >
                    <Video className="w-5 h-5" style={{ color: accentColor }} />
                  </div>
                  <span className={`text-[10px] max-w-[80%] truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{f.name}</span>
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-full"
                    style={{ background: `${accentColor}26`, color: isDarkMode ? '#E2E8F0' : accentColor }}
                  >
                    {(f.size / 1048576).toFixed(1)} MB
                  </span>
                </div>
              ) : (
                <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
              )}
              <button
                onClick={() => removeFile(i)}
                className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Alt-text input for images */}
            {!f.type?.startsWith('video') && onAltTextChange && (
              <div
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border"
                style={{
                  borderColor: isDarkMode ? 'rgba(148,163,184,0.22)' : '#E2E8F0',
                  background: isDarkMode ? '#10182D' : '#F8FAFC',
                }}
              >
                <FileText className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={altTexts[i] ?? ''}
                  onChange={(e) => onAltTextChange(i, e.target.value)}
                  placeholder="Describe this image (alt text)"
                  maxLength={1000}
                  className={`flex-1 bg-transparent text-[11px] ${isDarkMode ? 'placeholder:text-slate-500' : 'placeholder:text-slate-400'} focus:outline-none`}
                  style={{ color: isDarkMode ? '#E2E8F0' : '#0F172A' }}
                />
              </div>
            )}
          </div>
        ))}
        {!isVideo && files.length < maxFiles && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all gap-1 ${
              isDarkMode ? 'hover:bg-white/10' : 'hover:bg-blue-50'
            }`}
            style={{ aspectRatio: '4/3', borderColor: isDarkMode ? 'rgba(148,163,184,0.25)' : '#CBD5E1' }}
          >
            <Plus className="w-5 h-5 text-slate-400" />
            <span className={`text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Add more</span>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={!isVideo}
        onChange={(e) => onChange([...files, ...Array.from(e.target.files || [])])}
        className="hidden"
      />
    </div>
  );
};

export default MediaUploader;
