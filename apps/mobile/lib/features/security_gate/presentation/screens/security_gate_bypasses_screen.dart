import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../../../../services/bypass_service.dart';

class SecurityGateBypassesScreen extends StatefulWidget {
  const SecurityGateBypassesScreen({Key? key}) : super(key: key);

  @override
  State<SecurityGateBypassesScreen> createState() => _SecurityGateBypassesScreenState();
}

class _SecurityGateBypassesScreenState extends State<SecurityGateBypassesScreen> {
  late BypassService _bypassService;
  Future<List<dynamic>>? _bypassesFuture;

  @override
  void initState() {
    super.initState();
    _bypassService = BypassService(Dio());
    _loadBypasses();
  }

  void _loadBypasses() {
    setState(() {
      _bypassesFuture = _bypassService.getBypasses();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Excepciones Security Gate'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadBypasses,
          ),
        ],
      ),
      body: FutureBuilder<List<dynamic>>(
        future: _bypassesFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final list = snapshot.data ?? [];
          if (list.isEmpty) {
            return const Center(child: Text('No hay excepciones pendientes.'));
          }

          return ListView.builder(
            itemCount: list.length,
            padding: const EdgeInsets.all(16),
            itemBuilder: (context, index) {
              final item = list[index];
              return Card(
                elevation: 2,
                margin: const EdgeInsets.only(bottom: 12),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item['reason'] ?? 'Sin motivo',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      const SizedBox(height: 8),
                      Text('Ámbito: ${item['scope'] ?? 'Todo el espacio'}'),
                      Text('Duración: ${item['duration'] ?? '1 día'}'),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          OutlinedButton(
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Solicitud rechazada')),
                              );
                            },
                            child: const Text('Rechazar'),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Excepción aprobada exitosamente')),
                              );
                            },
                            child: const Text('Aprobar'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
