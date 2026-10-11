import React from 'react';
import { Mail, Webhook, Workflow, Zap } from 'lucide-react';
import type { RepoProvider } from '../api/client';
import { ProviderLogo } from './ProviderLogo';

export type LogoId =
  | RepoProvider
  | 'github-auto'
  | 'pipeline'
  | 'email'
  | 'slack'
  | 'teams'
  | 'google-chat'
  | 'webhooks'
  | 'jira'
  | 'linear'
  | 'pagerduty'
  | 'prometheus';

const Letter: React.FC<{ bg: string; letter: string; size: number }> = ({ bg, letter, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="1" y="1" width="22" height="22" fill={bg} />
    <text x="12" y="17" textAnchor="middle" fontSize="14" fontWeight="700" fontFamily="Arial, sans-serif" fill="#fff">
      {letter}
    </text>
  </svg>
);

const Mark: React.FC<{ id: LogoId; size: number }> = ({ id, size }) => {
  switch (id) {
    case 'github':
    case 'gitlab':
    case 'bitbucket':
    case 'azure':
    case 'other':
      return <ProviderLogo provider={id} size={size} />;
    case 'github-auto':
      return (
        <span className="il-stack">
          <ProviderLogo provider="github" size={size} />
          <Zap size={Math.round(size * 0.5)} className="il-badge" />
        </span>
      );
    case 'pipeline':
      return <Workflow size={size} color="#0969da" />;
    case 'email':
      return <Mail size={size} color="#57606a" />;
    case 'webhooks':
      return <Webhook size={size} color="#8250df" />;
    case 'slack':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9" y="1" width="3.6" height="10" rx="1.8" fill="#36C5F0" />
          <rect x="1" y="11.4" width="10" height="3.6" rx="1.8" fill="#E01E5A" />
          <rect x="11.4" y="13" width="3.6" height="10" rx="1.8" fill="#ECB22E" />
          <rect x="13" y="9" width="10" height="3.6" rx="1.8" fill="#2EB67D" />
        </svg>
      );
    case 'teams':
      return <Letter bg="#5059C9" letter="T" size={size} />;
    case 'google-chat':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#00AC47" d="M2 3h20v14H9l-5 4v-4H2z" />
          <path fill="#fff" d="M7 8h10v1.6H7zm0 3.2h7v1.6H7z" />
        </svg>
      );
    case 'jira':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#2684FF" d="M12 1 23 12 12 23 9 20l8-8-8-8z" />
          <path fill="#0052CC" d="M12 7 7 12l5 5-3 3-8-8 8-8z" />
        </svg>
      );
    case 'linear':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="11" fill="#5E6AD2" />
          <path stroke="#fff" strokeWidth="1.8" d="M5 13.5 10.5 19M5 9.5 14.5 19M7 6l11 11M10.5 5 19 13.5" />
        </svg>
      );
    case 'pagerduty':
      return <Letter bg="#06AC38" letter="P" size={size} />;
    case 'prometheus':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="11" fill="#E6522C" />
          <path fill="#fff" d="M12 4.5c1 2.2 3.5 3.6 3.5 6.6 0 1.6-.8 2.8-1.8 3.4.3-1.3-.4-2.4-1.7-3.4-.2 1.3-1.6 1.8-1.6 3.4-1-.6-1.9-1.8-1.9-3.3 0-2.8 3.1-3.9 3.5-6.7zM7.5 16h9v1.6h-9zm1.5 2.4h6V20H9z" />
        </svg>
      );
  }
};

export const IntegrationLogo: React.FC<{ id: LogoId; size?: number }> = ({ id, size = 26 }) => (
  <span className="il-tile" style={{ width: size + 16, height: size + 16 }}>
    <Mark id={id} size={size} />
  </span>
);
