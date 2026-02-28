'use client';

import React from 'react';
import { X } from 'lucide-react';

export interface PollState {
  options: string[];
  duration: string;
  allowMultiple: boolean;
}

interface PollEditorProps {
  poll: PollState;
  onChange: (poll: PollState) => void;
  accentColor: string;
}

const PollEditor: React.FC<PollEditorProps> = ({ poll, onChange, accentColor }) => {
  const updateOption = (index: number, value: string) => {
    const newOpts = [...poll.options];
    newOpts[index] = value;
    onChange({ ...poll, options: newOpts });
  };

  const removeOption = (index: number) => {
    onChange({ ...poll, options: poll.options.filter((_, j) => j !== index) });
  };

  const addOption = () => {
    if (poll.options.length < 5) {
      onChange({ ...poll, options: [...poll.options, ''] });
    }
  };

  return (
    <div className="space-y-2 animate-fadeIn">
      {poll.options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{ background: '#FAF5F0', color: accentColor }}
          >
            {String.fromCharCode(65 + i)}
          </span>
          <input
            value={opt}
            onChange={(e) => updateOption(i, e.target.value)}
            placeholder={`Option ${String.fromCharCode(65 + i)}`}
            className="flex-1 rounded-xl px-3.5 py-2.5 text-[13px] placeholder:text-[#D4C4B0] focus:outline-none focus:ring-1 transition-all"
            style={{
              background: '#FAFAFA',
              border: '1px solid #F0E6DC',
              color: '#3C2415',
              '--tw-ring-color': `${accentColor}30`,
            } as React.CSSProperties}
          />
          {poll.options.length > 2 && (
            <button
              onClick={() => removeOption(i)}
              className="text-[#C4B5A6] hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-4 ml-9">
        {poll.options.length < 5 && (
          <button
            onClick={addOption}
            className="text-[11px] font-semibold transition-colors"
            style={{ color: accentColor }}
          >
            + Add option
          </button>
        )}
        <select
          value={poll.duration}
          onChange={(e) => onChange({ ...poll, duration: e.target.value })}
          className="rounded-lg px-2 py-1 text-[10px] focus:outline-none cursor-pointer"
          style={{ background: '#FAFAFA', border: '1px solid #F0E6DC', color: '#6B4F3E' }}
        >
          <option value="1d">1 Day</option>
          <option value="3d">3 Days</option>
          <option value="7d">7 Days</option>
        </select>
        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{ color: '#6B4F3E' }}>
          <input
            type="checkbox"
            checked={poll.allowMultiple}
            onChange={(e) => onChange({ ...poll, allowMultiple: e.target.checked })}
            className="rounded scale-75 accent-[#7B5B3A]"
          />
          Multi-vote
        </label>
      </div>
    </div>
  );
};

export default PollEditor;
