export type ToolType = 'Gitleaks' | 'Semgrep' | 'Trivy' | 'OWASP ZAP';
export type SeverityType = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Finding {
  id: string;
  tool: ToolType;
  severity: SeverityType;
  title: string;
  file: string;
  cwe: string;
  cvss: number;
  description: string;
  aiFix: string;
  codeSnippet?: string;
  status: 'OPEN' | 'IN_TRIAGE' | 'RESOLVED';
}

export const MOCK_FINDINGS: Finding[] = [
  {
    id: "VULN-001",
    tool: "Gitleaks",
    severity: "CRITICAL",
    title: "AWS Secret Access Key Expuesto",
    file: "config/aws.js:12",
    cwe: "CWE-798",
    cvss: 9.8,
    description: "Se detectó una clave secreta de AWS insertada directamente en el código fuente. Esto permite acceso completo a la infraestructura si el repositorio se filtra.",
    aiFix: "Revocar la clave inmediatamente en AWS IAM. Mover las credenciales a variables de entorno (`process.env.AWS_SECRET_KEY`) o usar AWS Secrets Manager.",
    codeSnippet: "const aws_secret = 'AKIAIOSFODNN7EXAMPLE';",
    status: "OPEN"
  },
  {
    id: "VULN-002",
    tool: "Semgrep",
    severity: "HIGH",
    title: "Inyección SQL Directa (Raw Query)",
    file: "apps/api/src/users.py:45",
    cwe: "CWE-89",
    cvss: 8.5,
    description: "Concatenación de entradas de usuario no sanitizadas directamente en consultas SQL.",
    aiFix: "Utilizar consultas parametrizadas o sentencias preparadas mediante el ORM (SQLAlchemy/Django ORM).",
    codeSnippet: "cursor.execute(f'SELECT * FROM users WHERE id = {user_input}')",
    status: "OPEN"
  },
  {
    id: "VULN-003",
    tool: "Trivy",
    severity: "MEDIUM",
    title: "CVE-2023-45857: Dependencia desactualizada (urllib3)",
    file: "apps/api/requirements.txt",
    cwe: "CWE-1104",
    cvss: 6.2,
    description: "Vulnerabilidad en el manejo de descompresión gzip en la librería urllib3.",
    aiFix: "Actualizar la versión de urllib3 a >= 1.26.5 o >= 2.0.0 en el manifiesto de dependencias.",
    codeSnippet: "urllib3==1.25.9",
    status: "OPEN"
  },
  {
    id: "VULN-004",
    tool: "OWASP ZAP",
    severity: "LOW",
    title: "Falta Encabezado Anti-Clickjacking",
    file: "apps/web/index.html",
    cwe: "CWE-1021",
    cvss: 3.4,
    description: "El servidor no envía la cabecera X-Frame-Options o Content-Security-Policy frame-ancestors.",
    aiFix: "Configurar el servidor web (Nginx/Cloudflare) para emitir el encabezado `X-Frame-Options: DENY`.",
    status: "RESOLVED"
  }
];