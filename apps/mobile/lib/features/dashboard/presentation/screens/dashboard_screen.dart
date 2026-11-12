import 'package:flutter/material.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('SSPILLOWY Pulse - Dashboard',
            style: TextStyle(color: Colors.white)),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Resumen de Seguridad DevSecOps',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                    child: _buildMetricCard(
                        'Escaneos Totales', '24', Colors.blueAccent)),
                const SizedBox(width: 12),
                Expanded(
                    child: _buildMetricCard(
                        'Hallazgos Críticos', '3', Colors.redAccent)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                    child: _buildMetricCard(
                        'Riesgos Aceptados', '5', Colors.orangeAccent)),
                const SizedBox(width: 12),
                Expanded(
                    child: _buildMetricCard(
                        'Estado Sistema', 'OK', Colors.greenAccent)),
              ],
            ),
            const SizedBox(height: 24),
            const Text(
              'Últimas Auditorías y Escaneos',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            _buildAuditTile(
                'SAST Scan - Backend FastAPI', 'Completado', Colors.green),
            _buildAuditTile(
                'SCA Dependency Check', 'Vulnerabilidad Crítica', Colors.red),
            _buildAuditTile('DAST Web Hub Scan', 'En Revisión', Colors.orange),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard(String title, String value, Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accentColor.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          const SizedBox(height: 8),
          Text(value,
              style: TextStyle(
                  color: accentColor,
                  fontSize: 22,
                  fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildAuditTile(String title, String status, Color statusColor) {
    return Card(
      color: const Color(0xFF1E293B),
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(title,
            style: const TextStyle(color: Colors.white, fontSize: 14)),
        subtitle:
            Text(status, style: TextStyle(color: statusColor, fontSize: 12)),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey),
      ),
    );
  }
}
