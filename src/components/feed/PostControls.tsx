'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { CodeXml, EyeOff, Pin, ShieldAlert, SlidersHorizontal, Trash2, UserRoundX, VolumeX, type LucideIcon } from 'lucide-react';
import './post-controls.css';

export interface PostControlsProps {
  own: boolean;
  pinned: boolean;
  deleting: boolean;
  onRecommend: () => void;
  onHide: () => void;
  onMute: () => void;
  onEmbed: () => void;
  onReport: () => void;
  onBlock: () => void;
  onPin: () => void;
  onDelete: () => void;
  onClose: (restoreFocus?: boolean) => void;
  anchorRef?: RefObject<HTMLDivElement | null>;
}

export default function PostControls(props: PostControlsProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    const reposition = () => {
      const element = panel.current;
      const anchor = props.anchorRef?.current;
      if (!element || !anchor) return;
      const nav = document.querySelector('[aria-label="Primary mobile navigation"]');
      const navRect = nav?.getBoundingClientRect();
      const bottom = navRect && navRect.height > 0 ? Math.min(innerHeight, navRect.top) : innerHeight;
      const normalTop = anchor.getBoundingClientRect().bottom + 8;
      const top = Math.max(8, Math.min(normalTop, bottom - element.offsetHeight - 8));
      setOffset(top - normalTop);
    };
    reposition();
    const observer = new ResizeObserver(reposition);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [props.anchorRef]);
  const actions: Array<{ label: string; icon: LucideIcon; run: () => void; danger?: boolean; disabled?: boolean }> = props.own
    ? [
        { label: props.pinned ? 'Unpin update' : 'Pin update', icon: Pin, run: props.onPin },
        { label: 'Delete update', icon: Trash2, run: props.onDelete, danger: true, disabled: props.deleting },
      ]
    : [
        { label: 'Recommend similar', icon: SlidersHorizontal, run: props.onRecommend },
        { label: 'Hide this update', icon: EyeOff, run: props.onHide },
        { label: 'Mute this author', icon: VolumeX, run: props.onMute },
        { label: 'Copy embed code', icon: CodeXml, run: props.onEmbed },
        { label: 'Report a concern', icon: ShieldAlert, run: props.onReport, danger: true },
        { label: 'Block this account', icon: UserRoundX, run: props.onBlock, danger: true },
      ];

  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, []);

  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      props.onClose(true);
      return;
    } else return;
    event.preventDefault();
    buttons[next]?.focus();
  };

  return (
    <div ref={panel} role="menu" aria-label="Post controls" className="post-controls" style={{ position: 'relative', top: offset }} onKeyDown={navigate}
      onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) props.onClose(); }}>
      <div className="post-controls-heading" aria-hidden="true">{props.own ? 'Manage update' : 'Post controls'}</div>
      {actions.map(({ label, icon: Icon, run, danger, disabled }) => (
        <button key={label} type="button" role="menuitem" aria-label={label} tabIndex={-1}
          disabled={disabled} onClick={run} className="post-controls-action" data-danger={danger || undefined}>
          <span className="post-controls-symbol"><Icon size={17} aria-hidden="true" /></span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
