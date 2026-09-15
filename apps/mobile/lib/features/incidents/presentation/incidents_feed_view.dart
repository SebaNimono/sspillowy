import 'package:flutter/material.dart';
import '../domain/incident_model.dart';
import '../../profile/presentation/profile_view.dart';
import 'incident_detail_view.dart';

class IncidentsFeedView extends StatefulWidget {
  const IncidentsFeedView({super.key});

  @override
  State<IncidentsFeedView> createState() => _IncidentsFeedViewState();
}

class _IncidentsFeedViewState extends State<IncidentsFeedView> {
  late Future<List<IncidentModel>> _incidentsFuture;
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadIncidents();
  }

  void _loadIncidents() {
    setState(() {
      _incidentsFuture = _getMockIncidents();
    });
  }

  Future<List<IncidentModel>> _getMockIncidents() async {
    await Future.delayed(const Duration(milliseconds: 600));
    return [
      IncidentModel(
        id: 'INC-101',
        title: 'Anomalía en Sensor de Presión - Sector A',
        description: 'Desviación del 15% en la lectura continua durante la guardia nocturna.',
        severity: IncidentSeverity.high,
        status: IncidentStatus.open,
        payload: '{"sensor": "PRESSURE_01", "value": 14.2}',
        createdAt: DateTime.now().subtract(const Duration(minutes: 45)),
      ),
      IncidentModel(
        id: 'INC-102',
        title: 'Fallo de Conexión Gateway IoT',
        description: 'Pérdida de paquetes en el nodo principal de transmisión HITL.',
        severity: IncidentSeverity.critical,
        status: IncidentStatus.open,
        payload: '{"gateway": "GW_MAIN", "packet_loss": "85%"}',
        createdAt: DateTime.now().subtract(const Duration(hours: 2)),
      ),
      IncidentModel(
        id: 'INC-103',
        title: 'Mantenimiento Preventivo Pendiente',
        description: 'Calibración programada de equipos de supervisión operativa.',
        severity: IncidentSeverity.low,
        status: IncidentStatus.resolved,
        payload: '{"unit": "SUP_CALIB_02"}',
        createdAt: DateTime.now().subtract(const Duration(hours: 5)),
      ),
      IncidentModel(
        id: 'INC-104',
        title: 'Alerta de Temperatura en Servidor Base',
        description: 'Superación del umbral térmico secundario en el rack de control.',
        severity: IncidentSeverity.medium,
        status: IncidentStatus.open,
        payload: '{"rack": "RACK_04", "temp_cels": 42.5}',
        createdAt: DateTime.now().subtract(const Duration(hours: 12)),
      ),
    ];
  }

  Color _getSeverityColor(IncidentSeverity severity) {
    switch (severity) {
      case IncidentSeverity.critical:
      case IncidentSeverity.high:
        return const Color(0xFFCF222E);
      case IncidentSeverity.medium:
        return const Color(0xFFD97706);
      case IncidentSeverity.low:
        return const Color(0xFF1F883D);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F8FA),
      appBar: AppBar(
        title: const Text('SSPILLOWY Pulse — Bandeja', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0969DA),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _loadIncidents,
          ),
        ],
      ),
      body: _currentIndex == 0 ? _buildFeedBody() : const ProfileView(),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        backgroundColor: Colors.white,
        selectedItemColor: const Color(0xFF0969DA),
        unselectedItemColor: Colors.black45,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.shield_outlined),
            activeIcon: Icon(Icons.shield),
            label: 'Incidentes',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }

  Widget _buildFeedBody() {
    return FutureBuilder<List<IncidentModel>>(
      future: _incidentsFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: Color(0xFF0969DA)));
        }

        final incidents = snapshot.data ?? [];

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: incidents.length,
          itemBuilder: (context, index) {
            final incident = incidents[index];
            final color = _getSeverityColor(incident.severity);

            return Card(
              color: Colors.white,
              elevation: 1,
              margin: const EdgeInsets.only(bottom: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: const BorderSide(color: Color(0xFFD0D7DE)),
              ),
              child: ListTile(
                contentPadding: const EdgeInsets.all(16),
                title: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: color.withAlpha(30),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: color, width: 1),
                      ),
                      child: Text(
                        incident.severity.name.toUpperCase(),
                        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        incident.id,
                        style: const TextStyle(color: Colors.black54, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 8),
                    Text(
                      incident.title,
                      style: const TextStyle(color: Color(0xFF1F2328), fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      incident.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.black87, fontSize: 13),
                    ),
                  ],
                ),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => IncidentDetailView(incident: incident),
                    ),
                  );
                },
              ),
            );
          },
        );
      },
    );
  }
}
