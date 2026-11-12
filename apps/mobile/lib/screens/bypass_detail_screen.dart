import 'package:flutter/material.dart';
import '../services/biometric_guard.dart';
import '../services/bypass_service.dart';

class BypassDetailScreen extends StatefulWidget {
  final String bypassId;
  final BypassService bypassService;
  final Map<String, dynamic>? initialData;

  const BypassDetailScreen({
    super.key,
    required this.bypassId,
    required this.bypassService,
    this.initialData,
  });

  @override
  State<BypassDetailScreen> createState() => _BypassDetailScreenState();
}

class _BypassDetailScreenState extends State<BypassDetailScreen> {
  bool _isLoading = false;
  late String _status;
  Map<String, dynamic> _data = {};

  @override
  void initState() {
    super.initState();
    _data = widget.initialData ?? {};
    _status = (_data['status'] ?? 'PENDING').toString().toUpperCase();
  }

  void _confirmAndExecuteAction(bool isApprove) {
    final TextEditingController reasonController = TextEditingController();
    final actionText = isApprove ? 'Aprobar' : 'Rechazar';

    showDialog(
      context: context,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          title: Text('Confirmar $actionText Excepción'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '¿Estás seguro de que deseas $actionText esta excepción de seguridad? Se requerirá tu huella o rostro.',
              ),
              const SizedBox(height: 12),
              TextField(
                controller: reasonController,
                decoration: const InputDecoration(
                  labelText: 'Motivo / Comentario',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: isApprove ? Colors.green : Colors.red,
              ),
              onPressed: () async {
                final reason = reasonController.text;
                Navigator.of(dialogContext).pop();
                await _submitDecision(isApprove, reason);
              },
              child: Text(actionText),
            ),
          ],
        );
      },
    );
  }

  Future<void> _submitDecision(bool isApprove, String reason) async {
    final authenticated = await BiometricGuard.verifyIdentity(
      reason: isApprove
          ? 'Confirma con huella o rostro para APROBAR esta excepción'
          : 'Confirma con huella o rostro para RECHAZAR esta excepción',
    );

    if (!mounted) return;

    if (!authenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Autenticación biométrica cancelada o fallida. Acción no autorizada.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    final success = isApprove
        ? await widget.bypassService
            .approveBypass(widget.bypassId, reason: reason)
        : await widget.bypassService
            .rejectBypass(widget.bypassId, reason: reason);

    if (!mounted) return;

    setState(() => _isLoading = false);

    if (success) {
      setState(() => _status = isApprove ? 'APPROVED' : 'REJECTED');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Excepción ${isApprove ? "aprobada" : "rechazada"} y sincronizada con la Consola Web.',
          ),
          backgroundColor: isApprove ? Colors.green : Colors.red,
        ),
      );
      Navigator.pop(context, true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content:
              Text('Error al sincronizar con el servidor. Intente nuevamente.'),
          backgroundColor: Colors.orange,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Detalle de Excepción #${widget.bypassId}')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              color: const Color(0xFF161B22),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _data['rule'] ??
                          _data['title'] ??
                          'Excepción de Seguridad',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const Divider(height: 20, color: Colors.grey),
                    _buildDetailRow('Estado:', _status),
                    _buildDetailRow(
                        'Repositorio:',
                        (_data['repository'] ??
                                _data['repo'] ??
                                'No especificado')
                            .toString()),
                    _buildDetailRow(
                        'Solicitado Por:',
                        (_data['requestedBy'] ??
                                _data['requested_by'] ??
                                'Sistema')
                            .toString()),
                    _buildDetailRow(
                        'Justificación:',
                        (_data['reason'] ??
                                _data['justification'] ??
                                _data['note'] ??
                                'Sin detalle')
                            .toString()),
                    if (_data['createdAt'] != null ||
                        _data['created_at'] != null)
                      _buildDetailRow(
                          'Fecha:',
                          (_data['createdAt'] ?? _data['created_at'])
                              .toString()),
                  ],
                ),
              ),
            ),
            const Spacer(),
            if (_isLoading)
              const Center(child: CircularProgressIndicator())
            else if (_status == 'PENDING')
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        padding: const EdgeInsets.all(12),
                      ),
                      onPressed: () => _confirmAndExecuteAction(true),
                      icon: const Icon(Icons.fingerprint),
                      label: const Text('Aprobar'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red,
                        padding: const EdgeInsets.all(12),
                      ),
                      onPressed: () => _confirmAndExecuteAction(false),
                      icon: const Icon(Icons.fingerprint),
                      label: const Text('Rechazar'),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(
                  color: Colors.grey, fontWeight: FontWeight.w500),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.w400),
            ),
          ),
        ],
      ),
    );
  }
}
