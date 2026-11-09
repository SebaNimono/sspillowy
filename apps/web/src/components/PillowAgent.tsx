import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Camera,
  FileText,
  LayoutGrid,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
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

interface AttachedItem {
  name: string;
  size: number;
  type: string;
  isImage: boolean;
  dataUrl?: string;
  textSnippet?: string;
}

const GREETING = '¡Hola! ¿En qué deseas que te ayude hoy?';

export const PillowAgent: React.FC<PillowAgentProps> = ({ userEmail, page }) => {
  const userKey = userEmail?.trim().toLowerCase() || '';
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('ask');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quota, setQuota] = useState<PillowQuota | null>(null);
  const [chat, setChat] = useState<PillowChatLine[]>(() => loadPillowChat(userKey));
  const [attachment, setAttachment] = useState<AttachedItem | null>(null);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Manejo de archivo subido (máximo 1 archivo)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImg = file.type.startsWith('image/');
    const reader = new FileReader();

    if (isImg) {
      reader.onload = () => {
        setAttachment({
          name: file.name,
          size: file.size,
          type: file.type,
          isImage: true,
          dataUrl: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        const full = reader.result as string;
        setAttachment({
          name: file.name,
          size: file.size,
          type: file.type || 'text/plain',
          isImage: false,
          textSnippet: full.slice(0, 4000),
        });
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Captura de pantalla de la consola ("le permite capturar")
  const handleCaptureConsole = async () => {
    try {
      setCaptureNotice('Selecciona la ventana o pestaña para capturar...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        preferCurrentTab: true,
      } as any);

      const track = stream.getVideoTracks()[0];
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

      track.stop();
      stream.getTracks().forEach((t) => t.stop());

      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      setAttachment({
        name: `captura_consola_${page}.jpg`,
        size: Math.round(dataUrl.length * 0.75),
        type: 'image/jpeg',
        isImage: true,
        dataUrl,
      });

      setCaptureNotice('Captura realizada y adjunta. Puedes preguntar sobre ella.');
      setTimeout(() => setCaptureNotice(null), 4000);
    } catch (err) {
      setCaptureNotice(null);
      console.warn('Captura cancelada o permiso denegado:', err);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !attachment) || sending) return;
    if (!userKey) {
      setChat((prev) => [...prev, { role: 'pillow', text: 'Inicia sesión para usar Pillow y contar tus créditos diarios.' }]);
      return;
    }

    const currentAttached = attachment;
    const history = chat.slice(-8).map(({ role, text: t }) => ({ role, text: t }));
    setSending(true);
    setInput('');
    setAttachment(null);

    // Texto visual del mensaje del usuario
    let userDisplayText = text;
    if (!userDisplayText && currentAttached) {
      userDisplayText = `[Adjunto: ${currentAttached.name}] Analiza este archivo/captura en relación a la pantalla actual.`;
    }

    setChat((prev) => [
      ...prev,
      {
        role: 'user',
        text: userDisplayText,
        page,
        attachmentInfo: currentAttached
          ? {
              name: currentAttached.name,
              isImage: currentAttached.isImage,
              dataUrl: currentAttached.dataUrl,
            }
          : undefined,
      } as any,
    ]);

    // Contexto extendido con el adjunto
    const baseContext = getPillowPageContext(page) || {};
    const pageContextWithAttachment = {
      ...baseContext,
      ...(currentAttached
        ? {
            attached_file: {
              name: currentAttached.name,
              type: currentAttached.type,
              size_bytes: currentAttached.size,
              text_preview: currentAttached.textSnippet,
              has_image: currentAttached.isImage,
            },
          }
        : {}),
    };

    try {
      const res = await sendPillowMessage({
        message: userDisplayText,
        user_key: userKey,
        page,
        page_context: pageContextWithAttachment,
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
                  {[{ role: 'pillow', text: GREETING } as PillowChatLine, ...chat].map((line: any, i) => (
                    <div key={i} className={`pillow-chat-line pillow-chat-line--${line.role}`}>
                      <p>{line.text}</p>

                      {/* Vista previa de archivo adjunto enviado */}
                      {line.attachmentInfo && (
                        <div className="pillow-chat-attachment-bubble">
                          {line.attachmentInfo.isImage && line.attachmentInfo.dataUrl ? (
                            <img
                              src={line.attachmentInfo.dataUrl}
                              alt={line.attachmentInfo.name}
                              className="pillow-chat-thumb"
                            />
                          ) : (
                            <div className="pillow-chat-doc-icon">
                              <FileText size={16} />
                            </div>
                          )}
                          <span>{line.attachmentInfo.name}</span>
                        </div>
                      )}

                      {isDashboard && line.suggestions?.length ? (
                        <div className="pillow-suggestions">
                          {line.suggestions.map((s: any) => (
                            <button key={`${s.type}-${s.title}`} type="button" onClick={() => addSuggestion(s)}>
                              + {s.title}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {/* Efecto fluido cuadrado como analizando eso */}
                  {sending && (
                    <div className="pillow-analyzing-card" aria-live="polite">
                      <div className="pillow-scanning-box">
                        <div className="pillow-scan-corner c-tl" />
                        <div className="pillow-scan-corner c-tr" />
                        <div className="pillow-scan-corner c-bl" />
                        <div className="pillow-scan-corner c-br" />
                        <div className="pillow-scan-grid" />
                        <div className="pillow-scan-laser" />
                      </div>
                      <div className="pillow-analyzing-text">
                        <strong className="pillow-analyzing-status">Pillow está analizando…</strong>
                        <span className="pillow-analyzing-sub">Examinando pantalla, hallazgos y contexto de seguridad</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {captureNotice && (
                  <div className="pillow-capture-toast">
                    <Sparkles size={13} />
                    <span>{captureNotice}</span>
                  </div>
                )}

                <div className="pillow-suggestion-chips">
                  {suggestionsFor(page).map((s) => (
                    <button key={s} type="button" onClick={() => setInput(s)}>
                      {s}
                    </button>
                  ))}
                </div>

                {/* Banner de archivo adjunto preparado para enviar (máximo 1) */}
                {attachment && (
                  <div className="pillow-attachment-chip">
                    {attachment.isImage && attachment.dataUrl ? (
                      <img src={attachment.dataUrl} alt="Vista previa" className="pillow-chip-thumb" />
                    ) : (
                      <FileText size={16} color="#0284c7" />
                    )}
                    <span className="pillow-chip-name" title={attachment.name}>
                      {attachment.name} ({Math.round(attachment.size / 1024)} KB)
                    </span>
                    <button
                      type="button"
                      className="pillow-chip-remove"
                      onClick={() => setAttachment(null)}
                      title="Quitar archivo"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                <div className="pillow-input-wrapper">
                  <textarea
                    rows={2}
                    placeholder={`Pregunta a Pillow sobre ${pageLabel}…`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />

                  <div className="pillow-input-footer">
                    <div className="pillow-attachment-tools">
                      {/* Subir 1 archivo (máximo 1) */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                        accept="image/*,.txt,.json,.log,.py,.ts,.tsx,.dart,.md,.yml,.yaml,.csv"
                      />
                      <button
                        type="button"
                        className="pillow-tool-btn"
                        onClick={() => fileInputRef.current?.click()}
                        title="Subir archivo o imagen (máximo 1)"
                      >
                        <Paperclip size={16} />
                      </button>

                      {/* Captura de pantalla de la consola ("le permite capturar") */}
                      <button
                        type="button"
                        className="pillow-tool-btn"
                        onClick={handleCaptureConsole}
                        title="Capturar pantalla de la consola (le permite capturar la vista actual para consultar sobre ella)"
                      >
                        <Camera size={16} />
                      </button>
                    </div>

                    <button
                      type="button"
                      className="pillow-send"
                      disabled={sending || (!input.trim() && !attachment)}
                      onClick={() => void handleSend()}
                      aria-label="Enviar"
                    >
                      <ArrowUp size={18} />
                    </button>
                  </div>
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
