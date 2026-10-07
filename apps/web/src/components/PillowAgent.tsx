import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Sparkles, X, LayoutGrid, MessageSquare, RotateCcw } from 'lucide-react';
import {
  fetchPillowAdminStatus,
  fetchPillowQuota,
  sendPillowMessage,
  PillowQuota,
  PillowWidgetSuggestion,
} from '../api/client';
import {
  PillowWidgetType,
  addPlacedWidget,
  createPlacedWidget,
  groupCatalogByCategory,
} from '../config/pillowWidgets';
import {
  PILLOW_PAGE_LABEL,
  PillowChatLine,
  getPillowPageContext,
  loadPillowChat,
  savePillowChat,
  suggestionsFor,
} from '../config/pillowContext';
import { PillowAdminPanel } from './PillowAdminPanel';

interface PillowAgentProps {
  userEmail?: string;
  page: string;
}

type Tab = 'ask' | 'widgets';

const GREETING =
  'Hola, soy Pillow. Te acompaño en todas las secciones: pregúntame qué significa lo que ves, qué atender primero o cómo corregirlo.';

export const PillowAgent: React.FC<PillowAgentProps> = ({ userEmail, page }) => {
  const userKey = userEmail?.trim().toLowerCase() || '';
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('ask');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quota, setQuota] = useState<PillowQuota | null>(null);
  const [chat, setChat] = useState<PillowChatLine[]>(() => loadPillowChat(userKey));
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isDashboard = page === 'dashboard';
  const pageLabel = PILLOW_PAGE_LABEL[page] ?? 'SSPILLOWY';

  useEffect(() => {
    savePillowChat(userKey, chat);
  }, [userKey, chat]);

  useEffect(() => {
    if (!isDashboard) setTab('ask');
  }, [isDashboard]);

  useEffect(() => {
    if (open) chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [open, chat, sending]);

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

    const history = chat.slice(-8).map(({ role, text: t }) => ({ role, text: t }));
    setSending(true);
    setInput('');
    setChat((prev) => [...prev, { role: 'user', text, page }]);

    try {
      const res = await sendPillowMessage({
        message: text,
        user_key: userKey,
        page,
        page_context: getPillowPageContext(page),
        history,
      });
      setChat((prev) => [...prev, { role: 'pillow', text: res.reply, page, suggestions: res.suggested_widgets }]);
      setQuota((q) =>
        q
          ? { ...q, credits_remaining: res.credits_remaining, credits_used: res.daily_limit - res.credits_remaining }
          : q,
      );
    } catch (err) {
      setChat((prev) => [
        ...prev,
        { role: 'pillow', text: err instanceof Error ? err.message : 'No pude responder ahora.', page },
      ]);
    } finally {
      setSending(false);
    }
  };

  const addFromCatalog = (type: PillowWidgetType, title: string) => {
    addPlacedWidget(createPlacedWidget(type, title));
    setTab('ask');
    setChat((prev) => [...prev, { role: 'pillow', text: `Añadí «${title}» (${type}) a tu tablero.`, page }]);
  };

  const addSuggestion = (s: PillowWidgetSuggestion) => {
    addPlacedWidget(createPlacedWidget(s.type as PillowWidgetType, s.title, s.metric ?? undefined));
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
                <span className="pillow-panel-kicker">Agente IA · HITL · {pageLabel}</span>
                <h2>Pillow</h2>
              </div>
              <div className="pillow-panel-actions">
                {chat.length > 0 && (
                  <button
                    type="button"
                    className="pillow-panel-close"
                    onClick={() => setChat([])}
                    aria-label="Nueva conversación"
                    title="Nueva conversación"
                  >
                    <RotateCcw size={16} />
                  </button>
                )}
                <button type="button" className="pillow-panel-close" onClick={() => setOpen(false)} aria-label="Cerrar">
                  <X size={18} />
                </button>
              </div>
            </header>

            {quota && (
              <div className="pillow-quota">
                <span>
                  Créditos hoy: <strong>{quota.credits_remaining}</strong> / {quota.daily_limit}
                </span>
                {!quota.configured && <em>Pillow aún no está activado en el servidor</em>}
                {isAdmin && <PillowAdminPanel adminEmail={userKey} onCreditsReset={refreshQuota} />}
              </div>
            )}

            {isDashboard && (
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
            )}

            {tab === 'ask' ? (
              <div className="pillow-ask">
                <div className="pillow-chat">
                  {[{ role: 'pillow', text: GREETING } as PillowChatLine, ...chat].map((line, i) => (
                    <div key={i} className={`pillow-chat-line pillow-chat-line--${line.role}`}>
                      {line.role === 'user' && line.page && line.page !== page && (
                        <span className="pillow-chat-origin">desde {PILLOW_PAGE_LABEL[line.page] ?? line.page}</span>
                      )}
                      <p>{line.text}</p>
                      {isDashboard && line.suggestions?.length ? (
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
                  <div ref={chatEndRef} />
                </div>

                <div className="pillow-suggestion-chips">
                  {suggestionsFor(page).map((s) => (
                    <button key={s} type="button" onClick={() => setInput(s)}>
                      {s}
                    </button>
                  ))}
                </div>

                <div className="pillow-input-row">
                  <textarea
                    rows={3}
                    placeholder={`Pregunta sobre ${pageLabel}…`}
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
