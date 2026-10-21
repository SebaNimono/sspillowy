import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Info, Lightbulb, Search, X } from 'lucide-react';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';
import { useI18n } from '../i18n/I18nProvider';
import { CATEGORY_META, CONCEPTS, Concept, ConceptCategory } from '../config/concepts';
import { DOC_GROUPS, DOC_SECTIONS, DocBlock, DocSection, GLOSSARY_SECTION_ID } from '../config/docs';
import '../styles/docs.css';

interface PageProps {
  sidebarState: SidebarState;
  setSidebarState: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

const SECTION_KEY = 'sspillowy_docs_section';
const CATEGORIES = Object.keys(CATEGORY_META) as ConceptCategory[];

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const INLINE_CODE = /(\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\/api\/v1\/[\w\-/{}|.]*|\/health\b|X-Session-Id)/g;

function renderInline(text: string): React.ReactNode {
  const parts = text.split(INLINE_CODE);
  return parts.map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : part));
}

function blockText(b: DocBlock): string {
  switch (b.type) {
    case 'p':
    case 'h':
    case 'callout':
      return b.text;
    case 'list':
      return b.items.join(' ');
    case 'steps':
      return b.items.map((s) => `${s.title} ${s.text}`).join(' ');
    case 'code':
      return `${b.title ?? ''} ${b.code}`;
    case 'table':
      return [...b.head, ...b.rows.flat()].join(' ');
    case 'goto':
      return b.label;
  }
}

const sectionText = (s: DocSection) => normalize(`${s.title} ${s.summary} ${s.blocks.map(blockText).join(' ')}`);
const conceptText = (c: Concept) => normalize(`${c.term} ${c.expansion ?? ''} ${c.definition} ${c.inSystem}`);

export const DocsPage: React.FC<PageProps> = ({
  sidebarState,
  setSidebarState,
  user,
  onLogout,
  onNavigate,
  unreadCount,
  onGoToSite,
}) => {
  const { t } = useI18n();
  const contentRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [sectionId, setSectionId] = useState<string>(() => {
    const saved = localStorage.getItem(SECTION_KEY);
    return saved && DOC_SECTIONS.some((s) => s.id === saved) ? saved : DOC_SECTIONS[0].id;
  });
  const [category, setCategory] = useState<ConceptCategory | 'all'>('all');
  const [conceptId, setConceptId] = useState<string | null>(null);

  const conceptsById = useMemo(() => new Map(CONCEPTS.map((c) => [c.id, c])), []);
  const indexed = useMemo(() => DOC_SECTIONS.map((s) => ({ section: s, text: sectionText(s) })), []);

  useEffect(() => {
    localStorage.setItem(SECTION_KEY, sectionId);
    contentRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [sectionId]);

  const q = normalize(query.trim());
  const sectionHits = q ? indexed.filter((x) => x.text.includes(q)).map((x) => x.section) : [];
  const conceptHits = q ? CONCEPTS.filter((c) => conceptText(c).includes(q)) : [];

  const current = DOC_SECTIONS.find((s) => s.id === sectionId) ?? DOC_SECTIONS[0];
  const currentIdx = DOC_SECTIONS.indexOf(current);
  const prev = DOC_SECTIONS[currentIdx - 1];
  const next = DOC_SECTIONS[currentIdx + 1];

  const openSection = (id: string) => {
    setSectionId(id);
    setQuery('');
  };

  const openConcept = (id: string) => {
    setConceptId(id);
    setCategory('all');
    openSection(GLOSSARY_SECTION_ID);
  };

  const renderBlock = (b: DocBlock, i: number) => {
    switch (b.type) {
      case 'p':
        return <p key={i}>{renderInline(b.text)}</p>;
      case 'h':
        return <h3 key={i}>{b.text}</h3>;
      case 'list':
        return (
          <ul key={i} className="dc-list">
            {b.items.map((it, j) => (
              <li key={j}>{renderInline(it)}</li>
            ))}
          </ul>
        );
      case 'steps':
        return (
          <ol key={i} className="dc-steps">
            {b.items.map((s, j) => (
              <li key={j}>
                <span className="dc-step-n">{j + 1}</span>
                <div>
                  <strong>{s.title}</strong>
                  <p>{renderInline(s.text)}</p>
                </div>
              </li>
            ))}
          </ol>
        );
      case 'code':
        return (
          <figure key={i} className="dc-code">
            {b.title && <figcaption>{b.title}</figcaption>}
            <pre>
              <code>{b.code}</code>
            </pre>
          </figure>
        );
      case 'table':
        return (
          <div key={i} className="dc-table-wrap">
            <table className="dc-table">
              <thead>
                <tr>
                  {b.head.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j}>
                    {r.map((cell, k) => (
                      <td key={k}>{renderInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'callout': {
        const Icon = b.tone === 'warn' ? AlertTriangle : b.tone === 'tip' ? Lightbulb : Info;
        return (
          <div key={i} className={`dc-callout is-${b.tone}`}>
            <Icon size={16} />
            <p>{renderInline(b.text)}</p>
          </div>
        );
      }
      case 'goto':
        return (
          <button key={i} type="button" className="btn btn-primary dc-goto" onClick={() => onNavigate?.(b.tab)}>
            <span>{b.label}</span>
            <ArrowRight size={15} />
          </button>
        );
    }
  };

  const renderGlossary = () => {
    const list = CONCEPTS.filter((c) => category === 'all' || c.category === category);
    const selected = conceptId ? conceptsById.get(conceptId) ?? null : null;
    return (
      <>
        <div className="dc-chips">
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
            </button>
          ))}
        </div>

        {selected && (
          <div className="dc-concept-detail" style={{ ['--cat' as string]: CATEGORY_META[selected.category].color }}>
            <div className="dc-concept-head">
              <div>
                <span className="dc-concept-cat">{CATEGORY_META[selected.category].label}</span>
                <h3>
                  {selected.term}
                  {selected.expansion && <small>{selected.expansion}</small>}
                </h3>
              </div>
              <button type="button" className="dc-icon-btn" onClick={() => setConceptId(null)} aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>
            <p>{renderInline(selected.definition)}</p>
            <h4>En SSPILLOWY</h4>
            <p>{renderInline(selected.inSystem)}</p>
            {selected.example && <code className="dc-example">{selected.example}</code>}
            <div className="dc-concept-actions">
              {selected.tab && (
                <button type="button" className="btn btn-primary dc-goto" onClick={() => onNavigate?.(selected.tab!)}>
                  <span>Ver en {t(`nav.${selected.tab}`)}</span>
                  <ArrowRight size={15} />
                </button>
              )}
              {selected.related
                ?.map((id) => conceptsById.get(id))
                .filter((c): c is Concept => Boolean(c))
                .map((c) => (
                  <button key={c.id} type="button" className="dc-related" onClick={() => setConceptId(c.id)}>
                    <BookOpen size={12} />
                    {c.term}
                  </button>
                ))}
            </div>
          </div>
        )}

        {CATEGORIES.filter((cat) => list.some((c) => c.category === cat)).map((cat) => (
          <section key={cat} className="dc-glossary-group">
            <h3 style={{ color: CATEGORY_META[cat].color }}>{CATEGORY_META[cat].label}</h3>
            <p className="dc-muted">{CATEGORY_META[cat].description}</p>
            <div className="dc-concepts">
              {list
                .filter((c) => c.category === cat)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`dc-concept ${conceptId === c.id ? 'is-active' : ''}`}
                    style={{ ['--cat' as string]: CATEGORY_META[c.category].color }}
                    onClick={() => setConceptId(c.id)}
                  >
                    <strong>{c.term}</strong>
                    {c.expansion && <small>{c.expansion}</small>}
                    <span>{c.definition}</span>
                  </button>
                ))}
            </div>
          </section>
        ))}
      </>
    );
  };

  return (
    <div>
      <Header
        title={t('pages.docs.title')}
        subtitle={t('pages.docs.subtitle')}
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      <div className="dc-layout">
        <nav className="card dc-toc" aria-label="Índice de la documentación">
          <div className="dc-search">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en la documentación…" />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda">
                <X size={13} />
              </button>
            )}
          </div>
          {DOC_GROUPS.map((group) => (
            <div key={group} className="dc-toc-group">
              <span className="dc-toc-label">{group}</span>
              {DOC_SECTIONS.filter((s) => s.group === group).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`dc-toc-item ${s.id === current.id && !q ? 'is-active' : ''}`}
                  onClick={() => openSection(s.id)}
                >
                  {s.title}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <article className="card dc-content" ref={contentRef}>
          {q ? (
            <>
              <h2>Resultados para “{query}”</h2>
              {sectionHits.length === 0 && conceptHits.length === 0 && (
                <p className="dc-muted">No hay coincidencias. Prueba con otro término, por ejemplo “gate”, “CVE” o “webhook”.</p>
              )}
              {sectionHits.length > 0 && (
                <>
                  <h3>Guías</h3>
                  <div className="dc-results">
                    {sectionHits.map((s) => (
                      <button key={s.id} type="button" onClick={() => openSection(s.id)}>
                        <span className="dc-result-group">{s.group}</span>
                        <strong>{s.title}</strong>
                        <span>{s.summary}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {conceptHits.length > 0 && (
                <>
                  <h3>Glosario</h3>
                  <div className="dc-results">
                    {conceptHits.map((c) => (
                      <button key={c.id} type="button" onClick={() => openConcept(c.id)}>
                        <span className="dc-result-group" style={{ color: CATEGORY_META[c.category].color }}>
                          {CATEGORY_META[c.category].label}
                        </span>
                        <strong>{c.term}</strong>
                        <span>{c.definition}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <span className="dc-breadcrumb">{current.group}</span>
              <h2>{current.title}</h2>
              <p className="dc-summary">{current.summary}</p>
              <div className="dc-body">
                {current.id === GLOSSARY_SECTION_ID ? renderGlossary() : current.blocks.map(renderBlock)}
              </div>
              <footer className="dc-pager">
                {prev ? (
                  <button type="button" onClick={() => openSection(prev.id)}>
                    <ArrowLeft size={14} />
                    <span>
                      <small>Anterior</small>
                      {prev.title}
                    </span>
                  </button>
                ) : (
                  <span />
                )}
                {next && (
                  <button type="button" className="is-next" onClick={() => openSection(next.id)}>
                    <span>
                      <small>Siguiente</small>
                      {next.title}
                    </span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </footer>
            </>
          )}
        </article>
      </div>
    </div>
  );
};
