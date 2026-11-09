import 'package:flutter/material.dart';

typedef StringMap = Map<String, String>;

class AuditHistoryScreen extends StatefulWidget {
  final List<StringMap> auditLogs;

  const AuditHistoryScreen({super.key, required this.auditLogs});

  @override
  State<AuditHistoryScreen> createState() => _AuditHistoryScreenState();
}

class _AuditHistoryScreenState extends State<AuditHistoryScreen> {
  void _showLogDetail(BuildContext context, StringMap log) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF161B22),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              log['title'] ?? 'Detalle de Auditoría',
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white),
            ),
            const Divider(color: Color(0xFF303030)),
            const SizedBox(height: 8),
            Text('Detalle: ${log['subtitle']}',
                style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 8),
            Text('Estado: ${log['time']}',
                style: const TextStyle(color: Colors.amber)),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cerrar'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Historial de Auditoría')),
      body: widget.auditLogs.isEmpty
          ? const Center(
              child: Text(
                'Historial de auditoría vacío',
                style: TextStyle(color: Colors.grey),
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: widget.auditLogs.length,
              itemBuilder: (context, index) {
                final log = widget.auditLogs[index];
                return Card(
                  color: const Color(0xFF161B22),
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: Icon(
                      log['type'] == 'EXEMPTION'
                          ? Icons.shield
                          : log['type'] == 'BLOCK'
                              ? Icons.block
                              : Icons.delete_forever,
                      color: log['type'] == 'EXEMPTION'
                          ? Colors.amber
                          : log['type'] == 'BLOCK'
                              ? Colors.red
                              : Colors.grey,
                    ),
                    title: Text(log['title']!,
                        style: const TextStyle(color: Colors.white)),
                    subtitle: Text(log['subtitle']!,
                        style:
                            const TextStyle(color: Colors.grey, fontSize: 12)),
                    trailing: Text(log['time']!,
                        style:
                            const TextStyle(fontSize: 11, color: Colors.amber)),
                    onTap: () => _showLogDetail(context, log),
                  ),
                );
              },
            ),
    );
  }
}
