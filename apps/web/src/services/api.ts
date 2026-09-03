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

const BASE_URL = 'https://api.sspillowy.com/api/v1';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  data?: any;
  message?: string;
}

/**
 * Petición de inicio de sesión contra la API de producción
 */
export const loginUser = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        data,
      };
    } else {
      return {
        success: false,
        message: data.message || 'Error al iniciar sesión',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Error de conexión con el servidor',
    };
  }
};

/**
 * Petición para solicitar un escaneo
 */
export const startScan = async (scanData: ScanRequest) => {
  try {
    const response = await fetch(`${BASE_URL}/scans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(scanData),
    });
    return await response.json();
  } catch (error) {
    return { success: false, message: 'Error al iniciar escaneo' };
  }
};

/**
 * Petición para obtener la lista de hallazgos (findings)
 */
export const getFindings = async (): Promise<Finding[]> => {
  try {
    const response = await fetch(`${BASE_URL}/findings`, {
      headers: { 'Accept': 'application/json' },
    });
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    return [];
  }
};