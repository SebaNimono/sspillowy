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
  List<dynamic> _pendingBypasses = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _bypassService = BypassService(Dio());
    _fetchBypasses();
  }

  Future<void> _fetchBypasses() async {
    setState(() => _isLoading = true);
    final results = await _bypassService.getBypasses();
    
    setState(() {
      // Filtramos las pendientes para la pestaña de Bypasses
      _pendingBypasses = results.where((item) {
        final status = (item['status'] ?? 'PENDING').toString().toUpperCase();
        return status == 'PENDING' || status == 'ESPERANDO APROBACIÓN';
      }).toList();
      
      _isLoading = false;
    });
  }

  Future<void> _handleDecision(int index, String action) async {
    final item = _pendingBypasses[index];
    final bypassId = item['id'] ?? item['bypass_id'] ?? '';

    final success = await _bypassService.decideBypass(
      bypassId: bypassId,
      action: action, // 'approve' o 'reject'
      note: 'Procesado desde la app móvil',
    );

    if (success) {
      setState(() {
        _pendingBypasses.removeAt(index);
      });

      if (mounted) {
        final label = action == 'approve' ? 'aprobada' : 'rechazada';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Excepción $label en la base de datos central'),
            backgroundColor: action == 'approve' ? Colors.green[700] : Colors.red[700],
          ),
        );
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Error al procesar la decisión en el servidor'),
            backgroundColor: Colors.redAccent,
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
            onPressed: _fetchBypasses,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _pendingBypasses.isEmpty
              ? const Center(
                  child: Text(
                    'No hay excepciones pendientes.',
                    style: TextStyle(fontSize: 16, color: Colors.grey),
                  ),
                )
              : ListView.builder(
                  itemCount: _pendingBypasses.length,
                  padding: const EdgeInsets.all(16),
                  itemBuilder: (context, index) {
                    final item = _pendingBypasses[index];
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
