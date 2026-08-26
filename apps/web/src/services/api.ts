export interface ScanRequest {
  repoUrl: string;
}

export interface Finding {
  id: string;
  tool: 'Gitleaks' | 'Semgrep' | 'Trivy' | 'OWASP ZAP';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  file: string;
  cwe?: string;
  description: string;
  aiFix: string;
  status: 'OPEN' | 'RESOLVED';
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const ApiService = {
  // Iniciar escaneo real en el backend
  async startScan(repoUrl: string): Promise<{ scanId: string }> {
    const response = await fetch(`${API_BASE_URL}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl }),
    });

    if (!response.ok) {
      throw new Error(`Error al iniciar escaneo: ${response.statusText}`);
    }

    return response.json();
  },

  // Obtener resultados del escaneo
  async getScanResults(scanId: string): Promise<Finding[]> {
    const response = await fetch(`${API_BASE_URL}/scan/${scanId}/results`);
    
    if (!response.ok) {
      throw new Error(`Error al obtener resultados: ${response.statusText}`);
    }

    return response.json();
  },

  // Enviar orden para aplicar un parche o fix automático
  async applyPatch(scanId: string, findingId: string): Promise<{ success: boolean; patchUrl?: string }> {
    const response = await fetch(`${API_BASE_URL}/scan/${scanId}/patch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findingId }),
    });

    if (!response.ok) {
      throw new Error(`Error al aplicar parche: ${response.statusText}`);
    }

    return response.json();
  }
};