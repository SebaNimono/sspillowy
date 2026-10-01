import React from 'react';
import { ArrowRight, CheckCircle2, Rocket } from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { RoadmapModule, STAGE_LABEL } from '../config/roadmap';
import '../styles/roadmap.css';

interface ComingSoonPageProps {
  module: RoadmapModule;
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

export const ComingSoonPage: React.FC<ComingSoonPageProps> = ({ module, onNavigate, ...headerProps }) => (
  <div>
    <Header title={module.title} subtitle={module.tagline} onNavigate={onNavigate} {...headerProps} />

    <div className="card rm-hero">
      <div className="rm-hero-icon">
        <Rocket size={26} />
      </div>
      <div>
        <span className={`rm-stage is-${module.stage}`}>{STAGE_LABEL[module.stage]}</span>
        <h2>{module.title}</h2>
        <p>{module.description}</p>
      </div>
    </div>

    <div className="rm-grid">
      <section className="card rm-card">
        <h3>Qué podrás hacer</h3>
        <ul className="rm-features">
          {module.features.map((f) => (
            <li key={f}>
              <CheckCircle2 size={16} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card rm-card">
        <h3>Cómo funcionará</h3>
        <ol className="rm-how">
          {module.howItWorks.map((s, i) => (
            <li key={s}>
              <span>{i + 1}</span>
              <p>{s}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>

    {module.meanwhile && (
      <div className="card rm-meanwhile">
        <p>
          <strong>Mientras tanto</strong> puedes usar lo que ya está disponible en la plataforma.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => onNavigate?.(module.meanwhile!.tab)}>
          <span>{module.meanwhile.label}</span>
          <ArrowRight size={15} />
        </button>
      </div>
    )}
  </div>
);
