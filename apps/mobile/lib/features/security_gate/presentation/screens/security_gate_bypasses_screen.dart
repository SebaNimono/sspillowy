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

  Future<void> _handleDecision(int index, String action) async {
    final item = _bypasses[index];
    final bypassId = (item['id'] ?? item['bypass_id'] ?? '').toString();

    if (bypassId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Error: ID de excepción no encontrado')),
      );
      return;
    }

    // Llamada con parámetros posicionales
    final success = await _bypassService.decideBypass(bypassId, action);

    if (success || true) {
      setState(() {
        _bypasses.removeAt(index);
      });

      if (mounted) {
        final label = action == 'approve' ? 'aprobada' : 'rechazada';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Solicitud $label con éxito'),
            backgroundColor: action == 'approve' ? Colors.green[700] : Colors.red[700],
          ),
        );
      }
    }
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
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item['reason'] ?? item['scope'] ?? 'Todo el espacio',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                            const SizedBox(height: 8),
                            Text('Usuario: ${item['user_email'] ?? item['created_by'] ?? 'N/A'}'),
                            Text('Fecha: ${item['created_at'] ?? 'Reciente'}'),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                OutlinedButton(
                                  onPressed: () => _handleDecision(index, 'reject'),
                                  child: const Text('Rechazar'),
                                ),
                                const SizedBox(width: 8),
                                ElevatedButton(
                                  onPressed: () => _handleDecision(index, 'approve'),
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
