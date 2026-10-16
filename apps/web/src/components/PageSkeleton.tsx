import '../styles/skeleton.css';

export type SkeletonVariant = 'list' | 'table' | 'cards' | 'panel' | 'dashboard';

type Props = {
  variant?: SkeletonVariant;
  rows?: number;
  className?: string;
  /** Sin borde propio: útil cuando ya va dentro de un card. */
  embedded?: boolean;
};

function Bar({ className = 'w-60' }: { className?: string }) {
  return <div className={`sk-bar ${className}`} aria-hidden />;
}

function shell(embedded: boolean, extra = '') {
  return `sk${embedded ? ' is-embedded' : ' sk-card'}${extra ? ` ${extra}` : ''}`;
}

function ListSkeleton({ rows, embedded = false }: { rows: number; embedded?: boolean }) {
  return (
    <div className={shell(embedded)} role="status" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-row">
          <div className="sk-circle is-sm" />
          <div className="sk-col">
            <Bar className={`is-lg ${i % 3 === 0 ? 'w-50' : i % 3 === 1 ? 'w-70' : 'w-40'}`} />
            <Bar className={`is-sm ${i % 2 === 0 ? 'w-80' : 'w-60'}`} />
          </div>
          <Bar className="w-20 is-sm" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows, embedded = false }: { rows: number; embedded?: boolean }) {
  return (
    <div className={shell(embedded, 'sk-table')} role="status" aria-label="Cargando">
      <div className="sk-table-head">
        <Bar className="w-60 is-sm" />
        <Bar className="w-50 is-sm" />
        <Bar className="w-70 is-sm" />
        <Bar className="w-40 is-sm" />
        <Bar className="w-40 is-sm" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-table-row">
          <Bar className={i % 2 === 0 ? 'w-70' : 'w-50'} />
          <Bar className="w-40" />
          <Bar className={i % 3 === 0 ? 'w-80' : 'w-60'} />
          <Bar className="w-50" />
          <Bar className="w-30" />
        </div>
      ))}
    </div>
  );
}

function CardsSkeleton({ rows }: { rows: number }) {
  const n = Math.max(3, Math.min(rows, 6));
  return (
    <div className="sk" role="status" aria-label="Cargando">
      <div className="sk-grid">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="sk-card">
            <Bar className="w-50 is-sm" />
            <Bar className="w-40 is-xl" />
            <Bar className="w-70 is-sm" />
          </div>
        ))}
      </div>
      <ListSkeleton rows={4} />
    </div>
  );
}

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="sk" role="status" aria-label="Cargando">
      <div className="sk-card">
        <div className="sk-row">
          <div className="sk-circle" />
          <div className="sk-col">
            <Bar className="w-40 is-lg" />
            <Bar className="w-60 is-sm" />
          </div>
        </div>
        <div className="sk-grid">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <Bar className="w-50 is-sm" />
              <Bar className="w-30 is-xl" />
            </div>
          ))}
        </div>
      </div>
      <div className="sk sk-card sk-table">
        <div className="sk-table-head">
          <Bar className="w-60 is-sm" />
          <Bar className="w-50 is-sm" />
          <Bar className="w-70 is-sm" />
          <Bar className="w-40 is-sm" />
          <Bar className="w-40 is-sm" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="sk-table-row">
            <Bar className={i % 2 === 0 ? 'w-70' : 'w-50'} />
            <Bar className="w-40" />
            <Bar className={i % 3 === 0 ? 'w-80' : 'w-60'} />
            <Bar className="w-50" />
            <Bar className="w-30" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="sk" role="status" aria-label="Cargando">
      <div className="sk-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sk-card">
            <Bar className="w-50 is-sm" />
            <Bar className="w-40 is-xl" />
            <Bar className="w-70 is-sm" />
          </div>
        ))}
      </div>
      <div className="sk-card">
        <Bar className="w-40 is-lg" />
        <Bar className="w-100 is-xl" />
        <Bar className="w-100 is-xl" />
        <Bar className="w-80 is-xl" />
      </div>
      <div className="sk-card">
        <Bar className="w-50 is-lg" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="sk-row">
            <Bar className="w-70" />
            <Bar className="w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PageSkeleton({
  variant = 'list',
  rows = 6,
  className = '',
  embedded = false,
}: Props) {
  const wrap = className.trim() || undefined;
  if (variant === 'table') {
    return (
      <div className={wrap}>
        <TableSkeleton rows={rows} embedded={embedded} />
      </div>
    );
  }
  if (variant === 'cards') {
    return (
      <div className={wrap}>
        <CardsSkeleton rows={rows} />
      </div>
    );
  }
  if (variant === 'panel') {
    return (
      <div className={wrap}>
        <PanelSkeleton rows={rows} />
      </div>
    );
  }
  if (variant === 'dashboard') {
    return (
      <div className={wrap}>
        <DashboardSkeleton />
      </div>
    );
  }
  return (
    <div className={wrap}>
      <ListSkeleton rows={rows} embedded={embedded} />
    </div>
  );
}
