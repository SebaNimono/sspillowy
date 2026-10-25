import 'package:flutter/material.dart';

class BypassConfirmationDialog extends StatelessWidget {
  final String action;
  final String bypassId;
  final Function(String comment) onConfirm;

  const BypassConfirmationDialog({
    Key? key,
    required this.action,
    required this.bypassId,
    required this.onConfirm,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final TextEditingController commentController = TextEditingController();
    final bool isApprove = action.toLowerCase() == 'approve';

    return AlertDialog(
      title: Text(isApprove ? 'Aprobar Excepción' : 'Rechazar Excepción'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('¿Estás seguro de que deseas ${isApprove ? "aprobar" : "rechazar"} esta solicitud de bypass?'),
          const SizedBox(height: 12),
          TextField(
            controller: commentController,
            decoration: const InputDecoration(
              labelText: 'Justificación / Comentario (opcional)',
              border: OutlineInputBorder(),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: isApprove ? Colors.green : Colors.red,
          ),
          onPressed: () {
            Navigator.of(context).pop();
            onConfirm(commentController.text);
          },
          child: Text(isApprove ? 'Aprobar' : 'Rechazar'),
        ),
      ],
    );
  }
}
