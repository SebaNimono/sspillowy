import 'package:flutter/material.dart';

class ScanDetailScreen extends StatelessWidget {
  final Map<String, dynamic> scanData;
  final List<Map<String, dynamic>> findings;
  final bool isLoading;
  final String? errorMessage;
  final VoidCallback? onRetry;

 const ScanDetailScreen({
    super.key,
    required this.scanData,
    this.findings = const [],
    this.isLoading = false,
    this.errorMessage,
    this.onRetry,
  });
  
  @override
  Widget build(BuildContext context) {
    final title = scanData['title'] ?? 'Escaneo sin título';
    final status = scanData['status'] ?? 'DESCONOCIDO';
    final severity = scanData['severity'] ?? 'INFO';
    final scanId = scanData['id']?.toString() ?? 'Sin ID';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Detalle de Escaneo'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Chip(
                  label: Text(severity.toUpperCase()),
                  backgroundColor: severity == 'CRITICAL' ? Colors.redAccent : Colors.orangeAccent,
                ),
                Chip(
                  label: Text('Estado: $status'),
                  backgroundColor: Colors.blueGrey.shade100,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('ID API: $scanId', style: const TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 16),
            const Divider(),
            const Text('Hallazgos Relacionados', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Expanded(
              child: Builder(
                builder: (context) {
                  if (isLoading) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (errorMessage != null) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline, color: Colors.red, size: 48),
                          const SizedBox(height: 8),
                          Text('Error al cargar hallazgos: $errorMessage'),
                          const SizedBox(height: 12),
                          ElevatedButton(
                            onPressed: onRetry ?? () => Navigator.of(context).pop(),
                            child: const Text('Reintentar / Volver'),
                          ),
                        ],
                      ),
                    );
                  }

                  if (findings.isEmpty) {
                    return const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.search_off, color: Colors.grey, size: 48),
                          SizedBox(height: 8),
                          Text('No hay hallazgos registrados para este escaneo.'),
                        ],
                      ),
                    );
                  }

                  return ListView.builder(
                    itemCount: findings.length,
                    itemBuilder: (context, index) {
                      final item = findings[index];
                      return Card(
                        child: ListTile(
                          title: Text(item['title'] ?? 'Hallazgo sin título'),
                          subtitle: Text(item['description'] ?? 'Sin detalle'),
                          trailing: Chip(
                            label: Text(item['severity'] ?? 'INFO'),
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
