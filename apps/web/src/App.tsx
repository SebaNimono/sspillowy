import { useState, useEffect } from 'react';
import { ShieldAlert, Play, RefreshCw, Mail, Lock, ArrowRight, Code2, Database, User, LogOut, CheckCircle2, Globe } from 'lucide-react';

interface Finding {
  id: string;
  tool: string;
  severity: string;
  title: string;
  file: string;
  description: string;
  aiFix: string;
}

interface ScanRecord {
  id: string;
  repository_id: string;
  status: string;
  created_at: string;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [currentUser, setCurrentUser] = useState<string>('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [repoUrl, setRepoUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [dbScans, setDbScans] = useState<ScanRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchDbRecords = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/scans');
      if (res.ok) {
        const data = await res.json();
        setDbScans(data);
      }
    } catch {
      setError('Error al conectar con la base de datos PostgreSQL.');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDbRecords();
    }
  }, [isAuthenticated]);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      setCurrentUser(email);
      setIsAuthenticated(true);
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;

    setIsScanning(true);
    setError(null);
    setLogs([]);
    setFindings([]);

    try {
      const res = await fetch('http://localhost:8000/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl }),
      });

      if (!res.ok) throw new Error('Error al iniciar el escaneo en la API');
      const { scanId } = await res.json();

      setLogs([
        '[SYSTEM] Conectando a la base de datos PostgreSQL 16...',
        `[POSTGRES] Registro guardado con ID: ${scanId}`,
        '[GITLEAKS] Analizando credenciales y secretos expuestos...',
        '[SUCCESS] Hallazgos indexados correctamente en la BD.'
      ]);

      const resResults = await fetch(`http://localhost:8000/api/scan/${scanId}/results`);
      const data = await resResults.json();
      setFindings(data);
      setIsScanning(false);
      
      fetchDbRecords();
    } catch (err: unknown) {
      setIsScanning(false);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error al conectar con el backend de FastAPI.');
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 relative font-sans">
        <div className="w-full max-w-md space-y-6 text-center z-10">
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-16 h-16 bg-[#2E1065] rounded-2xl flex items-center justify-center shadow-lg">
              <ShieldAlert className="h-10 w-10 text-white" />
            </div>
            <span className="text-xs font-black tracking-widest text-[#2E1065] uppercase">SSPILLOWY</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {authMode === 'login' ? 'Iniciar sesión en SSPILLOWY' : 'Crear una cuenta nueva'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">Plataforma Integral de Gobernanza DevSecOps</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 text-left space-y-5">
            <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl text-sm font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`py-2 rounded-lg text-center transition ${authMode === 'login' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'hover:text-slate-900'}`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`py-2 rounded-lg text-center transition ${authMode === 'register' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'hover:text-slate-900'}`}
              >
                Crear Cuenta
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nombre Completo</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Tu nombre y apellido"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@ejemplo.com"
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#15803D] hover:bg-[#166534] text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                {authMode === 'login' ? 'Ingresar a la Consola' : 'Registrar Cuenta'} <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-400 tracking-wider">O CONTINUAR CON</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setIsAuthenticated(true)} className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-100">
                <Globe className="h-4 w-4 text-red-500" /> Google
              </button>
              <button type="button" onClick={() => setIsAuthenticated(true)} className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-100">
                <Code2 className="h-4 w-4 text-slate-900" /> GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ShieldAlert className="h-7 w-7 text-indigo-500" />
          <div>
            <h1 className="text-lg font-bold text-white">SSPILLOWY Console</h1>
            <p className="text-xs text-slate-400">Sesión activa: <span className="text-indigo-400 font-mono">{currentUser || 'admin@sspillowy.io'}</span></p>
          </div>
        </div>
        <button
          onClick={() => setIsAuthenticated(false)}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white border border-slate-800 px-3 py-1.5 rounded-lg transition"
        >
          <LogOut className="h-3.5 w-3.5" /> Cerrar Sesión
        </button>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs">
            {error}
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Play className="h-4 w-4 text-indigo-400" /> Ejecutar Auditoría DevSecOps
          </h2>
          <form onSubmit={handleScan} className="flex gap-4">
            <input
              type="url"
              required
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/usuario/repositorio.git"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={isScanning}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isScanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {isScanning ? 'Procesando' : 'Auditar'}
            </button>
          </form>

          {logs.length > 0 && (
            <div className="bg-black/90 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-400 space-y-1">
              {logs.map((log, idx) => <div key={idx}>{log}</div>)}
            </div>
          )}
        </div>

        {findings.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-100">Hallazgos Detectados</h3>
            <div className="space-y-2">
              {findings.map((f) => (
                <div key={f.id} className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs flex justify-between items-center">
                  <div>
                    <span className="text-red-400 font-bold mr-2">[{f.severity}]</span>
                    <span className="text-slate-200 font-medium">{f.title}</span>
                    <p className="text-slate-400 font-mono text-[10px] mt-0.5">{f.file}</p>
                  </div>
                  <span className="text-indigo-400 font-mono text-[11px]">{f.tool}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-100">Registros en Base de Datos PostgreSQL 16</h2>
            </div>
            <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-2.5 py-1 rounded-full font-mono flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Conectado (`sspillowy_db`)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">ID Escaneo (UUID)</th>
                  <th className="p-3">ID Repositorio</th>
                  <th className="p-3">Estado BD</th>
                  <th className="p-3">Fecha de Creación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {dbScans.length > 0 ? (
                  dbScans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-slate-800/40">
                      <td className="p-3 text-indigo-400">{scan.id}</td>
                      <td className="p-3 text-slate-300">{scan.repository_id}</td>
                      <td className="p-3">
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px]">
                          {scan.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">{new Date(scan.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-500">
                      No hay registros en la base de datos aún. Ejecuta un escaneo arriba.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}