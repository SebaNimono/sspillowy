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
  List<dynamic> _bypasses = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _bypassService = BypassService(Dio());
    _loadBypasses();
  }

  Future<void> _loadBypasses() async {
    setState(() => _isLoading = true);
    final data = await _bypassService.getBypasses();
    setState(() {
      _bypasses = List.from(data);
      _isLoading = false;
    });
  }

  void _handleDecision(int index, String action) {
    final item = _bypasses[index];
    setState(() {
      _bypasses.removeAt(index);
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Solicitud ${item['id'] ?? ''} $action')),
    );
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
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _bypasses.isEmpty
              ? const Center(
                  child: Text(
                    'No hay excepciones pendientes.',
                    style: TextStyle(fontSize: 16, color: Colors.grey),
                  ),
                )
              : ListView.builder(
                  itemCount: _bypasses.length,
                  padding: const EdgeInsets.all(16),
                  itemBuilder: (context, index) {
                    final item = _bypasses[index];
                    return Card(
                      elevation: 2,
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAlignment.start,
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
                                  onPressed: () => _handleDecision(index, 'rechazada'),
                                  child: const Text('Rechazar'),
                                ),
                                const SizedBox(width: 8),
                                ElevatedButton(
                                  onPressed: () => _handleDecision(index, 'aprobada'),
                                  child: const Text('Aprobar'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
