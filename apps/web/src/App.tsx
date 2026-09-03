import React, { useState } from 'react';
import { 
  Shield, 
  Sun, 
  Moon, 
  Search, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  Smartphone, 
  Download, 
  Bot, 
  Cpu, 
  Check, 
  X,
  FileText
} from 'lucide-react';

export interface AITriaging {
  confidenceScore: number;
  reachability: 'REACHABLE' | 'UNREACHABLE' | 'UNKNOWN';
  suggestedFix: string;
  businessImpact: string;
}

export interface Finding {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  engine: 'GitLeaks' | 'Semgrep' | 'Trivy' | 'OWASP ZAP';
  compliance: string[];
  status: 'OPEN' | 'IN_REVIEW' | 'FIXED' | 'VERIFIED';
  location: string;
  description: string;
  aiTriaging?: AITriaging;
}

const INITIAL_FINDINGS: Finding[] = [
  {
    id: 'SEC-001',
    title: 'Clave privada / API Key detectada en el repositorio',
    severity: 'CRITICAL',
    engine: 'GitLeaks',
    compliance: ['ISO 27001 A.8.28', 'OWASP A07:2021'],
    status: 'OPEN',
    location: 'apps/api/config.py:42',
    description: 'Se detectó una credencial expuesta en el historial de commits. Debe ser revocada e introducida mediante variables de entorno.',
    aiTriaging: {
      confidenceScore: 98,
      reachability: 'REACHABLE',
      suggestedFix: 'export API_SECRET_KEY=$(kat vault/secrets.txt)\n# Reemplazar asignación directa por os.getenv("API_SECRET_KEY")',
      businessImpact: 'Riesgo alto de exfiltración de datos no autorizada y compromiso perimetral de la API.'
    }
  },
  {
    id: 'SEC-002',
    title: 'Vulnerabilidad SQL Injection en endpoint de búsqueda',
    severity: 'HIGH',
    engine: 'Semgrep',
    compliance: ['OWASP A03:2021', 'CWE-89'],
    status: 'IN_REVIEW',
    location: 'apps/api/routers/users.py:118',
    description: 'Concatenación directa de cadenas en la consulta SQL sin sanitización adecuada.',
    aiTriaging: {
      confidenceScore: 92,
      reachability: 'REACHABLE',
      suggestedFix: 'query = select(User).where(User.name == username)\n# Utilizar ORM parametrizado en lugar de f-strings',
      businessImpact: 'Permite a atacantes externos ejecutar consultas arbitrarias y extraer credenciales.'
    }
  },
  {
    id: 'SEC-003',
    title: 'Librería desactualizada con CVE crítico detectado (SCA)',
    severity: 'HIGH',
    engine: 'Trivy',
    compliance: ['ISO 27001 A.8.8', 'OWASP A06:2021'],
    status: 'OPEN',
    location: 'apps/web/package.json:28',
    description: 'La versión configurada de la dependencia presenta vulnerabilidades conocidas de denegación de servicio (DoS).',
    aiTriaging: {
      confidenceScore: 85,
      reachability: 'UNREACHABLE',
      suggestedFix: 'npm install axios@^1.7.0 --save',
      businessImpact: 'Bajo impacto inmediato en el flujo crítico, pero incumplimiento de la política de parches.'
    }
  },
  {
    id: 'SEC-004',
    title: 'Encabezados HTTP de seguridad ausentes (DAST)',
    severity: 'MEDIUM',
    engine: 'OWASP ZAP',
    compliance: ['ISO 27001 A.8.20', 'OWASP A05:2021'],
    status: 'OPEN',
    location: 'https://api.sspillowy.com/api/v1/health',
    description: 'Falta de cabeceras de protección tipo Content-Security-Policy y Strict-Transport-Security.',
    aiTriaging: {
      confidenceScore: 95,
      reachability: 'REACHABLE',
      suggestedFix: 'response.headers["Content-Security-Policy"] = "default-src \'self\'"',
      businessImpact: 'Exposición a ataques de tipo Cross-Site Scripting (XSS) y Clickjacking.'
    }
  }
];

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [findings, setFindings] = useState<Finding[]>(INITIAL_FINDINGS);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(INITIAL_FINDINGS[0]);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [targetUrl, setTargetUrl] = useState('https://github.com/SebaNimono/sspillowy');
  const [isScanning, setIsScanning] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    '[INIT] Sistema SSPILLOWY Web Hub operacional.',
    '[INFO] Conexión establecida con API (api.sspillowy.com).',
    '[PULSE] Agente móvil sincronizado vía FCM.'
  ]);

  const handleStatusChange = (id: string, newStatus: Finding['status']) => {
    setFindings(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f));
    if (selectedFinding?.id === id) {
      setSelectedFinding(prev => prev ? { ...prev, status: newStatus } : null);
    }
    setLogs(prev => [`[GOVERNANCE] Estado del hallazgo ${id} actualizado a ${newStatus}`, ...prev]);
  };

  const handleStartScan = (e: React.FormEvent) => {
    e.preventDefault();
    setIsScanning(true);
    setLogs(prev => [`[SCAN] Iniciando escaneo orquestado en target: ${targetUrl}`, ...prev]);

    setTimeout(() => {
      setLogs(prev => [
        '[SEMGREP] SAST completado sin bloqueos fatales.',
        '[GITLEAKS] Análisis de secretos finalizado.',
        '[TRIVY] Verificación de manifiestos SCA ok.',
        '[AI_ROUTER] Triaje agéntico generado correctamente.',
        ...prev
      ]);
      setIsScanning(false);
    }, 2500);
  };

  const filteredFindings = findings.filter(f => 
    severityFilter === 'ALL' ? true : f.severity === severityFilter
  );

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} transition-colors duration-200`}>
      {/* Header Superior */}
      <header className={`border-b ${darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'} sticky top-0 z-50 backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="SSPILLOWY" className="h-8 w-auto object-contain" />
            <div className="h-5 w-px bg-slate-700/50 hidden sm:block" />
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hidden sm:block">
              Web Hub Console
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Pulse Sync Status */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
              darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}>
              <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
              <span>Pulse Sync</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>

            {/* Switcher Modo Claro / Oscuro */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg border transition-colors ${
                darkMode 
                  ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title="Cambiar Tema"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Banner de Disparador / Lanzar Escaneo */}
        <div className={`p-6 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <form onSubmit={handleStartScan} className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="Repositorio Git o URL objetivo..."
                className={`w-full pl-9 pr-4 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isScanning}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isScanning ? <Cpu className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {isScanning ? 'Ejecutando Motores...' : 'Lanzar Auditoría'}
              </button>
              <button
                type="button"
                onClick={() => alert('Generando paquete de evidencias ISO 27001...')}
                className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
                title="Exportar Evidencias"
              >
                <Download className="w-4 h-4" />
                <span className="hidden md:inline">ISO 27001</span>
              </button>
            </div>
          </form>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Columna Izquierda: Lista de Hallazgos */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Hallazgos Detectados
              </h2>
              {/* Filtro de Severidad */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className={`text-xs rounded-lg px-2.5 py-1 border font-medium focus:outline-none ${
                  darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="ALL">Todas las severidades</option>
                <option value="CRITICAL">Crítica</option>
                <option value="HIGH">Alta</option>
                <option value="MEDIUM">Media</option>
                <option value="LOW">Baja</option>
              </select>
            </div>

            <div className="space-y-2">
              {filteredFindings.map((finding) => (
                <div
                  key={finding.id}
                  onClick={() => setSelectedFinding(finding)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedFinding?.id === finding.id
                      ? 'border-indigo-500 ring-1 ring-indigo-500/50'
                      : darkMode ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase font-mono ${
                      finding.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      finding.severity === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {finding.severity}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {finding.engine}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold mb-1 line-clamp-1">{finding.title}</h3>
                  <p className="text-xs text-slate-500 font-mono line-clamp-1">{finding.location}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Columna Derecha: Detalle del Hallazgo + IA Triaging */}
          <div className="lg:col-span-7">
            {selectedFinding ? (
              <div className={`p-6 rounded-xl border space-y-6 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                
                {/* Header del Hallazgo */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-indigo-400 font-bold">{selectedFinding.id}</span>
                    <div className="flex items-center gap-2">
                      {selectedFinding.compliance.map((c, i) => (
                        <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <h2 className="text-lg font-bold">{selectedFinding.title}</h2>
                  <p className="text-xs font-mono text-slate-400 mt-1">{selectedFinding.location}</p>
                </div>

                {/* Descripción y Detalles */}
                <div className="text-sm text-slate-300 space-y-2">
                  <p>{selectedFinding.description}</p>
                </div>

                {/* Capa Agéntica de IA (Triaje y Remediación) */}
                {selectedFinding.aiTriaging && (
                  <div className={`p-4 rounded-xl border space-y-3 ${
                    darkMode ? 'bg-slate-950/80 border-indigo-500/30' : 'bg-indigo-50/50 border-indigo-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                          Triaje Agéntico con IA
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          ({selectedFinding.aiTriaging.confidenceScore}% confianza)
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        selectedFinding.aiTriaging.reachability === 'REACHABLE'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {selectedFinding.aiTriaging.reachability}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-slate-400">Impacto Operativo:</p>
                      <p className="text-slate-300">{selectedFinding.aiTriaging.businessImpact}</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-400">Parche Sugerido:</p>
                      <pre className="p-3 rounded bg-slate-950 font-mono text-xs text-emerald-400 border border-slate-800 overflow-x-auto">
                        {selectedFinding.aiTriaging.suggestedFix}
                      </pre>
                    </div>

                    {/* Gobernanza Human-in-the-Loop */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => handleStatusChange(selectedFinding.id, 'FIXED')}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Aprobar Parche
                      </button>
                      <button
                        onClick={() => handleStatusChange(selectedFinding.id, 'VERIFIED')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded border transition-colors flex items-center gap-1 ${
                          darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                        Descartar
                      </button>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className={`p-12 text-center rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400'}`}>
                Selecciona un hallazgo para inspeccionar los detalles de auditoría.
              </div>
            )}
          </div>

        </div>

        {/* Terminal Integrada / Bitácora de Eventos */}
        <div className={`p-4 rounded-xl border font-mono text-xs ${darkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-900 border-slate-800 text-slate-300'}`}>
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800 text-slate-500">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span className="font-bold uppercase tracking-wider text-[10px]">Console Output Logs</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-slate-600">&gt;</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}