import React, { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Search, X } from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { useI18n } from '../i18n/I18nProvider';
import { CATEGORY_META, CONCEPTS, Concept, ConceptCategory } from '../config/concepts';
import '../styles/concepts.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

const CATEGORIES = Object.keys(CATEGORY_META) as ConceptCategory[];

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const ConceptsPage: React.FC<PageProps> = ({
  sidebarState,
  setSidebarState,
  user,
  onLogout,
  onNavigate,
  unreadCount,
  onGoToSite,
}) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ConceptCategory | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(CONCEPTS.map((c) => [c.id, c])), []);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return CONCEPTS.filter((c) => {
      if (category !== 'all' && c.category !== category) return false;
      if (!q) return true;
      return normalize(`${c.term} ${c.expansion ?? ''} ${c.definition} ${c.inSystem}`).includes(q);
    });
  }, [query, category]);

  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  const tabLabel = (tab: string) => t(`nav.${tab}`);

  const renderCard = (c: Concept) => {
    const meta = CATEGORY_META[c.category];
    return (
      <button
        key={c.id}
        type="button"
        className={`cp-card ${selectedId === c.id ? 'is-active' : ''}`}
        style={{ ['--cat' as string]: meta.color }}
        onClick={() => setSelectedId(c.id)}
      >
        <span className="cp-card-term">{c.term}</span>
        {c.expansion && <span className="cp-card-exp">{c.expansion}</span>}
        <span className="cp-card-def">{c.definition}</span>
      </button>
    );
  };

  return (
    <div>
      <Header
        title={t('nav.concepts')}
        subtitle="Glosario de los conceptos de análisis, herramientas y gobernanza que usa SSPILLOWY"
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      <div className="card cp-toolbar">
        <div className="cp-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar concepto: SAST, CVE, SLA, gate…" />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="cp-chips">
          <button type="button" className={category === 'all' ? 'is-active' : ''} onClick={() => setCategory('all')}>
            Todos <b>{CONCEPTS.length}</b>
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={category === cat ? 'is-active' : ''}
              style={{ ['--cat' as string]: CATEGORY_META[cat].color }}
              onClick={() => setCategory(cat)}
            >
              <i />
              {CATEGORY_META[cat].label}
              <b>{CONCEPTS.filter((c) => c.category === cat).length}</b>
            </button>
          ))}
        </div>
      </div>

      <div className={`cp-layout ${selected ? 'has-detail' : ''}`}>
        <div className="cp-list">
          {filtered.length === 0 ? (
            <div className="card cp-empty">Ningún concepto coincide con la búsqueda.</div>
          ) : (
            CATEGORIES.filter((cat) => filtered.some((c) => c.category === cat)).map((cat) => (
              <section key={cat} className="cp-section">
                <header>
                  <h2 style={{ color: CATEGORY_META[cat].color }}>{CATEGORY_META[cat].label}</h2>
                  <p>{CATEGORY_META[cat].description}</p>
                </header>
                <div className="cp-grid">{filtered.filter((c) => c.category === cat).map(renderCard)}</div>
              </section>
            ))
          )}
        </div>

        {selected && (
          <aside className="card cp-detail" style={{ ['--cat' as string]: CATEGORY_META[selected.category].color }}>
            <div className="cp-detail-head">
              <span className="cp-detail-cat">{CATEGORY_META[selected.category].label}</span>
              <button type="button" className="cp-close" onClick={() => setSelectedId(null)} aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>
            <h2>{selected.term}</h2>
            {selected.expansion && <p className="cp-detail-exp">{selected.expansion}</p>}

            <h3>Qué es</h3>
            <p>{selected.definition}</p>

            <h3>En SSPILLOWY</h3>
            <p>{selected.inSystem}</p>

            {selected.example && (
              <>
                <h3>Ejemplo</h3>
                <code className="cp-example">{selected.example}</code>
              </>
            )}

            {selected.tab && (
              <button type="button" className="btn btn-primary cp-goto" onClick={() => onNavigate?.(selected.tab!)}>
                <span>Ver en {tabLabel(selected.tab)}</span>
                <ArrowRight size={15} />
              </button>
            )}

            {selected.related?.length ? (
              <>
                <h3>Relacionados</h3>
                <div className="cp-related">
                  {selected.related
                    .map((id) => byId.get(id))
                    .filter((c): c is Concept => Boolean(c))
                    .map((c) => (
                      <button key={c.id} type="button" onClick={() => setSelectedId(c.id)}>
                        <BookOpen size={12} />
                        {c.term}
                      </button>
                    ))}
                </div>
              </>
            ) : null}
          </aside>
        )}
      </div>
    </div>
  );
};
