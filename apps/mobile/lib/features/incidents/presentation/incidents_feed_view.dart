import 'package:flutter/material.dart';
import '../../profile/presentation/profile_view.dart';

class Incident {
  final String id;
  final String title;
  final String severity; // CRITICAL, HIGH, MEDIUM, LOW
  final String status;   // PENDING, APPROVED, REJECTED
  final String timestamp;
  final String summary;

  Incident({
    required this.id,
    required this.title,
    required this.severity,
    required this.status,
    required this.timestamp,
    required this.summary,
  });
}

class IncidentsFeedView extends StatefulWidget {
  final VoidCallback onLogout;

  const IncidentsFeedView({super.key, required this.onLogout});

  @override
  State<IncidentsFeedView> createState() => _IncidentsFeedViewState();
}

class _IncidentsFeedViewState extends State<IncidentsFeedView> {
  final List<Incident> _incidents = [
    Incident(
      id: 'INC-8921',
      title: 'Fuga de memoria detectada en microservicio Auth',
      severity: 'CRITICAL',
      status: 'PENDING',
      timestamp: 'Hace 5 min',
      summary: 'El uso de RAM superó el 95%. Se requiere reinicio controlado o degradación de tráfico.',
    ),
    Incident(
      id: 'INC-8920',
      title: 'Tasa elevada de errores 500 en Pasarela de Pagos',
      severity: 'HIGH',
      status: 'PENDING',
      timestamp: 'Hace 18 min',
      summary: 'Rechazo inusual de transacciones con Stripe. Agente sugiere fallback a proveedor secundario.',
    ),
    Incident(
      id: 'INC-8918',
      title: 'Latencia inusual en base de datos de lectura',
      severity: 'MEDIUM',
      status: 'APPROVED',
      timestamp: 'Hace 1 hora',
      summary: 'Acción ejecutada: Escalado horizontal automático de 2 a 4 réplicas de lectura.',
    ),
  ];

  Color _getSeverityColor(String severity) {
    switch (severity) {
      case 'CRITICAL':
        return const Color(0xFFCF222E);
      case 'HIGH':
        return Colors.orange;
      case 'MEDIUM':
        return const Color(0xFFD29922);
      default:
        return const Color(0xFF0969DA);
    }
  }

  void _updateStatus(String id, String newStatus) {
    setState(() {
      final index = _incidents.indexWhere((i) => i.id == id);
      if (index != -1) {
        final current = _incidents[index];
        _incidents[index] = Incident(
          id: current.id,
          title: current.title,
          severity: current.severity,
          status: newStatus,
          timestamp: current.timestamp,
          summary: current.summary,
        );
      }
    });

    final actionText = newStatus == 'APPROVED' ? 'Aprobado' : 'Rechazado';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Incidente $id $actionText'),
        backgroundColor: newStatus == 'APPROVED' ? const Color(0xFF238636) : const Color(0xFFCF222E),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      appBar: AppBar(
        title: const Text('SSPillowy Incidentes', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1F2328),
        actions: [
          IconButton(
            icon: const Icon(Icons.account_circle_outlined, color: Colors.white, size: 28),
            tooltip: 'Perfil de Usuario',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const ProfileView()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white70),
            tooltip: 'Cerrar Sesión',
            onPressed: widget.onLogout,
          ),
        ],
      ),
      body: _incidents.isEmpty
          ? const Center(
              child: Text('No hay incidentes reportados', style: TextStyle(color: Colors.white54)),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16.0),
              itemCount: _incidents.length,
              itemBuilder: (context, index) {
                final item = _incidents[index];
                final isPending = item.status == 'PENDING';

                return Card(
                  color: const Color(0xFF1F2328),
                  margin: const EdgeInsets.only(bottom: 16.0),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: BorderSide(
                      color: isPending ? _getSeverityColor(item.severity) : Colors.white12,
                      width: isPending ? 1.5 : 0.5,
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: _getSeverityColor(item.severity).withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                item.severity,
                                style: TextStyle(
                                  color: _getSeverityColor(item.severity),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                            Text(
                              item.timestamp,
                              style: const TextStyle(color: Colors.white38, fontSize: 12),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${item.id}: ${item.title}',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          item.summary,
                          style: const TextStyle(color: Colors.white70, fontSize: 14),
                        ),
                        const SizedBox(height: 16),
                        if (isPending) ...[
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: const Color(0xFFCF222E),
                                    side: const BorderSide(color: Color(0xFFCF222E)),
                                  ),
                                  onPressed: () => _updateStatus(item.id, 'REJECTED'),
                                  child: const Text('Bloquear / Rechazar'),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF238636),
                                  ),
                                  onPressed: () => _updateStatus(item.id, 'APPROVED'),
                                  child: const Text('Aprobar Acción', style: TextStyle(color: Colors.white)),
                                ),
                              ),
                            ],
                          ),
                        ] else ...[
                          Container(
                            padding: const EdgeInsets.all(8),
                            width: double.infinity,
                            decoration: BoxDecoration(
                              color: item.status == 'APPROVED' 
                                  ? Colors.green.withValues(alpha: 0.1) 
                                  : Colors.red.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              item.status == 'APPROVED' ? '✓ Acción ejecutada por el operador' : '✕ Acción bloqueada por el operador',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: item.status == 'APPROVED' ? Colors.greenAccent : Colors.redAccent,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}