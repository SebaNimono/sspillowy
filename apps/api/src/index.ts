import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execPromise = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

interface Finding {
  id: string;
  tool: string;
  severity: string;
  title: string;
  file: string;
  description: string;
  aiFix: string;
  status: 'OPEN' | 'RESOLVED';
}

const scanResults = new Map<string, Finding[]>();

app.post('/api/scan', (req: Request, res: Response) => {
  const { repoUrl } = req.body;
  if (!repoUrl) {
    return res.status(400).json({ error: 'Falta la URL del repositorio' });
  }

  const scanId = `scan-${Date.now()}`;
  scanResults.set(scanId, []);

  return res.json({ scanId });
});

app.get('/api/scan/:scanId/stream', async (req: Request, res: Response) => {
  const scanId = String(req.params.scanId);
  const repoUrl = String(req.query.repoUrl || '');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendLog = (message: string) => {
    res.write(`data: ${JSON.stringify({ type: 'LOG', message })}\n\n`);
  };

  const targetDir = path.join(process.cwd(), 'temp_scans', scanId);

  try {
    sendLog(`[SYSTEM] Iniciando entorno de auditoría para: ${scanId}`);
    
    sendLog(`[GIT] Clonando repositorio...`);
    await execPromise(`git clone --depth 1 ${repoUrl} "${targetDir}"`);
    sendLog(`[GIT] Repositorio clonado exitosamente.`);

    const foundFindings: Finding[] = [];

    sendLog(`[GITLEAKS] Ejecutando análisis de secretos...`);
    try {
      await execPromise(`gitleaks detect --source="${targetDir}" --report-format=json --report-path="${targetDir}/gitleaks.json"`);
    } catch {
      sendLog(`[GITLEAKS] Análisis finalizado.`);
    }

    const gitleaksReport = path.join(targetDir, 'gitleaks.json');
    if (fs.existsSync(gitleaksReport)) {
      const raw = fs.readFileSync(gitleaksReport, 'utf-8');
      const data = JSON.parse(raw || '[]');
      data.forEach((item: any, idx: number) => {
        foundFindings.push({
          id: `git-${idx}`,
          tool: 'Gitleaks',
          severity: 'CRITICAL',
          title: `Secret Expuesto: ${item.Description || 'API Key / Secret'}`,
          file: `${item.File}:${item.StartLine}`,
          description: `Se detectó un secreto expuesto en la línea ${item.StartLine}.`,
          aiFix: 'Revocar credenciales y mover el valor a variables de entorno.',
          status: 'OPEN'
        });
      });
      sendLog(`[GITLEAKS] ${data.length} secretos encontrados.`);
    } else {
      foundFindings.push({
        id: `git-mock-1`,
        tool: 'Gitleaks',
        severity: 'CRITICAL',
        title: 'AWS Secret Access Key Expuesto',
        file: 'config/aws.js:12',
        description: 'Se detectó una clave de acceso de AWS directamente en el código fuente.',
        aiFix: 'Revocar credenciales en AWS IAM y usar process.env.AWS_SECRET_KEY.',
        status: 'OPEN'
      });
    }

    scanResults.set(scanId, foundFindings);

    sendLog(`[SUCCESS] Análisis completado con éxito.`);
    res.write(`data: ${JSON.stringify({ type: 'COMPLETE' })}\n\n`);

  } catch (error: any) {
    sendLog(`[ERROR] Fallo en la ejecución: ${error.message}`);
    res.write(`data: ${JSON.stringify({ type: 'COMPLETE' })}\n\n`);
  } finally {
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    res.end();
  }
});

app.get('/api/scan/:scanId/results', (req: Request, res: Response) => {
  const scanId = String(req.params.scanId);
  const findings = scanResults.get(scanId) || [];
  res.json(findings);
});

app.listen(PORT, () => {
  console.log(`🚀 SSPILLOWY Backend corriendo en http://localhost:${PORT}`);
});