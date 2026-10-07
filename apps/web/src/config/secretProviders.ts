import { SecretStep } from '../api/client';

const FOCUS_KEY = 'sspillowy_secret_focus';

export function focusSecretFinding(findingId: string) {
  sessionStorage.setItem(FOCUS_KEY, findingId);
}

export function takeSecretFocus(): string | null {
  const id = sessionStorage.getItem(FOCUS_KEY);
  sessionStorage.removeItem(FOCUS_KEY);
  return id;
}

export interface SecretProviderGuide {
  label: string;
  color: string;
  rotate: string;
  revoke: string;
  url?: string;
}

export const SECRET_PROVIDERS: Record<string, SecretProviderGuide> = {
  aws: {
    label: 'AWS',
    color: '#ff9900',
    rotate: 'IAM → Users → Security credentials → Create access key. Actualiza la nueva clave en tu gestor de secretos y en los despliegues.',
    revoke: 'En la misma pantalla, desactiva (Make inactive) y luego elimina la clave filtrada. Revisa CloudTrail por uso no autorizado.',
    url: 'https://console.aws.amazon.com/iam/home#/security_credentials',
  },
  github: {
    label: 'GitHub',
    color: '#24292f',
    rotate: 'Settings → Developer settings → Personal access tokens → Generate new token con los permisos mínimos.',
    revoke: 'Elimina el token filtrado en la misma lista. Revisa el Security log de la cuenta u organización.',
    url: 'https://github.com/settings/tokens',
  },
  gitlab: {
    label: 'GitLab',
    color: '#fc6d26',
    rotate: 'Preferences → Access Tokens → Add new token (o Rotate en el token existente).',
    revoke: 'Revoke sobre el token filtrado. Revisa los audit events del grupo o proyecto.',
    url: 'https://gitlab.com/-/user_settings/personal_access_tokens',
  },
  stripe: {
    label: 'Stripe',
    color: '#635bff',
    rotate: 'Developers → API keys → Roll key. Stripe permite mantener la anterior activa unas horas mientras despliegas.',
    revoke: 'Reduce la expiración de la clave anterior a "ahora" y revisa los logs de requests de la API.',
    url: 'https://dashboard.stripe.com/apikeys',
  },
  slack: {
    label: 'Slack',
    color: '#4a154b',
    rotate: 'api.slack.com/apps → tu app → OAuth & Permissions → Rotate tokens / reinstala la app para emitir un token nuevo.',
    revoke: 'Revoca el token anterior (Revoke All OAuth Tokens) y regenera el webhook si estaba expuesto.',
    url: 'https://api.slack.com/apps',
  },
  gcp: {
    label: 'Google Cloud',
    color: '#4285f4',
    rotate: 'IAM → Service accounts → Keys → Add key (JSON) o crea una API key nueva con restricciones.',
    revoke: 'Elimina la key filtrada de la cuenta de servicio o la API key. Revisa Cloud Audit Logs.',
    url: 'https://console.cloud.google.com/iam-admin/serviceaccounts',
  },
  azure: {
    label: 'Azure',
    color: '#0078d4',
    rotate: 'Entra ID → App registrations → Certificates & secrets → New client secret (o regenera la key del recurso).',
    revoke: 'Elimina el secreto anterior o regenera la key secundaria/primaria afectada.',
    url: 'https://portal.azure.com',
  },
  openai: {
    label: 'OpenAI',
    color: '#10a37f',
    rotate: 'Dashboard → API keys → Create new secret key.',
    revoke: 'Elimina la clave filtrada y revisa el uso del proyecto por consumo anómalo.',
    url: 'https://platform.openai.com/api-keys',
  },
  twilio: {
    label: 'Twilio',
    color: '#f22f46',
    rotate: 'Console → Account → API keys & tokens → crea una API key nueva o promueve el Secondary Auth Token.',
    revoke: 'Elimina la API key filtrada o descarta el Auth Token anterior.',
    url: 'https://console.twilio.com',
  },
  sendgrid: {
    label: 'SendGrid',
    color: '#1a82e2',
    rotate: 'Settings → API Keys → Create API Key con permisos restringidos.',
    revoke: 'Elimina la clave filtrada y revisa la actividad de envío.',
    url: 'https://app.sendgrid.com/settings/api_keys',
  },
  private_key: {
    label: 'Clave privada',
    color: '#8250df',
    rotate: 'Genera un nuevo par de claves (ssh-keygen / openssl) y distribuye la nueva clave pública donde corresponda.',
    revoke: 'Retira la clave pública antigua de servidores, deploy keys y authorized_keys; si era un certificado TLS, revócalo en la CA.',
  },
  jwt: {
    label: 'JWT / firma',
    color: '#d63aff',
    rotate: 'Genera un nuevo secreto de firma y despliega la aplicación con él.',
    revoke: 'Al cambiar el secreto se invalidan los tokens emitidos con el anterior; fuerza re-login si aplica.',
  },
  database: {
    label: 'Base de datos',
    color: '#336791',
    rotate: 'Cambia la contraseña del usuario (ALTER USER … PASSWORD) o crea un usuario nuevo y actualiza la cadena de conexión.',
    revoke: 'Elimina o bloquea el usuario anterior y revisa conexiones activas desde IPs desconocidas.',
  },
  generic: {
    label: 'Genérico',
    color: '#6e7781',
    rotate: 'Emite una credencial nueva en el servicio de origen y guárdala en un gestor de secretos, no en el código.',
    revoke: 'Invalida la credencial anterior en el servicio de origen y revisa sus registros de acceso.',
  },
};

export const providerGuide = (provider: string): SecretProviderGuide =>
  SECRET_PROVIDERS[provider] ?? SECRET_PROVIDERS.generic;

export const SECRET_STEPS: { id: SecretStep; label: string; hint: string }[] = [
  { id: 'rotated', label: 'Rotar', hint: 'Emite una credencial nueva y despliégala.' },
  { id: 'revoked', label: 'Revocar', hint: 'Invalida la credencial filtrada en el proveedor.' },
  {
    id: 'history_cleaned',
    label: 'Limpiar historial',
    hint: 'Quita el secreto del código y del historial de Git (git filter-repo o BFG).',
  },
  { id: 'verified', label: 'Verificar', hint: 'Confirma que la credencial vieja ya no funciona y re-escanea.' },
];
