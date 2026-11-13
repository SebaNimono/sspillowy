import 'package:flutter/material.dart';
import '../services/api_client.dart';

typedef StringMap = Map<String, String>;

class AuditHistoryScreen extends StatefulWidget {
  final List<StringMap> auditLogs;

  const AuditHistoryScreen({super.key, required this.auditLogs});

  @override
  State<AuditHistoryScreen> createState() => _AuditHistoryScreenState();
}

class _AuditHistoryScreenState extends State<AuditHistoryScreen> {
  final ApiClient _apiClient = ApiClient();
  bool _isLoading = true;
  String? _errorMsg;
  List<StringMap> _serverLogs = [];

  @override
  void initState() {
    super.initState();
    _fetchServerAuditLogs();
  }

  Future<void> _fetchServerAuditLogs() async {
    setState(() {
      _isLoading = true;
      _errorMsg = null;
    });
    try {
      final token = await ApiClient.readStoredToken();
      if (token != null && token.isNotEmpty) {
        _apiClient.setAuthToken(token);
      }
      final res = await _apiClient.get('/audit-log');
      if (res.statusCode == 200 && res.data != null) {
        final raw = res.data is List
            ? res.data as List
            : (res.data is Map
                ? ((res.data['items'] ?? res.data['logs'] ?? res.data['events'] ?? []) as List)
                : []);
        final mapped = <StringMap>[];
        for (final item in raw) {
          if (item is Map) {
            final action = (item['action'] ?? item['event_type'] ?? 'EVENTO').toString();
            final target = (item['target'] ?? item['resource'] ?? '').toString();
            final detail = (item['detail'] ?? item['summary'] ?? item['reason'] ?? '').toString();
            final actor = (item['actor'] ?? item['user_email'] ?? '').toString();
            final ts = (item['created_at'] ?? item['timestamp'] ?? '').toString();
            final upper = action.toUpperCase();
            final type = upper.contains('BYPASS') || upper.contains('EXEMPT') || upper.contains('ACCEPT')
                ? 'EXEMPTION'
                : (upper.contains('BLOCK') || upper.contains('REJECT')
                    ? 'BLOCK'
                    : 'INFO');
            mapped.add({
              'id': (item['id'] ?? '').toString(),
              'type': type,
              'title': target.isNotEmpty ? '$action • $target' : action,
              'subtitle': [if (actor.isNotEmpty) 'Por: $actor', if (detail.isNotEmpty) detail].join(' — '),
              'time': ts.isNotEmpty ? ts : 'Servidor',
            });
          }
        }
        if (mounted) {
          setState(() {
            _serverLogs = mapped;
            _isLoading = false;
          });
        }
        return;
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _errorMsg = 'No se pudo consultar el historial oficial del servidor.';
        });
      }
    }
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

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
            Text('Detalle: ${log['subtitle'] ?? ''}',
                style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 8),
            Text('Registro: ${log['time'] ?? ''}',
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
    final combined = _serverLogs.isNotEmpty ? _serverLogs : widget.auditLogs;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Historial de Auditoría'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Sincronizar con servidor',
            onPressed: _isLoading ? null : _fetchServerAuditLogs,
          ),
        ],
      ),
      body: _isLoading && combined.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : combined.isEmpty
              ? Center(
                  child: Text(
                    _errorMsg ?? 'No hay eventos de auditoría registrados.',
                    style: const TextStyle(color: Colors.grey),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: combined.length,
                  itemBuilder: (context, index) {
                    final log = combined[index];
                    return Card(
                      color: const Color(0xFF161B22),
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: Icon(
                          log['type'] == 'EXEMPTION'
                              ? Icons.shield
                              : log['type'] == 'BLOCK'
                                  ? Icons.block
                                  : Icons.history,
                          color: log['type'] == 'EXEMPTION'
                              ? Colors.amber
                              : log['type'] == 'BLOCK'
                                  ? Colors.red
                                  : Colors.lightBlueAccent,
                        ),
                        title: Text(log['title'] ?? 'Evento',
                            style: const TextStyle(color: Colors.white)),
                        subtitle: Text(log['subtitle'] ?? '',
                            style: const TextStyle(
                                color: Colors.grey, fontSize: 12)),
                        trailing: Text(log['time'] ?? '',
                            style: const TextStyle(
                                fontSize: 11, color: Colors.amber)),
                        onTap: () => _showLogDetail(context, log),
                      ),
                    );
                  },
                ),
    );
  }
}
