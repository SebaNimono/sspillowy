import React, { useEffect, useState } from 'react';
import { Shield, RefreshCw } from 'lucide-react';
import { fetchPillowAdminUsage, resetPillowCredits, PillowUsageRow } from '../api/client';

interface PillowAdminPanelProps {
  adminEmail: string;
  onCreditsReset?: () => void;
}

export const PillowAdminPanel: React.FC<PillowAdminPanelProps> = ({ adminEmail, onCreditsReset }) => {
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<PillowUsageRow[]>([]);
  const [targetEmail, setTargetEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    fetchPillowAdminUsage(adminEmail)
      .then((r) => setUsage(r.usage))
      .catch(() => setUsage([]));
  };

  useEffect(() => {
    if (open) load();
  }, [open, adminEmail]);

  const reset = async (email: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await resetPillowCredits(adminEmail, email);
      setMsg(res.message);
      load();
      if (email === adminEmail) onCreditsReset?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'No se pudo resetear.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pillow-admin">
      <button type="button" className="pillow-admin-toggle" onClick={() => setOpen((v) => !v)}>
        <Shield size={14} />
        Admin créditos
      </button>
      {open && (
        <div className="pillow-admin-body">
          <p className="pillow-admin-hint">Solo visible para correos en PILLOW_ADMIN_EMAILS (Railway).</p>
          <div className="pillow-admin-row">
            <input
              type="email"
              placeholder="correo@ejemplo.com"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
            />
            <button type="button" disabled={busy || !targetEmail.trim()} onClick={() => void reset(targetEmail.trim())}>
              Resetear
            </button>
          </div>
          <button type="button" className="pillow-admin-self" disabled={busy} onClick={() => void reset(adminEmail)}>
            <RefreshCw size={14} />
            Resetear mis créditos (2/2)
          </button>
          {msg && <p className="pillow-admin-msg">{msg}</p>}
          {usage.length > 0 && (
            <table className="pillow-admin-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Usados</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((row) => (
                  <tr key={row.user_key}>
                    <td>{row.user_key}</td>
                    <td>
                      {row.credits_used} / {row.daily_limit}
                      <button type="button" onClick={() => void reset(row.user_key)} disabled={busy}>
                        ↺
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
