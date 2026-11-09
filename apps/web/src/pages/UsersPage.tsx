import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  WorkspaceOverview,
  WorkspaceRole,
  cancelWorkspaceInvitation,
  changeWorkspaceMemberRole,
  fetchWorkspaces,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  resendWorkspaceInvitation,
} from '../api/client';
import { ConfirmModal } from '../components/ConfirmModal';
import { Header } from '../components/Header';
import { SidebarState } from '../components/Sidebar';

type AssignableRole = Exclude<WorkspaceRole, 'owner'>;

const ROLE_INFO: Record<WorkspaceRole, { label: string; desc: string; badgeColor: string }> = {
  owner: {
    label: 'Propietario',
    desc: 'Acceso total y creador del espacio de trabajo. No puede ser eliminado ni modificado.',
    badgeColor: '#7c3aed',
  },
  admin: {
    label: 'Administrador',
    desc: 'Gestiona miembros, configura políticas del Security Gate y aprueba excepciones de seguridad.',
    badgeColor: '#0284c7',
  },
  member: {
    label: 'Miembro',
    desc: 'Conecta repositorios, ejecuta escaneos de código (SAST/SCA/Secretos) y gestiona hallazgos.',
    badgeColor: '#16a34a',
  },
  viewer: {
    label: 'Solo lectura',
    desc: 'Consulta paneles, reportes y métricas de seguridad sin permisos para modificar datos.',
    badgeColor: '#64748b',
  },
};

interface UsersPageProps {
  sidebarState?: SidebarState;
  setSidebarState?: (state: SidebarState) => void;
  user?: { email: string; name: string } | null;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  unreadCount?: number;
  onGoToSite?: () => void;
}

export const UsersPage: React.FC<UsersPageProps> = ({
  sidebarState = 'expanded',
  setSidebarState = () => {},
  user,
  onLogout,
  onNavigate,
  unreadCount,
  onGoToSite,
}) => {
  const [data, setData] = useState<WorkspaceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');

  // Formulario de invitación
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AssignableRole>('member');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal de confirmación UI
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDanger?: boolean;
    action: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => undefined,
  });

  const loadData = async () => {
    try {
      const res = await fetchWorkspaces();
      setData(res);
    } catch {
      setFeedback({ type: 'error', message: 'No se pudo cargar la información del espacio.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const onClear = () => loadData();
    window.addEventListener('sspillowy:workspace-cache-clear', onClear);
    return () => window.removeEventListener('sspillowy:workspace-cache-clear', onClear);
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await inviteWorkspaceMember(email, inviteRole);
      setData(res);
      setInviteEmail('');
      setFeedback({
        type: 'success',
        message: `¡Invitación enviada por correo a ${email}! El usuario se unirá al espacio una vez acepte el enlace.`,
      });
      setActiveTab('invitations');
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al enviar la invitación.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: AssignableRole) => {
    setFeedback(null);
    try {
      const res = await changeWorkspaceMemberRole(memberId, role);
      setData(res);
      setFeedback({ type: 'success', message: 'Rol de usuario actualizado exitosamente.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'No se pudo cambiar el rol.',
      });
    }
  };

  const handleRemoveMember = (memberId: string, email: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Quitar acceso del espacio',
      message: `¿Estás seguro de quitar a "${email}" de este espacio? Ya no tendrá acceso a los repositorios ni análisis asociados.`,
      confirmText: 'Quitar acceso',
      isDanger: true,
      action: async () => {
        try {
          const res = await removeWorkspaceMember(memberId);
          if ('left' in res) {
            window.location.reload();
            return;
          }
          setData(res);
          setFeedback({ type: 'success', message: `Se revocó el acceso a ${email}.` });
        } catch (err) {
          setFeedback({
            type: 'error',
            message: err instanceof Error ? err.message : 'Error al remover miembro.',
          });
        }
      },
    });
  };

  const handleCancelInvite = (invitationId: string, email: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cancelar invitación pendiente',
      message: `¿Deseas revocar la invitación enviada a "${email}"? El enlace enviado por correo dejará de ser válido inmediatamente.`,
      confirmText: 'Cancelar invitación',
      isDanger: true,
      action: async () => {
        try {
          const res = await cancelWorkspaceInvitation(invitationId);
          setData(res);
          setFeedback({ type: 'success', message: `Invitación a ${email} cancelada.` });
        } catch (err) {
          setFeedback({
            type: 'error',
            message: err instanceof Error ? err.message : 'Error al cancelar la invitación.',
          });
        }
      },
    });
  };

  const handleResendInvite = async (invitationId: string, email: string) => {
    setFeedback(null);
    try {
      const res = await resendWorkspaceInvitation(invitationId);
      setData(res);
      setFeedback({ type: 'success', message: `Correo de invitación reenviado a ${email}.` });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al reenviar la invitación.',
      });
    }
  };

  const current = data?.current;
  const members = data?.members || [];
  const invitations = data?.invitations || [];
  const roles = data?.roles || [];
  const canManage = !!current?.can_manage;

  const filteredMembers = members.filter((m) => {
    const q = searchTerm.toLowerCase();
    return m.email.toLowerCase().includes(q) || (m.name && m.name.toLowerCase().includes(q));
  });

  const filteredInvitations = invitations.filter((inv) =>
    inv.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div>
      <Header
        title="Usuarios y Accesos"
        subtitle="Gestiona los miembros, asigna roles de seguridad e invita colaboradores mediante verificación segura por correo."
        sidebarState={sidebarState}
        setSidebarState={setSidebarState}
        user={user}
        onLogout={onLogout}
        onNavigate={onNavigate}
        unreadCount={unreadCount}
        onGoToSite={onGoToSite}
      />

      {loading ? (
        <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={24} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>Cargando usuarios y roles...</p>
        </div>
      ) : !data || !current ? null : (
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
          {/* Subcabecera con badge del espacio activo y refresco */}
          <div
            style={{
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  background: '#e0f2fe',
                  color: '#0369a1',
                }}
              >
                Espacio activo: {current.name}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={loadData}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} /> Actualizar
              </button>
            </div>
          </div>

      {/* Alertas de Feedback */}
      {feedback && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1.15rem',
            borderRadius: '8px',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: feedback.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Tarjetas de Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.15rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
            <span>Miembros Activos</span>
            <Users size={16} color="#0284c7" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0f172a', marginTop: '0.4rem' }}>
            {members.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
            Personas con acceso al espacio
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.15rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
            <span>Invitaciones Pendientes</span>
            <Mail size={16} color="#d97706" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 700, color: invitations.length > 0 ? '#d97706' : '#0f172a', marginTop: '0.4rem' }}>
            {invitations.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
            Esperando aceptación por correo
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.15rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
            <span>Tu Rol Actual</span>
            <ShieldCheck size={16} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ROLE_INFO[current.role]?.badgeColor || '#0284c7' }} />
            {current.role_label}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
            {canManage ? 'Permiso completo de administración' : 'Permisos según rol asignado'}
          </div>
        </div>
      </div>

      {/* Formulario de Invitar (Solo si canManage) */}
      {canManage && (
        <section
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <UserPlus size={18} color="#0284c7" />
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>
              Invitar Nuevo Usuario al Espacio
            </h2>
          </div>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: '#64748b' }}>
            El usuario recibirá un correo con un botón para validar y aceptar su incorporación. No tendrá acceso hasta que confirme.
          </p>

          <form onSubmit={handleInvite} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="correo@empresa.com"
              required
              disabled={submitting}
              style={{
                flex: '1 1 280px',
                padding: '0.55rem 0.85rem',
                fontSize: '0.875rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
              }}
            />

            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as AssignableRole)}
              disabled={submitting}
              style={{
                padding: '0.55rem 0.85rem',
                fontSize: '0.875rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                background: '#ffffff',
                cursor: 'pointer',
              }}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={submitting || !inviteEmail.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#ffffff',
                background: '#16a34a',
                border: 'none',
                borderRadius: '6px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                boxShadow: '0 1px 2px rgba(22, 163, 74, 0.2)',
              }}
            >
              <Plus size={16} /> {submitting ? 'Enviando...' : 'Enviar Invitación'}
            </button>
          </form>

          <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Shield size={14} color="#64748b" />
            <span>
              <strong>Rol seleccionado:</strong> {ROLE_INFO[inviteRole]?.desc}
            </span>
          </div>
        </section>
      )}

      {/* Tabs y Búsqueda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'members' ? '#ffffff' : 'transparent',
              color: activeTab === 'members' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'members' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <UserCheck size={14} /> Miembros Activos ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invitations')}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'invitations' ? '#ffffff' : 'transparent',
              color: activeTab === 'invitations' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'invitations' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Clock size={14} /> Invitaciones Pendientes ({invitations.length})
          </button>
        </div>

        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por correo o nombre..."
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 2rem',
              fontSize: '0.82rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Contenido de Tab: Miembros Activos */}
      {activeTab === 'members' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {filteredMembers.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
              No se encontraron miembros con ese filtro.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '0.75rem 1.25rem' }}>Usuario</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Rol en el Espacio</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Incorporación</th>
                  {canManage && <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => {
                  const editable = canManage && m.role !== 'owner' && !m.is_me;
                  const initial = (m.name || m.email).slice(0, 1).toUpperCase();
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.9rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: '#e2e8f0',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              flexShrink: 0,
                            }}
                          >
                            {initial}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>
                              {m.name || m.email}
                              {m.is_me && (
                                <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#0284c7', fontWeight: 600 }}>
                                  (tú)
                                </span>
                              )}
                            </div>
                            {m.name && <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{m.email}</div>}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '0.9rem 1rem' }}>
                        {editable ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value as AssignableRole)}
                            style={{
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.8rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              cursor: 'pointer',
                            }}
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              background: `${ROLE_INFO[m.role]?.badgeColor || '#64748b'}15`,
                              color: ROLE_INFO[m.role]?.badgeColor || '#64748b',
                            }}
                          >
                            {m.role_label}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', color: '#64748b' }}>
                        {m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}
                      </td>

                      {canManage && (
                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m.id, m.email)}
                              title={`Quitar acceso a ${m.email}`}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Contenido de Tab: Invitaciones Pendientes */}
      {activeTab === 'invitations' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {filteredInvitations.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <Mail size={32} style={{ margin: '0 auto 0.75rem', color: '#cbd5e1' }} />
              <p style={{ margin: 0, fontWeight: 500 }}>No hay invitaciones pendientes</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Cuando invites nuevos usuarios, aparecerán aquí hasta que acepten el enlace.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '0.75rem 1.25rem' }}>Correo del Invitado</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Rol Ofrecido</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Estado</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Enviado por</th>
                  {canManage && <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filteredInvitations.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.9rem 1.25rem', fontWeight: 600, color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Mail size={16} color="#d97706" />
                        <span>{inv.email}</span>
                      </div>
                    </td>

                    <td style={{ padding: '0.9rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          background: `${ROLE_INFO[inv.role]?.badgeColor || '#64748b'}15`,
                          color: ROLE_INFO[inv.role]?.badgeColor || '#64748b',
                        }}
                      >
                        {inv.role_label}
                      </span>
                    </td>

                    <td style={{ padding: '0.9rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '9999px',
                          background: '#fef3c7',
                          color: '#b45309',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <Clock size={12} /> Pendiente de aceptación
                      </span>
                    </td>

                    <td style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', color: '#64748b' }}>
                      {inv.invited_by || 'Administrador'}
                    </td>

                    {canManage && (
                      <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleResendInvite(inv.id, inv.email)}
                            title="Reenviar correo de invitación"
                            style={{
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              color: '#0284c7',
                              background: '#f0f9ff',
                              border: '1px solid #bae6fd',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <RefreshCw size={12} /> Reenviar
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCancelInvite(inv.id, inv.email)}
                            title="Cancelar / Revocar invitación"
                            style={{
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              color: '#ef4444',
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <Trash2 size={12} /> Revocar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal de Confirmación Reutilizable */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDanger={confirmDialog.isDanger}
        onConfirm={() => {
          const act = confirmDialog.action;
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          act();
        }}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
        </div>
      )}
    </div>
  );
};
