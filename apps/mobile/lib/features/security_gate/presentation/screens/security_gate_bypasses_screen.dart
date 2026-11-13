import '../../../../services/api_client.dart';
import 'package:flutter/material.dart';
import '../../../../repositories/incident_repository.dart';
import '../../../../screens/bypass_detail_screen.dart';
import '../../../../services/bypass_service.dart';

class SecurityGateBypassesScreen extends StatefulWidget {
  final IncidentRepository? repository;

  final bool isOnDuty;
  const SecurityGateBypassesScreen({
    this.isOnDuty = true,
    super.key,
    this.repository,
  });

  @override
  State<SecurityGateBypassesScreen> createState() =>
      _SecurityGateBypassesScreenState();
}

class _SecurityGateBypassesScreenState
    extends State<SecurityGateBypassesScreen> {
  late final BypassService _bypassService;
  List<dynamic> _allBypasses = [];
  List<dynamic> _filteredBypasses = [];
  bool _isLoading = true;
  String?
      _activeFilter; // null = Todos, 'hitl' = Temporizadas, 'block' = Bloqueos

  @override
  void initState() {
    super.initState();
    _bypassService = BypassService(ApiClient().dio);
    _fetchBypasses();
  }

  Future<void> _fetchBypasses() async {
    setState(() => _isLoading = true);

    List<dynamic> data = [];
    if (widget.repository != null) {
      try {
        data = await widget.repository!.getBypasses();
      } catch (_) {
        data = await _bypassService.getBypasses();
      }
    } else {
      data = await _bypassService.getBypasses();
    }

    if (mounted) {
      setState(() {
        _allBypasses = data;
        _applyFilter(_activeFilter);
        _isLoading = false;
      });
    }
  }

  void _applyFilter(String? filterType) {
    setState(() {
      if (_activeFilter == filterType) {
        _activeFilter = null;
      } else {
        _activeFilter = filterType;
      }

      if (_activeFilter == 'hitl') {
        _filteredBypasses = _allBypasses.where((item) {
          final map = Map<String, dynamic>.from(item is Map ? item : {});
          final status = (map['status'] ?? '').toString().toLowerCase();
          final type = (map['type'] ?? '').toString().toLowerCase();
          return status == 'pending' || status == 'approved' || type == 'hitl';
        }).toList();
      } else if (_activeFilter == 'block') {
        _filteredBypasses = _allBypasses.where((item) {
          final map = Map<String, dynamic>.from(item is Map ? item : {});
          final status = (map['status'] ?? '').toString().toLowerCase();
          final type = (map['type'] ?? '').toString().toLowerCase();
          return status == 'rejected' || status == 'blocked' || type == 'block';
        }).toList();
      } else {
        _filteredBypasses = List.from(_allBypasses);
      }
    });
  }

  void _openDetail(Map<String, dynamic> item) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => BypassDetailScreen(
            isOnDuty: widget.isOnDuty,
          bypassId: item['id']?.toString() ?? 'N/A',
          bypassService: _bypassService,
          initialData: item,
        ),
      ),
    );

    if (result == true) {
      _fetchBypasses();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bypasses & Excepciones'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchBypasses,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchBypasses,
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Gobernanza de Security Gates',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Aquí se resumen las excepciones autorizadas por el Tech Lead y los bloqueos permanentes de despliegue en el pipeline de CI/CD.',
                style: TextStyle(color: Colors.grey, fontSize: 13),
              ),
              const SizedBox(height: 20),
              InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: () => _applyFilter('hitl'),
                child: Card(
                  color: _activeFilter == 'hitl'
                      ? const Color(0xFF238636).withValues(alpha: 0.3)
                      : const Color(0xFF161B22),
                  shape: RoundedRectangleBorder(
                    side: BorderSide(
                      color: _activeFilter == 'hitl'
                          ? Colors.amber
                          : Colors.transparent,
                      width: 1,
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const ListTile(
                    leading: Icon(Icons.shield_outlined, color: Colors.amber),
                    title: Text('Excepciones Temporizadas (HITL)',
                        style: TextStyle(color: Colors.white)),
                    subtitle: Text(
                        'Permiten la continuidad de los pipelines durante 24h a 168h.',
                        style: TextStyle(color: Colors.grey, fontSize: 12)),
                    trailing: Icon(Icons.chevron_right, color: Colors.grey),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: () => _applyFilter('block'),
                child: Card(
                  color: _activeFilter == 'block'
                      ? Colors.redAccent.withValues(alpha: 0.2)
                      : const Color(0xFF161B22),
                  shape: RoundedRectangleBorder(
                    side: BorderSide(
                      color: _activeFilter == 'block'
                          ? Colors.redAccent
                          : Colors.transparent,
                      width: 1,
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const ListTile(
                    leading: Icon(Icons.block, color: Colors.redAccent),
                    title: Text('Bloqueos de Despliegue',
                        style: TextStyle(color: Colors.white)),
                    subtitle: Text(
                        'Detienen el pase a producción ante fallos o fugas críticas.',
                        style: TextStyle(color: Colors.grey, fontSize: 12)),
                    trailing: Icon(Icons.chevron_right, color: Colors.grey),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _activeFilter == 'hitl'
                        ? 'Filtrado: Excepciones HITL'
                        : _activeFilter == 'block'
                            ? 'Filtrado: Bloqueos'
                            : 'Solicitudes Registradas',
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w600),
                  ),
                  if (_activeFilter != null)
                    TextButton(
                      onPressed: () => _applyFilter(null),
                      child: const Text('Limpiar filtro'),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Expanded(
                child: _isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : _filteredBypasses.isEmpty
                        ? ListView(
                            children: [
                              SizedBox(
                                height:
                                    MediaQuery.of(context).size.height * 0.3,
                                child: Center(
                                  child: Text(
                                    _allBypasses.isEmpty
                                        ? 'No hay solicitudes de bypass registradas.'
                                        : 'No se encontraron registros para este filtro.',
                                    style: const TextStyle(color: Colors.grey),
                                  ),
                                ),
                              ),
                            ],
                          )
                        : ListView.builder(
                            itemCount: _filteredBypasses.length,
                            itemBuilder: (context, index) {
                              final item = Map<String, dynamic>.from(
                                  _filteredBypasses[index] is Map
                                      ? _filteredBypasses[index]
                                      : {});
                              final status = (item['status'] ?? 'pending')
                                  .toString()
                                  .toLowerCase();

                              Color statusColor = Colors.orange;
                              if (status == 'approved') {
                                statusColor = Colors.green;
                              }
                              if (status == 'rejected' || status == 'blocked') {
                                statusColor = Colors.red;
                              }

                              return Card(
                                color: const Color(0xFF0D1117),
                                margin: const EdgeInsets.symmetric(vertical: 4),
                                child: ListTile(
                                  onTap: () => _openDetail(item),
                                  leading: Icon(
                                    status == 'approved'
                                        ? Icons.check_circle_outline
                                        : status == 'rejected'
                                            ? Icons.highlight_off
                                            : Icons.pending_actions,
                                    color: statusColor,
                                  ),
                                  title: Text(
                                    item['rule'] ??
                                        item['title'] ??
                                        item['name'] ??
                                        'Bypass Request',
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w500),
                                  ),
                                  subtitle: Text(
                                    'Repo: ${item['repository'] ?? item['repo'] ?? 'N/A'} | Req: ${item['requestedBy'] ?? item['author'] ?? 'Sistema'}',
                                    style: const TextStyle(
                                        color: Colors.grey, fontSize: 12),
                                  ),
                                  trailing: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: statusColor.withValues(alpha: 0.2),
                                      borderRadius: BorderRadius.circular(4),
                                      border: Border.all(color: statusColor),
                                    ),
                                    child: Text(
                                      status.toUpperCase(),
                                      style: TextStyle(
                                          color: statusColor,
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}



