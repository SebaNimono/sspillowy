import 'package:flutter/material.dart';
import '../models/security_gates_overview_model.dart';
import '../services/overview_service.dart';

class SecurityGatesOverviewScreen extends StatefulWidget {
  final OverviewService overviewService;

  const SecurityGatesOverviewScreen({Key? key, required this.overviewService}) : super(key: key);

  @override
  State<SecurityGatesOverviewScreen> createState() => _SecurityGatesOverviewScreenState();
}

class _SecurityGatesOverviewScreenState extends State<SecurityGatesOverviewScreen> {
  late Future<SecurityGatesOverviewResponse?> _overviewFuture;

  @override
  void initState() {
    super.initState();
    _overviewFuture = widget.overviewService.getSecurityGatesOverview();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Security Gates Overview')),
      body: FutureBuilder<SecurityGatesOverviewResponse?>(
        future: _overviewFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return const Center(child: Text('Error al cargar la vista general de Security Gates'));
          }

          final data = snapshot.data!;
          return Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Card(
                  color: data.isBlocked ? Colors.red.shade100 : Colors.green.shade100,
                  child: ListTile(
                    leading: Icon(
                      data.isBlocked ? Icons.block : Icons.check_circle,
                      color: data.isBlocked ? Colors.red : Colors.green,
                    ),
                    title: Text(
                      data.isBlocked ? 'Despliegues BLOQUEADOS' : 'Despliegues PERMITIDOS',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      data.isBlocked
                          ? (data.blockReason ?? 'Razón no especificada')
                          : 'Todos los gates de seguridad están operativos',
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Estado de Repositorios', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Expanded(
                  child: ListView.builder(
                    itemCount: data.repositories.length,
                    itemBuilder: (context, index) {
                      final repo = data.repositories[index];
                      return Card(
                        child: ListTile(
                          title: Text(repo.name),
                          subtitle: Text('Último commit: ${repo.lastCommit ?? "N/A"}'),
                          trailing: Chip(
                            label: Text(repo.status),
                            backgroundColor: repo.status == 'OK' ? Colors.green.shade200 : Colors.orange.shade200,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
