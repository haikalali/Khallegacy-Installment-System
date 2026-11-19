import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Gamepad2,
  Home,
  Send,
  ShieldCheck,
  Smartphone,
  XCircle,
  PackageCheck,
} from 'lucide-react';

export type StatusTone = 'green' | 'orange' | 'red' | 'blue' | 'slate';

const TONE_MAP: Record<StatusTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  orange: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function resolveStatusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s === 'not ready' || s === 'not dispatched' || s === 'not received' || s === 'not posted') {
    return 'slate';
  }
  if (s === 'not yet' || s === 'not yet checking' || s === 'pending decision') {
    return 'slate';
  }
  if (
    s.includes('rejected') ||
    s.includes('failed') ||
    s.includes('out of stock') ||
    s === 'no stock' ||
    s === 'cancelled' ||
    s === 'inactive'
  ) {
    return 'red';
  }
  if (
    s.includes('dispatched') ||
    s.includes('ready to dispatch') ||
    s === 'ready to claim' ||
    s === 'submitted' ||
    s === 'out for delivery' ||
    s.includes('progress') ||
    s === 'postage'
  ) {
    return 'blue';
  }
  if (
    s.includes('approved') ||
    s.includes('passed') ||
    s.includes('received by jcl') ||
    s === 'delivered' ||
    s === 'received' ||
    s === 'claimed' ||
    s === 'ready' ||
    s === 'accept' ||
    s === 'confirmed' ||
    s === 'ok' ||
    s === 'active'
  ) {
    return 'green';
  }
  if (s === 'apple') {
    return 'slate';
  }
  if (s === 'android') {
    return 'green';
  }
  if (s === 'game&console') {
    return 'blue';
  }
  if (s === 'home appliance') {
    return 'orange';
  }
  if (
    s === 'in transit' ||
    s === 'stok otw' ||
    s.includes('wait') ||
    s.includes('pending') ||
    s.includes('awaiting') ||
    s.includes('belum ditentukan')
  ) {
    return 'orange';
  }
  return 'slate';
}

function getIcon(status: string) {
  const s = status.toLowerCase();
  if (
    s.includes('received by jcl') ||
    s === 'delivered' ||
    s === 'received' ||
    s.includes('passed') ||
    s === 'claimed' ||
    s === 'approved' ||
    s === 'ok' ||
    s === 'active' ||
    s === 'ready' ||
    s === 'accept' ||
    s === 'confirmed'
  ) {
    return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
  }
  if (
    s.includes('rejected') ||
    s.includes('failed') ||
    s.includes('out of stock') ||
    s === 'no stock' ||
    s === 'cancelled' ||
    s === 'inactive'
  ) {
    return <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
  }
  if (
    (s.includes('dispatched') && !s.includes('not')) ||
    s === 'submitted' ||
    s === 'out for delivery' ||
    s === 'postage'
  ) {
    return <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
  }
  if (s.includes('ready to dispatch') || s === 'ready to claim') {
    return <PackageCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
  }
  if (s.includes('progress')) {
    return <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
  }
  if (
    s === 'not yet' ||
    s === 'not yet checking' ||
    s === 'in transit' ||
    s === 'stok otw' ||
    s.includes('wait') ||
    s.includes('pending') ||
    s.includes('awaiting') ||
    s.includes('belum')
  ) {
    return <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
  }
  if (s === 'apple' || s === 'android') {
    return <Smartphone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
  }
  if (s === 'game&console') {
    return <Gamepad2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
  }
  if (s === 'home appliance') {
    return <Home className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
  }
  return <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
}

interface StatusBadgeProps {
  status: string;
  tone?: StatusTone;
  compact?: boolean;
  wrap?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  tone,
  compact = false,
  wrap = false,
}) => {
  const resolved = tone ?? resolveStatusTone(status);
  return (
    <span
      className={`inline-flex items-center gap-1 border rounded-md font-medium max-w-full ${
        wrap ? 'whitespace-normal leading-tight text-left' : 'whitespace-nowrap shrink-0'
      } ${
        compact ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs'
      } ${TONE_MAP[resolved]}`}
    >
      {getIcon(status)}
      <span>{status}</span>
    </span>
  );
};
