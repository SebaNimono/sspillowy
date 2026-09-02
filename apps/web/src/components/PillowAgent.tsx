import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUp, Sparkles, X, LayoutGrid, MessageSquare } from 'lucide-react';
import {
  DashboardStats,
  fetchPillowAdminStatus,
  fetchPillowQuota,
  sendPillowMessage,
  PillowQuota,
  PillowWidgetSuggestion,
} from '../api/client';
import {
  PlacedPillowWidget,
  PILLOW_SUGGESTIONS,
  PillowWidgetType,
  createPlacedWidget,
  groupCatalogByCategory,
} from '../config/pillowWidgets';
import { PillowAdminPanel } from './PillowAdminPanel';

interface PillowAgentProps {
  userEmail?: string;
  dashboardContext?: DashboardStats | null;
  onAddWidget: (widget: PlacedPillowWidget) => void;
}

type Tab = 'ask' | 'widgets';

interface ChatLine {
  role: 'user' | 'pillow';
  text: string;
  suggestions?: PillowWidgetSuggestion[];
}

export const PillowAgent: React.FC<PillowAgentProps> = ({ userEmail, dashboardContext, onAddWidget }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('ask');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quota, setQuota] = useState<PillowQuota | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([
    {
      role: 'pillow',
      text: 'Hola, soy Pillow. Pregúntame qué métricas quieres ver o añade widgets desde la pestaña lateral.',
    },
  ]);

  const userKey = userEmail?.trim().toLowerCase() || '';

  const refreshQuota = () => {
    if (!userKey) return;
    fetchPillowQuota(userKey)
      .then(setQuota)
      .catch(() => setQuota(null));
  };

  useEffect(() => {
    if (!open || !userKey) {
      setIsAdmin(false);
      return;
    }
    refreshQuota();
    fetchPillowAdminStatus(userKey)
      .then((r) => setIsAdmin(r.is_admin))
      .catch(() => setIsAdmin(false));
  }, [open, userKey]);

  const grouped = useMemo(() => groupCatalogByCategory(), []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (!userKey) {
      setChat((prev) => [...prev, { role: 'pillow', text: 'Inicia sesión para usar Pillow y contar tus créditos diarios.' }]);
      return;
    }

    setSending(true);
    setInput('');
    setChat((prev) => [...prev, { role: 'user', text }]);

    try {
      const res = await sendPillowMessage({
        message: text,
        user_key: userKey,
        dashboard_context: dashboardContext ? { ...dashboardContext } : undefined,
      });
      setChat((prev) => [
        ...prev,
        { role: 'pillow', text: res.reply, suggestions: res.suggested_widgets },
      ]);
      setQuota((q) =>
        q
          ? { ...q, credits_remaining: res.credits_remaining, credits_used: res.daily_limit - res.credits_remaining }
          : q,
      );
    } catch (err) {
      setChat((prev) => [
        ...prev,
        { role: 'pillow', text: err instanceof Error ? err.message : 'No pude responder ahora.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const addFromCatalog = (type: PillowWidgetType, title: string) => {
    onAddWidget(createPlacedWidget(type, title));
    setTab('ask');
    setChat((prev) => [...prev, { role: 'pillow', text: `Añadí «${title}» (${type}) a tu tablero.` }]);
  };

  const addSuggestion = (s: PillowWidgetSuggestion) => {
    onAddWidget(createPlacedWidget(s.type as PillowWidgetType, s.title, s.metric ?? undefined));
  };

  return (
    <>
      <button type="button" className="pillow-fab" onClick={() => setOpen(true)} title="Abrir Pillow">
        <Sparkles size={18} />
        <span>Pillow</span>
      </button>

      {open && (
        <div className="pillow-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <aside className="pillow-panel" onClick={(e) => e.stopPropagation()} aria-label="Agente Pillow">
            <header className="pillow-panel-head">
              <div>
                <span className="pillow-panel-kicker">Agente IA · HITL</span>
                <h2>Pillow</h2>
              </div>
              <button type="button" className="pillow-panel-close" onClick={() => setOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>

            {quota && (
              <div className="pillow-quota">
                <span>
                  Créditos hoy: <strong>{quota.credits_remaining}</strong> / {quota.daily_limit}
                </span>
                {!quota.configured && <em>API Gemini pendiente en servidor</em>}
                {isAdmin && (
                  <PillowAdminPanel adminEmail={userKey} onCreditsReset={refreshQuota} />
                )}
              </div>
            )}

            <div className="pillow-tabs">
              <button type="button" className={tab === 'ask' ? 'is-active' : ''} onClick={() => setTab('ask')}>
                <MessageSquare size={14} />
                Preguntar
              </button>
              <button type="button" className={tab === 'widgets' ? 'is-active' : ''} onClick={() => setTab('widgets')}>
                <LayoutGrid size={14} />
                Widgets
              </button>
            </div>

            {tab === 'ask' ? (
              <div className="pillow-ask">
                <div className="pillow-chat">
                  {chat.map((line, i) => (
                    <div key={i} className={`pillow-chat-line pillow-chat-line--${line.role}`}>
                      <p>{line.text}</p>
                      {line.suggestions?.length ? (
                        <div className="pillow-suggestions">
                          {line.suggestions.map((s) => (
                            <button key={`${s.type}-${s.title}`} type="button" onClick={() => addSuggestion(s)}>
                              + {s.title}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {sending && (
                    <div className="pillow-chat-line pillow-chat-line--pillow pillow-chat-line--typing" aria-live="polite">
                      <span className="pillow-typing-dots">
                        <span />
                        <span />
                        <span />
                      </span>
                      <span className="pillow-typing-label">Pillow está pensando…</span>
                    </div>
                  )}
                </div>

                <div className="pillow-suggestion-chips">
                  {PILLOW_SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => setInput(s)}>
                      {s}
                    </button>
                  ))}
                </div>

                <div className="pillow-input-row">
                  <textarea
                    rows={3}
                    placeholder="Describe qué quieres entender en tu dashboard de seguridad…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="pillow-send"
                    disabled={sending || !input.trim()}
                    onClick={() => void handleSend()}
                    aria-label="Enviar"
                  >
                    <ArrowUp size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="pillow-widget-tray">
                <input type="search" className="pillow-widget-search" placeholder="Buscar widgets…" disabled />
                {Object.entries(grouped).map(([category, items]) => (
                  <section key={category}>
                    <h3>{category}</h3>
                    <ul>
                      {items.map((item) => (
                        <li key={item.type}>
                          <button type="button" onClick={() => addFromCatalog(item.type, item.label)}>
                            <span className="pillow-widget-icon" />
                            <span>
                              <strong>{item.label}</strong>
                              <em>{item.description}</em>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
};
