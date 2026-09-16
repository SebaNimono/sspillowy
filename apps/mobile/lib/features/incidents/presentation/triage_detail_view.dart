import 'package:flutter/material.dart';
import '../domain/incident_model.dart';

class TriageDetailView extends StatefulWidget {
  final IncidentModel incident;
  final bool isOnDuty;

  const TriageDetailView({
    super.key,
    required this.incident,
    this.isOnDuty = true,
  });

  @override
  State<TriageDetailView> createState() => _TriageDetailViewState();
}

class _TriageDetailViewState extends State<TriageDetailView> {
  int? _selectedDurationHours;
  final TextEditingController _justificationController = TextEditingController();
  final TextEditingController _blockReasonController = TextEditingController();

  bool _isSubmitting = false;

  @override
  void dispose() {
    _justificationController.dispose();
    _blockReasonController.dispose();
    super.dispose();
  }

  bool get _canApprove {
    return widget.isOnDuty &&
        _selectedDurationHours != null &&
        _justificationController.text.trim().length >= 10;
  }

  bool get _canBlock {
    return widget.isOnDuty && _blockReasonController.text.trim().length >= 3;
  }

  void _showApproveConfirmationDialog() {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Confirmar Excepción'),
        content: Text(
          '¿Autorizar el pase a producción con esta vulnerabilidad activa por $_selectedDurationHours horas?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF238636),
            ),
            onPressed: () {
              Navigator.pop(dialogContext);
              _submitException();
            },
            child: const Text('Confirmar y Autorizar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showBlockConfirmationDialog() {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Confirmar Bloqueo'),
        content: const Text(
          '¿Estás seguro de confirmar el bloqueo de esta vulnerabilidad en el pipeline?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFCF222E),
            ),
            onPressed: () {
              Navigator.pop(dialogContext);
              _submitBlock();
            },
            child: const Text('Confirmar Bloqueo', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _submitException() async {
    setState(() => _isSubmitting = true);

    // Simulación de consumo API: POST /api/v1/incidents/{id}/exception
    await Future.delayed(const Duration(seconds: 1));

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Excepción aprobada exitosamente'),
        backgroundColor: Color(0xFF238636),
      ),
    );
    Navigator.pop(context, true);
  }

  Future<void> _submitBlock() async {
    setState(() => _isSubmitting = true);

    // Simulación de consumo API: POST /api/v1/incidents/{id}/block
    await Future.delayed(const Duration(seconds: 1));

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Bloqueo confirmado'),
        backgroundColor: Color(0xFFCF222E),
      ),
    );
    Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Triage: ${widget.incident.id}'),
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!widget.isOnDuty) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade100,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.amber.shade800),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.lock_clock_outlined, color: Colors.amber.shade900),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Modo solo lectura: Cambia a "On-Duty" en tu perfil para aprobar o bloquear.',
                            style: TextStyle(color: Colors.amber.shade900, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                // Header del Incidente
                Text(
                  widget.incident.title,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Chip(
                      label: Text(
                        widget.incident.severity.name.toUpperCase(),
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                      ),
                      backgroundColor: widget.incident.severity.name == 'CRITICAL'
                          ? const Color(0xFFCF222E)
                          : Colors.orange.shade800,
                    ),
                    const SizedBox(width: 8),
                    Chip(label: Text(widget.incident.type)),
                    const SizedBox(width: 8),
                    Chip(label: Text(widget.incident.repo)),
                  ],
                ),
                const SizedBox(height: 16),

                // Resumen de Pillow
                Card(
                  color: const Color(0xFFF6F8FA),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.auto_awesome, color: Color(0xFF8250DF)),
                            SizedBox(width: 8),
                            Text(
                              'Resumen de Pillow (IA Assistant)',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF8250DF),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          widget.incident.pillowSummary ?? 'Sin resumen disponible de la IA.',
                          style: const TextStyle(fontSize: 14, height: 1.4),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Snippet / Evidencia
                if (widget.incident.snippet != null) ...[
                  const Text('Evidencia del Hallazgo', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1F2328),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      widget.incident.snippet!,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        color: Color(0xFF7D8590),
                        fontSize: 12,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // Sección 1: Aprobar Excepción
                const Text(
                  'Aprobar Excepción Temporal',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text('Selecciona la duración de la excepción:', style: TextStyle(fontSize: 13)),
                const SizedBox(height: 8),
                SegmentedButton<int>(
                  segments: const [
                    ButtonSegment(value: 24, label: Text('24h')),
                    ButtonSegment(value: 72, label: Text('72h')),
                    ButtonSegment(value: 168, label: Text('7 días')),
                  ],
                  selected: _selectedDurationHours != null ? {_selectedDurationHours!} : {},
                  onSelectionChanged: widget.isOnDuty
                      ? (newSelection) {
                          setState(() {
                            _selectedDurationHours = newSelection.first;
                          });
                        }
                      : null,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _justificationController,
                  enabled: widget.isOnDuty,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: 'Justificación de la excepción (Mín. 10 caracteres)',
                    border: const OutlineInputBorder(),
                    helperText: '${_justificationController.text.trim().length}/10 caracteres mín.',
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF238636),
                      foregroundColor: Colors.white,
                    ),
                    onPressed: _canApprove ? _showApproveConfirmationDialog : null,
                    icon: const Icon(Icons.check_circle_outline),
                    label: const Text('Aprobar Excepción'),
                  ),
                ),

                const Divider(height: 40),

                // Sección 2: Confirmar Bloqueo
                const Text(
                  'Confirmar Bloqueo',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFFCF222E)),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _blockReasonController,
                  enabled: widget.isOnDuty,
                  decoration: InputDecoration(
                    labelText: 'Razón del bloqueo (Mín. 3 caracteres)',
                    border: const OutlineInputBorder(),
                    helperText: '${_blockReasonController.text.trim().length}/3 caracteres mín.',
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFCF222E),
                      foregroundColor: Colors.white,
                    ),
                    onPressed: _canBlock ? _showBlockConfirmationDialog : null,
                    icon: const Icon(Icons.block),
                    label: const Text('Confirmar Bloqueo'),
                  ),
                ),
              ],
            ),
          ),
          if (_isSubmitting)
            Container(
              color: Colors.black26,
              child: const Center(
                child: CircularProgressIndicator(),
              ),
            ),
        ],
      ),
    );
  }
}