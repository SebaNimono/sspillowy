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
    <div className={shell(embedded, 'sk-list')} role="status" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-row">
          <div className="sk-circle is-sm" />
          <div className="sk-col">
            <Bar className={`is-md ${i % 3 === 0 ? 'w-50' : i % 3 === 1 ? 'w-60' : 'w-40'}`} />
            <Bar className={`is-sm ${i % 2 === 0 ? 'w-80' : 'w-60'}`} />
          </div>
          <Bar className="w-15 is-sm" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows, embedded = false }: { rows: number; embedded?: boolean }) {
  return (
    <div className={shell(embedded, 'sk-table')} role="status" aria-label="Cargando">
      <div className="sk-table-head">
        <Bar className="w-50 is-sm" />
        <Bar className="w-60 is-sm" />
        <Bar className="w-40 is-sm" />
        <Bar className="w-50 is-sm" />
        <Bar className="w-40 is-sm" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-table-row">
          <Bar className={i % 2 === 0 ? 'w-60' : 'w-50'} />
          <Bar className="w-40" />
          <Bar className={i % 3 === 0 ? 'w-70' : 'w-50'} />
          <Bar className="w-40" />
          <Bar className="w-30" />
        </div>
      ))}
    </div>
  );
}

function CardsSkeleton({ rows }: { rows: number }) {
  const n = Math.max(3, Math.min(rows, 5));
  return (
    <div className="sk" role="status" aria-label="Cargando">
      <div className="sk-grid">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="sk-card sk-kpi">
            <Bar className="w-50 is-sm" />
            <div className="sk-kpi-mid">
              <Bar className="w-35 is-xl" />
              <Bar className="w-30 is-md" />
            </div>
            <Bar className="w-65 is-xs" />
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
            <div key={i} className="sk-stat-inline">
              <Bar className="w-50 is-sm" />
              <Bar className="w-35 is-xl" />
            </div>
          ))}
        </div>
      </div>
      <TableSkeleton rows={rows} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="sk" role="status" aria-label="Cargando">
      <div className="sk-grid sk-grid-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="sk-card sk-kpi">
            <Bar className="w-55 is-xs" />
            <div className="sk-kpi-mid">
              <Bar className="w-35 is-xl" />
              <Bar className="w-35 is-md" />
            </div>
            <Bar className="w-70 is-xs" />
          </div>
        ))}
      </div>
      <div className="sk-split">
        <div className="sk-card sk-widget">
          <div className="sk-widget-head">
            <Bar className="w-45 is-md" />
            <Bar className="w-15 is-sm" />
          </div>
          <div className="sk-chart-bars">
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                className="sk-bar sk-vbar"
                style={{ height: `${32 + ((i * 23) % 58)}%` }}
              />
            ))}
          </div>
          <Bar className="w-60 is-xs" />
        </div>
        <div className="sk-card sk-widget">
          <div className="sk-widget-head">
            <Bar className="w-50 is-md" />
            <Bar className="w-20 is-sm" />
          </div>
          <div className="sk-list-compact">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="sk-row">
                <div className="sk-col">
                  <Bar className={i % 2 === 0 ? 'w-70 is-sm' : 'w-55 is-sm'} />
                  <Bar className="w-90 is-xs" />
                </div>
                <Bar className="w-15 is-sm" />
              </div>
            ))}
          </div>
        </div>
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
