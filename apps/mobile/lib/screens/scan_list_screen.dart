import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/scan_model.dart';
import '../services/api_client.dart';

typedef StringMap = Map<String, String>;

class ScanListScreen extends StatefulWidget {
  final VoidCallback onLogout;
  final bool isOnDuty;
  final ValueChanged<List<ScanModel>> onScansUpdated;
  final ValueChanged<StringMap> onAuditAdded;

  const ScanListScreen({
    super.key,
    required this.onLogout,
    required this.isOnDuty,
    required this.onScansUpdated,
    required this.onAuditAdded,
  });

  @override
  State<ScanListScreen> createState() => _ScanListScreenState();
}

class _ScanListScreenState extends State<ScanListScreen> {
  List<ScanModel> _localScans = [];
  bool _sortAscending = true;
  bool _isLoading = false;

  String _selectedFilter = 'Todos';
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  final ApiClient _apiClient = ApiClient();

  @override
  void initState() {
    super.initState();
    _initScans();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _saveScansToPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = _localScans.map((s) => s.toJson()).toList();
    await prefs.setString('persistent_scans_list_v4', jsonEncode(jsonList));
  }

  Future<void> _initScans() async {
    setState(() => _isLoading = true);

    try {
      final prefs = await SharedPreferences.getInstance();
      final token =
          prefs.getString('jwt_token') ?? prefs.getString('session_id');

      if (token == null || token.isEmpty || token.startsWith('token_')) {
        if (mounted) {
          setState(() => _isLoading = false);
          widget.onLogout();
        }
        return;
      }

      _apiClient.setAuthToken(token);

      dynamic responseData;
      int statusCode = 0;

      try {
        var res = await _apiClient.get('/findings');
        statusCode = res.statusCode ?? 0;
        responseData = res.data;
      } on DioException catch (e) {
        if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
          await prefs.remove('jwt_token');
          await prefs.remove('session_id');
          await prefs.setBool('is_logged_in', false);
          if (mounted) {
            setState(() => _isLoading = false);
            widget.onLogout();
          }
          return;
        }
        try {
          var res = await _apiClient.get('/scans');
          statusCode = res.statusCode ?? 0;
          responseData = res.data;
        } catch (_) {}
      }

      if (statusCode == 200 && responseData != null) {
        List rawData = [];

        if (responseData is List) {
          rawData = responseData;
        } else if (responseData is Map) {
          rawData = responseData['findings'] ??
              responseData['incidents'] ??
              responseData['scans'] ??
              responseData['repositories'] ??
              responseData['data'] ??
              responseData['repos'] ??
              [];
        }

        // Si /findings devolvió vacío, intentar cargar los repositorios del espacio
        if (rawData.isEmpty) {
          try {
            var repoRes = await _apiClient.get('/repositories');
            if (repoRes.statusCode == 200 && repoRes.data is List) {
              rawData = repoRes.data as List;
            }
          } catch (_) {}
        }

        if (rawData.isNotEmpty) {
          _localScans = rawData
              .map(
                  (item) => ScanModel.fromJson(Map<String, dynamic>.from(item)))
              .toList();

          await _saveScansToPrefs();
          _applySorting();
          widget.onScansUpdated(_localScans);
          if (mounted) setState(() => _isLoading = false);
          return;
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('--- ERROR AL CONSULTAR BACKEND FINDINGS ---');
        debugPrint(e.toString());
        debugPrint('-------------------------------------------');
      }
    }

    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString('persistent_scans_list_v4');

    if (jsonStr != null) {
      try {
        final List decoded = jsonDecode(jsonStr);
        _localScans = decoded
            .map((item) => ScanModel.fromJson(Map<String, dynamic>.from(item)))
            .toList();
      } catch (_) {
        _localScans = [];
      }
    } else {
      _localScans = [];
    }

    _applySorting();
    widget.onScansUpdated(_localScans);
    if (mounted) setState(() => _isLoading = false);
  }

  void _applySorting() {
    _localScans.sort((a, b) {
      final nameA = (a.title ?? '').toLowerCase();
      final nameB = (b.title ?? '').toLowerCase();
      return _sortAscending ? nameA.compareTo(nameB) : nameB.compareTo(nameA);
    });
  }

  void _deleteSingleScan(ScanModel scan) {
    setState(() {
      _localScans.removeWhere((s) => s.id == scan.id);
    });
    _saveScansToPrefs();
    widget.onScansUpdated(_localScans);

    widget.onAuditAdded({
      'id': scan.id,
      'type': 'DELETE',
      'title': 'Repositorio Eliminado',
      'subtitle': 'Se eliminó "${scan.title ?? scan.id}" de la bandeja.',
      'time': 'Ahora mismo',
    });
  }

  void _clearAllScans() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: const Text('Limpiar Bandeja',
            style: TextStyle(color: Colors.white)),
        content: const Text(
            '¿Deseas vaciar todos los elementos de la bandeja de hallazgos?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () {
              Navigator.pop(context);
              setState(() {
                _localScans.clear();
              });
              _saveScansToPrefs();
              widget.onScansUpdated(_localScans);

              widget.onAuditAdded({
                'id': 'ALL',
                'type': 'DELETE',
                'title': 'Bandeja Vaciada',
                'subtitle': 'Se eliminaron todos los repositorios de la lista.',
                'time': 'Ahora mismo',
              });
            },
            child: const Text('Vaciar Todo',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showDetailModal(BuildContext context, ScanModel scan) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF161B22),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (bottomSheetContext) {
        final justificationController = TextEditingController();
        final reasonController = TextEditingController();
        int selectedHours = 24;

        final bool isAlreadyProcessed =
            scan.status == 'EXEMPTED' || scan.status == 'BLOCKED';

        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom + 16,
                top: 24,
                left: 20,
                right: 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(scan.title ?? 'Sintetización del Hallazgo',
                            style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.white)),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.grey),
                        onPressed: () => Navigator.pop(bottomSheetContext),
                      ),
                    ],
                  ),
                  const Divider(color: Color(0xFF30363D)),
                  const SizedBox(height: 8),
                  const Text('Resumen Pillow:',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF38BDF8))),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0D1117),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFF30363D)),
                    ),
                    child: Text(
                      scan.summary ??
                          'Análisis detectó vulnerabilidades que requieren revisión HITL.',
                      style:
                          const TextStyle(fontSize: 13, color: Colors.white70),
                    ),
                  ),
                  const SizedBox(height: 20),
                  if (!widget.isOnDuty)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade900.withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.amber.shade700),
                      ),
                      child: const Text(
                        'Modo Lectura (Fuera de Guardia): No tienes permiso para aprobar ni bloquear excepciones.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.amber, fontSize: 12),
                      ),
                    ),
                  if (isAlreadyProcessed)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF21262D),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Estado actual: ${scan.status == "EXEMPTED" ? "Excepción Lanzada" : "Despliegue Bloqueado"}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            color: Colors.amber, fontWeight: FontWeight.bold),
                      ),
                    )
                  else
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: widget.isOnDuty
                                  ? Colors.amber.shade800
                                  : Colors.grey.shade800,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            icon: const Icon(Icons.shield_outlined,
                                color: Colors.white),
                            label: const Text('Excepción',
                                style: TextStyle(color: Colors.white)),
                            onPressed: !widget.isOnDuty
                                ? null
                                : () {
                                    String? inlineError;
                                    showDialog(
                                      context: context,
                                      builder: (dialogContext) =>
                                          StatefulBuilder(
                                        builder: (context, setDialogState) {
                                          return AlertDialog(
                                            backgroundColor:
                                                const Color(0xFF161B22),
                                            title: const Text(
                                                'Aprobar Excepción Temporizada',
                                                style: TextStyle(
                                                    color: Colors.white)),
                                            content: Column(
                                              mainAxisSize: MainAxisSize.min,
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                const Text(
                                                  '¿Autorizar el pase a producción con esta vulnerabilidad activa?',
                                                  style: TextStyle(
                                                      fontSize: 13,
                                                      color: Colors.grey),
                                                ),
                                                const SizedBox(height: 12),
                                                DropdownButtonFormField<int>(
                                                  initialValue: selectedHours,
                                                  dropdownColor:
                                                      const Color(0xFF161B22),
                                                  decoration:
                                                      const InputDecoration(
                                                    labelText:
                                                        'Duración de la excepción',
                                                    border:
                                                        OutlineInputBorder(),
                                                  ),
                                                  items: const [
                                                    DropdownMenuItem(
                                                        value: 24,
                                                        child:
                                                            Text('24 Horas')),
                                                    DropdownMenuItem(
                                                        value: 72,
                                                        child:
                                                            Text('72 Horas')),
                                                    DropdownMenuItem(
                                                        value: 168,
                                                        child: Text(
                                                            '168 Horas (1 Semana)')),
                                                  ],
                                                  onChanged: (val) =>
                                                      selectedHours = val ?? 24,
                                                ),
                                                const SizedBox(height: 12),
                                                TextField(
                                                  controller:
                                                      justificationController,
                                                  maxLines: 2,
                                                  decoration: InputDecoration(
                                                    border:
                                                        const OutlineInputBorder(),
                                                    hintText:
                                                        'Justificación (mínimo 10 caracteres)',
                                                    errorText: inlineError,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            actions: [
                                              TextButton(
                                                  onPressed: () =>
                                                      Navigator.pop(
                                                          dialogContext),
                                                  child:
                                                      const Text('Cancelar')),
                                              ElevatedButton(
                                                onPressed: () async {
                                                  final justificationText =
                                                      justificationController
                                                          .text
                                                          .trim();
                                                  if (justificationText
                                                          .length >=
                                                      10) {
                                                    Navigator.pop(
                                                        dialogContext);
                                                    Navigator.pop(
                                                        bottomSheetContext);

                                                    try {
                                                      final prefs =
                                                          await SharedPreferences
                                                              .getInstance();
                                                      final token =
                                                          prefs.getString(
                                                              'jwt_token');

                                                      if (token != null &&
                                                          token.isNotEmpty) {
                                                        _apiClient.setAuthToken(
                                                            token);
                                                      }

                                                      await _apiClient.post(
                                                          '/findings/${scan.id}',
                                                          data: {
                                                            'status':
                                                                'EXEMPTED',
                                                            'duration_hours':
                                                                selectedHours,
                                                            'justification':
                                                                justificationText,
                                                          });
                                                    } catch (_) {}

                                                    setState(() {
                                                      final idx = _localScans
                                                          .indexWhere((s) =>
                                                              s.id == scan.id);
                                                      if (idx != -1) {
                                                        _localScans[idx] =
                                                            ScanModel(
                                                          id: scan.id,
                                                          title: scan.title,
                                                          status: 'EXEMPTED',
                                                          severity:
                                                              scan.severity,
                                                          summary: scan.summary,
                                                          createdAt:
                                                              scan.createdAt,
                                                        );
                                                        _saveScansToPrefs();
                                                      }
                                                    });

                                                    widget.onAuditAdded({
                                                      'id': scan.id,
                                                      'type': 'EXEMPTION',
                                                      'title':
                                                          'Excepción Lanzada',
                                                      'subtitle':
                                                          '${scan.title ?? 'Repo'} - "$justificationText"',
                                                      'time':
                                                          'Quedan $selectedHours h',
                                                      'duration':
                                                          '$selectedHours Horas',
                                                    });
                                                  } else {
                                                    setDialogState(() {
                                                      inlineError =
                                                          'La justificación debe tener al menos 10 caracteres.';
                                                    });
                                                  }
                                                },
                                                child: const Text('Confirmar'),
                                              ),
                                            ],
                                          );
                                        },
                                      ),
                                    );
                                  },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: widget.isOnDuty
                                  ? Colors.red.shade700
                                  : Colors.grey.shade800,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            icon: const Icon(Icons.block, color: Colors.white),
                            label: const Text('Bloquear',
                                style: TextStyle(color: Colors.white)),
                            onPressed: !widget.isOnDuty
                                ? null
                                : () {
                                    String? inlineError;
                                    showDialog(
                                      context: context,
                                      builder: (dialogContext) =>
                                          StatefulBuilder(
                                        builder: (context, setDialogState) {
                                          return AlertDialog(
                                            backgroundColor:
                                                const Color(0xFF161B22),
                                            title: const Text(
                                                'Confirmar Bloqueo de Despliegue',
                                                style: TextStyle(
                                                    color: Colors.white)),
                                            content: TextField(
                                              controller: reasonController,
                                              decoration: InputDecoration(
                                                border:
                                                    const OutlineInputBorder(),
                                                hintText:
                                                    'Motivo del bloqueo (mínimo 3 caracteres)',
                                                errorText: inlineError,
                                              ),
                                            ),
                                            actions: [
                                              TextButton(
                                                  onPressed: () =>
                                                      Navigator.pop(
                                                          dialogContext),
                                                  child:
                                                      const Text('Cancelar')),
                                              ElevatedButton(
                                                style: ElevatedButton.styleFrom(
                                                    backgroundColor:
                                                        Colors.red),
                                                onPressed: () async {
                                                  final reasonText =
                                                      reasonController.text
                                                          .trim();
                                                  if (reasonText.length >= 3) {
                                                    Navigator.pop(
                                                        dialogContext);
                                                    Navigator.pop(
                                                        bottomSheetContext);

                                                    try {
                                                      final prefs =
                                                          await SharedPreferences
                                                              .getInstance();
                                                      final token =
                                                          prefs.getString(
                                                              'jwt_token');

                                                      if (token != null &&
                                                          token.isNotEmpty) {
                                                        _apiClient.setAuthToken(
                                                            token);
                                                      }

                                                      await _apiClient.post(
                                                          '/findings/${scan.id}',
                                                          data: {
                                                            'status': 'BLOCKED',
                                                            'reason':
                                                                reasonText,
                                                          });
                                                    } catch (_) {}

                                                    setState(() {
                                                      final idx = _localScans
                                                          .indexWhere((s) =>
                                                              s.id == scan.id);
                                                      if (idx != -1) {
                                                        _localScans[idx] =
                                                            ScanModel(
                                                          id: scan.id,
                                                          title: scan.title,
                                                          status: 'BLOCKED',
                                                          severity:
                                                              scan.severity,
                                                          summary: scan.summary,
                                                          createdAt:
                                                              scan.createdAt,
                                                        );
                                                        _saveScansToPrefs();
                                                      }
                                                    });

                                                    widget.onAuditAdded({
                                                      'id': scan.id,
                                                      'type': 'BLOCK',
                                                      'title':
                                                          'Bloqueo de Despliegue',
                                                      'subtitle':
                                                          '${scan.title ?? 'Repo'} - "$reasonText"',
                                                      'time': 'Bloqueado',
                                                      'duration': 'Permanente',
                                                    });
                                                  } else {
                                                    setDialogState(() {
                                                      inlineError =
                                                          'El motivo debe tener al menos 3 caracteres.';
                                                    });
                                                  }
                                                },
                                                child: const Text('Bloquear',
                                                    style: TextStyle(
                                                        color: Colors.white)),
                                              ),
                                            ],
                                          );
                                        },
                                      ),
                                    );
                                  },
                          ),
                        ),
                      ],
                    ),
                  const SizedBox(height: 12),
                ],
              ),
            );
          },
        );
      },
    );
  }

  String _formatDate(DateTime dt) {
    final day = dt.day.toString().padLeft(2, '0');
    final month = dt.month.toString().padLeft(2, '0');
    final year = dt.year;
    return '$day/$month/$year';
  }

  @override
  Widget build(BuildContext context) {
    var scans = List<ScanModel>.from(_localScans);

    if (_searchQuery.isNotEmpty) {
      scans = scans
          .where((s) =>
              (s.title ?? '').toLowerCase().contains(_searchQuery) ||
              (s.summary ?? '').toLowerCase().contains(_searchQuery) ||
              s.id.contains(_searchQuery))
          .toList();
    }

    if (_selectedFilter != 'Todos') {
      scans = scans.where((s) {
        final status = s.status.toUpperCase();
        final severity = (s.severity ?? '').toUpperCase();

        if (_selectedFilter == 'Crítico') {
          return severity == 'CRITICAL';
        }
        if (_selectedFilter == 'Alto') {
          return severity == 'HIGH';
        }
        if (_selectedFilter == 'Bloqueado') {
          return status == 'BLOCKED' || status == 'BLOQUEADO';
        }
        if (_selectedFilter == 'Abierto') {
          return status == 'OPEN' || status == 'ABIERTO';
        }

        return true;
      }).toList();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bandeja de Hallazgos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Recargar Bandeja',
            onPressed: () => _initScans(),
          ),
          IconButton(
            icon: Icon(_sortAscending ? Icons.sort_by_alpha : Icons.sort),
            tooltip: 'Ordenar A-Z / Z-A',
            onPressed: () {
              setState(() {
                _sortAscending = !_sortAscending;
                _applySorting();
              });
            },
          ),
          if (_localScans.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep_outlined,
                  color: Colors.redAccent),
              tooltip: 'Vaciar Bandeja',
              onPressed: _clearAllScans,
            ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12.0),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Buscar por repo, CWE, id...',
                prefixIcon: const Icon(Icons.search, size: 20),
                contentPadding:
                    const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                filled: true,
                fillColor: const Color(0xFF161B22),
              ),
              onChanged: (val) =>
                  setState(() => _searchQuery = val.toLowerCase()),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: ['Todos', 'Crítico', 'Alto', 'Abierto', 'Bloqueado']
                  .map((filter) {
                final isSelected = _selectedFilter == filter;
                return Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: FilterChip(
                    label: Text(filter,
                        style: TextStyle(
                            color: isSelected ? Colors.white : Colors.grey)),
                    selected: isSelected,
                    selectedColor: const Color(0xFF0284C7),
                    backgroundColor: const Color(0xFF161B22),
                    onSelected: (selected) =>
                        setState(() => _selectedFilter = filter),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
                : scans.isEmpty
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.inbox_outlined,
                                  size: 80, color: Colors.grey),
                              SizedBox(height: 16),
                              Text(
                                'Sin hallazgos pendientes',
                                style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white),
                              ),
                              SizedBox(height: 8),
                              Text(
                                'Tus repositorios vinculados se sincronización aquí automáticamente.',
                                textAlign: TextAlign.center,
                                style:
                                    TextStyle(color: Colors.grey, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView.builder(
                        itemCount: scans.length,
                        padding: const EdgeInsets.all(12),
                        itemBuilder: (context, index) {
                          final scan = scans[index];
                          return Card(
                            elevation: 2,
                            color: const Color(0xFF161B22),
                            margin: const EdgeInsets.only(bottom: 12),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: scan.status == 'EXEMPTED'
                                    ? Colors.amber.shade800
                                    : scan.status == 'BLOCKED'
                                        ? Colors.red.shade800
                                        : Colors.green.shade700,
                                child: Icon(
                                  scan.status == 'EXEMPTED'
                                      ? Icons.shield_outlined
                                      : scan.status == 'BLOCKED'
                                          ? Icons.block
                                          : Icons.security,
                                  color: Colors.white,
                                ),
                              ),
                              title: Text(
                                  scan.title ?? 'Repositorio #${scan.id}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white)),
                              subtitle: Text(
                                'Estado: ${scan.status} - Fecha: ${_formatDate(scan.createdAt)}',
                                style: const TextStyle(
                                    color: Colors.grey, fontSize: 12),
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline,
                                        color: Colors.grey, size: 20),
                                    onPressed: () => _deleteSingleScan(scan),
                                  ),
                                  const Icon(Icons.chevron_right,
                                      color: Colors.grey),
                                ],
                              ),
                              onTap: () => _showDetailModal(context, scan),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
