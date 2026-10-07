export type PillowWidgetType =
  | 'timeseries'
  | 'query_value'
  | 'top_list'
  | 'table'
  | 'list'
  | 'pie_chart'
  | 'bar_chart'
  | 'treemap'
  | 'heatmap'
  | 'notes';

export interface PillowWidgetCatalogItem {
  type: PillowWidgetType;
  label: string;
  description: string;
  category: string;
}

export interface PlacedPillowWidget {
  id: string;
  type: PillowWidgetType;
  title: string;
  metric?: string;
  createdAt: string;
}

export const PILLOW_WIDGET_CATALOG: PillowWidgetCatalogItem[] = [
  { type: 'timeseries', label: 'Timeseries', description: 'Serie temporal de hallazgos o escaneos', category: 'Gráficos' },
  { type: 'query_value', label: 'Query Value', description: 'KPI numérico destacado', category: 'Gráficos' },
  { type: 'top_list', label: 'Top List', description: 'Ranking de repos o motores', category: 'Gráficos' },
  { type: 'table', label: 'Table', description: 'Tabla de hallazgos', category: 'Gráficos' },
  { type: 'list', label: 'List', description: 'Lista compacta de eventos', category: 'Gráficos' },
  { type: 'pie_chart', label: 'Pie Chart', description: 'Distribución por severidad', category: 'Gráficos' },
  { type: 'bar_chart', label: 'Bar Chart', description: 'Barras por motor o severidad', category: 'Gráficos' },
  { type: 'treemap', label: 'Treemap', description: 'Áreas proporcionales', category: 'Gráficos' },
  { type: 'heatmap', label: 'Heatmap', description: 'Actividad por día', category: 'Gráficos' },
  { type: 'notes', label: 'Notes & Links', description: 'Nota de auditoría o enlace', category: 'Anotaciones' },
];

export const PILLOW_SUGGESTIONS = [
  '¿Cómo monitoreo hallazgos críticos esta semana?',
  'Quiero ver distribución por motor de escaneo',
  'Resume el health score y severidades abiertas',
];

const STORAGE_KEY = 'sspillowy_pillow_widgets';
export const PILLOW_WIDGETS_EVENT = 'sspillowy:pillow-widgets';

let widgetSink: ((widget: PlacedPillowWidget) => void) | null = null;

/** El dashboard abierto recibe los widgets que añade Pillow (así van al dashboard correcto). */
export function setPillowWidgetSink(sink: ((widget: PlacedPillowWidget) => void) | null): void {
  widgetSink = sink;
}

export function addPlacedWidget(widget: PlacedPillowWidget): void {
  if (widgetSink) {
    widgetSink(widget);
    return;
  }
  savePlacedWidgets([...loadPlacedWidgets(), widget]);
  window.dispatchEvent(new Event(PILLOW_WIDGETS_EVENT));
}

export function loadPlacedWidgets(): PlacedPillowWidget[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlacedPillowWidget[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePlacedWidgets(widgets: PlacedPillowWidget[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  } catch {
    // ignore
  }
}

export function createPlacedWidget(type: PillowWidgetType, title: string, metric?: string): PlacedPillowWidget {
  return {
    id: `pw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title,
    metric,
    createdAt: new Date().toISOString(),
  };
}

export function catalogLabel(type: string): string {
  return PILLOW_WIDGET_CATALOG.find((w) => w.type === type)?.label ?? type;
}

export function groupCatalogByCategory(): Record<string, PillowWidgetCatalogItem[]> {
  return PILLOW_WIDGET_CATALOG.reduce<Record<string, PillowWidgetCatalogItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});
}
