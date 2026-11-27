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
        _applyFilter(_activeFilter, toggle: false);
        _isLoading = false;
      });
    }
  }

  void _applyFilter(String? filterType, {bool toggle = true}) {
    setState(() {
      if (toggle && _activeFilter == filterType) {
        _activeFilter = null;
      } else {
        _activeFilter = filterType;
      }

      if (_activeFilter == 'hitl') {
        _filteredBypasses = _allBypasses.where((item) {
          final map = Map<String, dynamic>.from(item is Map ? item : {});
          final status = (map['status'] ?? '').toString().toLowerCase();
          final type = (map['type'] ?? '').toString().toLowerCase();
          return status == 'pending' ||
              status == 'approved' ||
              status == 'exempted' ||
              type == 'hitl';
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

  String _pickField(Map<String, dynamic> item, List<String> keys, String fallback) {
    for (final key in keys) {
      final val = item[key];
      if (val != null) {
        if (val is Map) {
          final nested = (val['name'] ?? val['full_name'] ?? val['email'] ?? val['title'])?.toString().trim();
          if (nested != null && nested.isNotEmpty && nested != 'null') {
            return nested;
          }
        } else {
          final text = val.toString().trim();
          if (text.isNotEmpty && text != 'null') {
            return text;
          }
        }
      }
    }
    return fallback;
  }

  void _openDetail(Map<String, dynamic> item) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => BypassDetailScreen(
          isOnDuty: widget.isOnDuty,
          bypassId: (item['id'] ?? item['_id'] ?? 'N/A').toString(),
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
              const SizedBox(height: 6),
              const Text(
                'Toca una categoría para filtrar la lista inferior de solicitudes.',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
              ),
              const SizedBox(height: 14),
              InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => _applyFilter('hitl'),
                child: Container(
                  decoration: BoxDecoration(
                    color: _activeFilter == 'hitl'
                        ? Colors.amber.withValues(alpha: 0.16)
                        : const Color(0xFF161B22),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: _activeFilter == 'hitl'
                          ? Colors.amber
                          : const Color(0xFF30363D),
                      width: _activeFilter == 'hitl' ? 1.5 : 1,
                    ),
                  ),
                  child: ListTile(
                    leading: const Icon(Icons.shield_outlined, color: Colors.amber),
                    title: const Text(
                      'Excepciones Temporizadas (HITL)',
                      style: TextStyle(
                          color: Colors.white, fontWeight: FontWeight.w600),
                    ),
                    subtitle: const Text(
                      'Permiten la continuidad de los pipelines durante 24h a 168h.',
                      style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                    ),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: _activeFilter == 'hitl'
                            ? Colors.amber
                            : const Color(0xFF21262D),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            _activeFilter == 'hitl'
                                ? Icons.check
                                : Icons.filter_list,
                            size: 14,
                            color: _activeFilter == 'hitl'
                                ? Colors.black
                                : const Color(0xFFCBD5E1),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _activeFilter == 'hitl' ? 'Activo' : 'Filtrar',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: _activeFilter == 'hitl'
                                  ? Colors.black
                                  : const Color(0xFFCBD5E1),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => _applyFilter('block'),
                child: Container(
                  decoration: BoxDecoration(
                    color: _activeFilter == 'block'
                        ? Colors.redAccent.withValues(alpha: 0.16)
                        : const Color(0xFF161B22),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: _activeFilter == 'block'
                          ? Colors.redAccent
                          : const Color(0xFF30363D),
                      width: _activeFilter == 'block' ? 1.5 : 1,
                    ),
                  ),
                  child: ListTile(
                    leading: const Icon(Icons.block, color: Colors.redAccent),
                    title: const Text(
                      'Bloqueos de Despliegue',
                      style: TextStyle(
                          color: Colors.white, fontWeight: FontWeight.w600),
                    ),
                    subtitle: const Text(
                      'Detienen el pase a producción ante fallos o fugas críticas.',
                      style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                    ),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: _activeFilter == 'block'
                            ? Colors.redAccent
                            : const Color(0xFF21262D),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            _activeFilter == 'block'
                                ? Icons.check
                                : Icons.filter_list,
                            size: 14,
                            color: _activeFilter == 'block'
                                ? Colors.white
                                : const Color(0xFFCBD5E1),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _activeFilter == 'block' ? 'Activo' : 'Filtrar',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: _activeFilter == 'block'
                                  ? Colors.white
                                  : const Color(0xFFCBD5E1),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _activeFilter == 'hitl'
                        ? 'Mostrando: Excepciones HITL (${_filteredBypasses.length})'
                        : _activeFilter == 'block'
                            ? 'Mostrando: Bloqueos (${_filteredBypasses.length})'
                            : 'Solicitudes Registradas (${_filteredBypasses.length})',
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w600),
                  ),
                  if (_activeFilter != null)
                    TextButton.icon(
                      onPressed: () => _applyFilter(null, toggle: false),
                      icon: const Icon(Icons.close, size: 15),
                      label: const Text('Ver todas'),
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
                                    style: const TextStyle(
                                        color: Color(0xFF94A3B8)),
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
                              if (status == 'approved' ||
                                  status == 'exempted') {
                                statusColor = Colors.greenAccent;
                              }
                              if (status == 'rejected' || status == 'blocked') {
                                statusColor = Colors.redAccent;
                              }

                              final displayTitle = _pickField(
                                item,
                                [
                                  'rule',
                                  'rule_id',
                                  'rule_name',
                                  'title',
                                  'finding_title',
                                  'cwe',
                                  'name',
                                  'reason',
                                  'justification',
                                ],
                                'Solicitud de Excepción',
                              );

                              final displayRepo = _pickField(
                                item,
                                [
                                  'repository_name',
                                  'repository',
                                  'repo_name',
                                  'repo',
                                  'project_name',
                                  'project',
                                ],
                                'Sin repositorio',
                              );

                              final displayReq = _pickField(
                                item,
                                [
                                  'requested_by_name',
                                  'requested_by',
                                  'requestedBy',
                                  'requester_email',
                                  'requester',
                                  'user_email',
                                  'user_name',
                                  'author',
                                  'created_by',
                                ],
                                'Usuario Hub',
                              );

                              return Container(
                                margin: const EdgeInsets.symmetric(vertical: 5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF161B22),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                      color: const Color(0xFF30363D)),
                                ),
                                child: ListTile(
                                  contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 6),
                                  onTap: () => _openDetail(item),
                                  leading: CircleAvatar(
                                    radius: 18,
                                    backgroundColor:
                                        statusColor.withValues(alpha: 0.18),
                                    child: Icon(
                                      status == 'approved' ||
                                              status == 'exempted'
                                          ? Icons.check_circle_outline
                                          : status == 'rejected' ||
                                                  status == 'blocked'
                                              ? Icons.highlight_off
                                              : Icons.pending_actions,
                                      color: statusColor,
                                      size: 20,
                                    ),
                                  ),
                                  title: Text(
                                    displayTitle,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14.5,
                                    ),
                                  ),
                                  subtitle: Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(
                                      'Repo: $displayRepo  •  Req: $displayReq',
                                      style: const TextStyle(
                                        color: Color(0xFFCBD5E1),
                                        fontSize: 12.5,
                                      ),
                                    ),
                                  ),
                                  trailing: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color:
                                          statusColor.withValues(alpha: 0.18),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(color: statusColor),
                                    ),
                                    child: Text(
                                      status.toUpperCase(),
                                      style: TextStyle(
                                        color: statusColor,
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.bold,
                                      ),
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