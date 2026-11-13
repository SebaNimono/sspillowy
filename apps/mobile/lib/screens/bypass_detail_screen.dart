import 'package:flutter/material.dart';
import '../services/biometric_guard.dart';
import '../services/bypass_service.dart';

class BypassDetailScreen extends StatefulWidget {
  final String bypassId;
  final BypassService bypassService;
  final Map<String, dynamic>? initialData;

  final bool isOnDuty;
  const BypassDetailScreen({
    this.isOnDuty = true,
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
  bool _isFetchingDetail = true;
  String? _fetchError;
  late String _status;
  Map<String, dynamic> _data = {};

  @override
  void initState() {
    super.initState();
    _data = widget.initialData ?? {};
    final initialStatus = (_data['status'] ?? '').toString().toUpperCase();
    _status = initialStatus.isNotEmpty ? initialStatus : 'UNKNOWN';
    _fetchBypassDetail();
  }

  bool get _isPendingExpired {
    if (_status == 'EXPIRED') return true;
    final rawDeadline = (_data['pending_expires_at'] ?? _data['expires_at'])?.toString();
    if (rawDeadline == null || rawDeadline.isEmpty) return false;
    final parsed = DateTime.tryParse(rawDeadline);
    if (parsed == null) return false;
    return parsed.toUtc().isBefore(DateTime.now().toUtc());
  }

  bool get _contextChanged => _data['context_changed'] == true;

  String? get _latestCommitSha {
    final sha = (_data['latest_commit_sha'] ?? '').toString().trim();
    return sha.isEmpty ? null : sha;
  }

  Future<void> _fetchBypassDetail() async {
    setState(() {
      _isFetchingDetail = true;
      _fetchError = null;
    });

    final fresh = await widget.bypassService.getBypassById(widget.bypassId);
    if (!mounted) return;

    setState(() {
      _isFetchingDetail = false;
      if (fresh != null) {
        _data = fresh;
        final fetchedStatus = (fresh['status'] ?? '').toString().toUpperCase();
        _status = fetchedStatus.isNotEmpty ? fetchedStatus : 'UNKNOWN';
      } else if (_data.isEmpty) {
        _fetchError =
            'No se pudo obtener el estado actualizado de esta solicitud desde el servidor.';
      }
    });
  }

  Future<void> _confirmAndExecuteAction(bool isApprove) async {
    if (!widget.isOnDuty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Activa el modo Guardia para aprobar o rechazar excepciones.'), backgroundColor: Colors.orange));
      return;
    }
    // Revalidar vigencia y contexto en tiempo real antes de aprobar/rechazar
    await _fetchBypassDetail();
    if (!mounted) return;

    if (_status != 'PENDING' || (isApprove && _isPendingExpired)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _isPendingExpired
                ? 'Esta solicitud expiró y ya no puede aprobarse.'
                : 'La solicitud ya no está pendiente (estado actual: $_status).',
          ),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    final TextEditingController reasonController = TextEditingController();
    final actionText = isApprove ? 'Aprobar' : 'Rechazar';
    bool ackContextChange = !_contextChanged;
    final expectedSha = _latestCommitSha;

    showDialog(
      context: context,
      builder: (BuildContext dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text('Confirmar $actionText Excepción'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '¿Estás seguro de que deseas $actionText esta excepción de seguridad? Se requerirá tu huella o rostro.',
                  ),
                  if (expectedSha != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Commit actual del repo: ${expectedSha.length > 8 ? expectedSha.substring(0, 8) : expectedSha}',
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ],
                  if (isApprove && _contextChanged) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.orange.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.orange),
                      ),
                      child: CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        value: ackContextChange,
                        onChanged: (v) => setDialogState(() => ackContextChange = v ?? false),
                        title: const Text(
                          'El repositorio tuvo un nuevo commit/escaneo tras esta solicitud. Confirmo que revisé el contexto actual.',
                          style: TextStyle(fontSize: 12),
                        ),
                      ),
                    ),
                  ],
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
                  onPressed: (isApprove && _contextChanged && !ackContextChange)
                      ? null
                      : () async {
                          final reason = reasonController.text;
                          Navigator.of(dialogContext).pop();
                          await _submitDecision(
                            isApprove,
                            reason,
                            expectedCommitSha: expectedSha,
                            acknowledgeContextChange: _contextChanged && ackContextChange,
                          );
                        },
                  child: Text(actionText),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _submitDecision(
    bool isApprove,
    String reason, {
    String? expectedCommitSha,
    bool acknowledgeContextChange = false,
  }) async {
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
        ? await widget.bypassService.approveBypass(
            widget.bypassId,
            reason: reason,
            expectedCommitSha: expectedCommitSha,
            acknowledgeContextChange: acknowledgeContextChange,
          )
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
      await _fetchBypassDetail();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            widget.bypassService.lastDecisionError ??
                'Error al sincronizar con el servidor. Intente nuevamente.',
          ),
          backgroundColor: Colors.orange,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final canAct = _status == 'PENDING' && !_isPendingExpired && _data.isNotEmpty;
    return Scaffold(
      appBar: AppBar(
        title: Text('Detalle de Excepción #${widget.bypassId}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Actualizar desde servidor',
            onPressed: _isFetchingDetail ? null : _fetchBypassDetail,
          ),
        ],
      ),
      body: _isFetchingDetail && _data.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_fetchError != null)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade900.withValues(alpha: 0.35),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.redAccent),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded,
                              color: Colors.redAccent),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _fetchError!,
                              style: const TextStyle(
                                  color: Colors.white, fontSize: 12.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (_status == 'PENDING' && _isPendingExpired)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade900.withValues(alpha: 0.35),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.orangeAccent),
                      ),
                      child: const Text(
                        'Esta solicitud pendiente ha vencido y ya no puede aprobarse.',
                        style: TextStyle(color: Colors.white, fontSize: 12.5),
                      ),
                    ),
                  if (_status == 'PENDING' && !_isPendingExpired && _contextChanged)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade900.withValues(alpha: 0.35),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.amber),
                      ),
                      child: Text(
                        'Contexto actualizado: el repositorio registró un nuevo escaneo/commit (${_latestCommitSha != null && _latestCommitSha!.length > 8 ? _latestCommitSha!.substring(0, 8) : (_latestCommitSha ?? "nuevo")}) después de crearse esta solicitud.',
                        style: const TextStyle(color: Colors.white, fontSize: 12.5),
                      ),
                    ),
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
                          _buildDetailRow(
                              'Estado:',
                              _isPendingExpired && _status == 'PENDING'
                                  ? 'EXPIRED (Vencida)'
                                  : (_status == 'UNKNOWN'
                                      ? 'No verificado'
                                      : _status)),
                          _buildDetailRow(
                              'Repositorio:',
                              (_data['repository_name'] ??
                                      _data['repository'] ??
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
                          if (_latestCommitSha != null)
                            _buildDetailRow('Commit actual:', _latestCommitSha!),
                          if (_data['pending_expires_at'] != null)
                            _buildDetailRow(
                                'Vence aprobación:',
                                _data['pending_expires_at'].toString()),
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
                  else if (canAct)
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

