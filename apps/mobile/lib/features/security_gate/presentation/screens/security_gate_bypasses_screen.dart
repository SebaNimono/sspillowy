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

  bool _isHitlItem(Map<String, dynamic> map) {
    final status = (map['status'] ?? '').toString().toLowerCase();
    final type = (map['type'] ?? '').toString().toLowerCase();
    return status == 'pending' || status == 'approved' || type == 'hitl';
  }

  bool _isBlockItem(Map<String, dynamic> map) {
    final status = (map['status'] ?? '').toString().toLowerCase();
    final type = (map['type'] ?? '').toString().toLowerCase();
    return status == 'rejected' || status == 'blocked' || type == 'block';
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
          return _isHitlItem(map);
        }).toList();
      } else if (_activeFilter == 'block') {
        _filteredBypasses = _allBypasses.where((item) {
          final map = Map<String, dynamic>.from(item is Map ? item : {});
          return _isBlockItem(map);
        }).toList();
      } else {
        _filteredBypasses = List.from(_allBypasses);
      }
    });
  }

  String _pickField(
      Map<String, dynamic> map, List<String> keys, String fallback) {
    for (final key in keys) {
      final val = map[key];
      if (val != null) {
        if (val is Map) {
          final nested =
              val['name'] ?? val['title'] ?? val['email'] ?? val['full_name'];
          if (nested != null &&
              nested.toString().trim().isNotEmpty &&
              nested.toString() != 'null') {
            return nested.toString().trim();
          }
        } else {
          final str = val.toString().trim();
          if (str.isNotEmpty && str != 'null') {
            return str;
          }
        }
      }
    }
    return fallback;
  }

  String _resolveTitle(Map<String, dynamic> item) {
    final title = _pickField(
      item,
      [
        'rule_name',
        'rule',
        'finding_title',
        'title',
        'name',
        'vulnerability',
        'reason'
      ],
      '',
    );
    if (title.isNotEmpty) return title;
    final id = item['id']?.toString();
    return (id != null && id.isNotEmpty)
        ? 'Solicitud #${id.length > 8 ? id.substring(0, 8) : id}'
        : 'Solicitud de Excepción';
  }

  String _resolveRepo(Map<String, dynamic> item) {
    return _pickField(
      item,
      [
        'repository_name',
        'repo_name',
        'repository',
        'repo',
        'project',
        'target'
      ],
      'Sin repo',
    );
  }

  String _resolveRequester(Map<String, dynamic> item) {
    return _pickField(
      item,
      [
        'requested_by_name',
        'requested_by',
        'requestedBy',
        'requester',
        'user_email',
        'email',
        'author',
        'creator',
      ],
      'Guardia CI/CD',
    );
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
    final hitlCount = _allBypasses
        .where((e) => _isHitlItem(Map<String, dynamic>.from(e is Map ? e : {})))
        .length;
    final blockCount = _allBypasses
        .where(
            (e) => _isBlockItem(Map<String, dynamic>.from(e is Map ? e : {})))
        .length;

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
                'Toca una categoría para filtrar las solicitudes del pipeline:',
                style: TextStyle(color: Color(0xFFB1BAC4), fontSize: 13),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(10),
                      onTap: () => _applyFilter('hitl'),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: _activeFilter == 'hitl'
                              ? Colors.amber.withValues(alpha: 0.22)
                              : const Color(0xFF1C2331),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _activeFilter == 'hitl'
                                ? Colors.amber
                                : const Color(0xFF30363D),
                            width: _activeFilter == 'hitl' ? 1.5 : 1,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Icon(Icons.shield_outlined,
                                    color: Colors.amber, size: 20),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.amber.withValues(alpha: 0.18),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        _activeFilter == 'hitl'
                                            ? Icons.filter_alt
                                            : Icons.filter_list,
                                        size: 12,
                                        color: Colors.amber,
                                      ),
                                      const SizedBox(width: 3),
                                      Text(
                                        '$hitlCount',
                                        style: const TextStyle(
                                          color: Colors.amber,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Excepciones HITL',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 2),
                            const Text(
                              'Filtro: 24h a 168h',
                              style: TextStyle(
                                  color: Color(0xFFC9D1D9), fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(10),
                      onTap: () => _applyFilter('block'),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: _activeFilter == 'block'
                              ? Colors.redAccent.withValues(alpha: 0.22)
                              : const Color(0xFF1C2331),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _activeFilter == 'block'
                                ? Colors.redAccent
                                : const Color(0xFF30363D),
                            width: _activeFilter == 'block' ? 1.5 : 1,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Icon(Icons.block,
                                    color: Colors.redAccent, size: 20),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.redAccent
                                        .withValues(alpha: 0.18),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        _activeFilter == 'block'
                                            ? Icons.filter_alt
                                            : Icons.filter_list,
                                        size: 12,
                                        color: Colors.redAccent,
                                      ),
                                      const SizedBox(width: 3),
                                      Text(
                                        '$blockCount',
                                        style: const TextStyle(
                                          color: Colors.redAccent,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Bloqueos',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 2),
                            const Text(
                              'Filtro: Críticos',
                              style: TextStyle(
                                  color: Color(0xFFC9D1D9), fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
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
                      onPressed: () => _applyFilter(null),
                      icon: const Icon(Icons.close, size: 16),
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
                                        color: Color(0xFFC9D1D9)),
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
                                statusColor = Colors.greenAccent;
                              }
                              if (status == 'rejected' || status == 'blocked') {
                                statusColor = Colors.redAccent;
                              }

                              final titleText = _resolveTitle(item);
                              final repoText = _resolveRepo(item);
                              final reqText = _resolveRequester(item);

                              return Card(
                                color: const Color(0xFF1C2331),
                                elevation: 2,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  side: const BorderSide(
                                    color: Color(0xFF364152),
                                    width: 1,
                                  ),
                                ),
                                margin: const EdgeInsets.symmetric(vertical: 5),
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
                                    titleText,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                    ),
                                  ),
                                  subtitle: Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(
                                      'Repo: $repoText  •  Req: $reqText',
                                      style: const TextStyle(
                                        color: Color(0xFFD0D7DE),
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w500,
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
