import 'package:flutter/material.dart';
import '../widgets/bypass_confirmation_dialog.dart';

class BypassDetailActionsWidget extends StatelessWidget {
  final String bypassId;
  final Function(String action, String comment) onDecisionSubmitted;

  const BypassDetailActionsWidget({
    Key? key,
    required this.bypassId,
    required this.onDecisionSubmitted,
  }) : super(key: key);

  void _showDialog(BuildContext context, String action) {
    showDialog(
      context: context,
      builder: (context) => BypassConfirmationDialog(
        action: action,
        bypassId: bypassId,
        onConfirm: (comment) => onDecisionSubmitted(action, comment),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        ElevatedButton.icon(
          onPressed: () => _showDialog(context, 'approve'),
          icon: const Icon(Icons.check_circle),
          label: const Text('Aprobar'),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
        ),
        ElevatedButton.icon(
          onPressed: () => _showDialog(context, 'reject'),
          icon: const Icon(Icons.cancel),
          label: const Text('Rechazar'),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
        ),
      ],
    );
  }
}
