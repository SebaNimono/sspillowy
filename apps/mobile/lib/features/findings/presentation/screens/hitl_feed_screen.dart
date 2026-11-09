import 'package:flutter/material.dart';
import '../../data/services/finding_service.dart';

class HitlFeedScreen extends StatefulWidget {
  final String sessionId;
  final VoidCallback onUnauthorized;

  const HitlFeedScreen({
    super.key,
    required this.sessionId,
    required this.onUnauthorized,
  });

  @override
  State<HitlFeedScreen> createState() => _HitlFeedScreenState();
}

class _HitlFeedScreenState extends State<HitlFeedScreen> {
  final FindingService _findingService = FindingService();
  late Future<List<dynamic>> _findingsFuture;

  @override
  void initState() {
    super.initState();
    _loadFindings();
  }

  void _loadFindings() {
    setState(() {
      _findingsFuture = _findingService.fetchFindings(sessionId: widget.sessionId);
    });
  }

  Future<void> _changeStatus(String findingId, String status) async {
    try {
      final success = await _findingService.updateFindingStatus(
        sessionId: widget.sessionId,
        findingId: findingId,
        newStatus: status,
      );
      if (success) {
        _loadFindings();
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error al actualizar estado: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Feed HITL - Hallazgos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadFindings,
          ),
        ],
      ),
      body: FutureBuilder<List<dynamic>>(
        future: _findingsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            final errorStr = snapshot.error.toString();
            if (errorStr.contains('401') || errorStr.contains('403')) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                widget.onUnauthorized();
              });
            }

            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 48),
                  const SizedBox(height: 8),
                  Text('Error al cargar hallazgos: ${snapshot.error}'),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _loadFindings,
                    child: const Text('Reintentar'),
                  ),
                ],
              ),
            );
          }

          final List findings = snapshot.data ?? [];
          if (findings.isEmpty) {
            return const Center(
              child: Text('No hay hallazgos disponibles en el feed HITL.'),
            );
          }

          return ListView.builder(
            itemCount: findings.length,
            itemBuilder: (context, index) {
              final item = findings[index];
              final id = item['id']?.toString() ?? '';
              final title = item['title'] ?? 'Sin título';
              final severity = item['severity'] ?? 'INFO';
              final status = item['status'] ?? 'OPEN';
              final repo = item['repository'] ?? 'N/A';

              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Chip(
                            label: Text(severity),
                            backgroundColor: severity == 'CRITICAL'
                                ? Colors.redAccent
                                : Colors.orangeAccent,
                          ),
                          Chip(
                            label: Text(status),
                            backgroundColor: Colors.blueGrey.shade100,
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      Text('Repo: $repo', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            onPressed: () => _changeStatus(id, 'ACCEPTED_RISK'),
                            child: const Text('Riesgo Aceptado'),
                          ),
                          ElevatedButton(
                            onPressed: () => _changeStatus(id, 'FIXED'),
                            child: const Text('Marcar Corregido'),
                          ),
                        ],
                      )
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}