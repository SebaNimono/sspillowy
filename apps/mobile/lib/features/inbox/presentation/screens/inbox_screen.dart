import 'package:flutter/material.dart';
import '../../../../features/findings/data/services/finding_service.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  final FindingService _findingService = FindingService();
  List _allFindings = [];
  List _filteredFindings = [];
  bool _isLoading = true;
  String _selectedFilter = 'Todos';

  final List<String> _filters = ['Todos', 'Crítico', 'Alto', 'Abierto', 'Bloqueado'];

  @override
  void initState() {
    super.initState();
    _loadFindings();
  }

  Future<void> _loadFindings() async {
    setState(() => _isLoading = true);
    final data = await _findingService.fetchFindings();
    if (mounted) {
      setState(() {
        _allFindings = data;
        _applyFilter();
        _isLoading = false;
      });
    }
  }

  void _applyFilter() {
    if (_selectedFilter == 'Todos') {
      _filteredFindings = List.from(_allFindings);
      return;
    }

    _filteredFindings = _allFindings.where((item) {
      final rawSeverity = (item['severity'] ?? '').toString().toUpperCase();
      final rawStatus = (item['status'] ?? '').toString().toUpperCase();

      switch (_selectedFilter) {
        case 'Crítico':
          return rawSeverity == 'CRITICAL';
        case 'Alto':
          return rawSeverity == 'HIGH';
        case 'Abierto':
          return rawStatus == 'OPEN' || rawStatus == 'ABIERTO';
        case 'Bloqueado':
          return rawStatus == 'BLOCKED' || rawStatus == 'BLOQUEADO';
        default:
          return true;
      }
    }).toList();
  }

  void _onFilterSelected(String filter) {
    setState(() {
      _selectedFilter = filter;
      _applyFilter();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bandeja de Hallazgos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Actualizar',
            onPressed: _loadFindings,
          ),
          IconButton(
            icon: const Icon(Icons.smart_toy_outlined, color: Color(0xFF38BDF8)),
            tooltip: 'Hablar con Pillow',
            onPressed: () {},
          ),
        ],
      ),
      body: Column(
        children: [
          // Barra de Filtros (Chips)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
            color: const Color(0xFF0F172A),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _filters.map((filter) {
                  final isSelected = _selectedFilter == filter;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8.0),
                    child: ChoiceChip(
                      label: Text(
                        filter,
                        style: TextStyle(
                          color: isSelected ? Colors.white : const Color(0xFF94A3B8),
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                      selected: isSelected,
                      selectedColor: const Color(0xFF0284C7),
                      backgroundColor: const Color(0xFF1E293B),
                      onSelected: (_) => _onFilterSelected(filter),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          // Lista de Hallazgos
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredFindings.isEmpty
                    ? RefreshIndicator(
                        onRefresh: _loadFindings,
                        child: ListView(
                          children: const [
                            SizedBox(height: 140),
                            Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.inbox_outlined, size: 64, color: Color(0xFF64748B)),
                                  SizedBox(height: 16),
                                  Text(
                                    'Sin hallazgos pendientes',
                                    style: TextStyle(
                                      fontSize: 16,
                                      color: Color(0xFF94A3B8),
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadFindings,
                        child: ListView.builder(
                          itemCount: _filteredFindings.length,
                          itemBuilder: (context, index) {
                            final item = _filteredFindings[index];
                            final title = item['title'] ?? item['rule_name'] ?? item['cve_id'] ?? 'Hallazgo #${index + 1}';
                            final subtitle = item['description'] ?? item['repository'] ?? 'Sin detalle';
                            final severity = item['severity'] ?? 'INFO';

                            return Card(
                              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: _getSeverityColor(severity).withValues(alpha: 0.2),
                                  child: Icon(Icons.warning_amber_rounded, color: _getSeverityColor(severity)),
                                ),
                                title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
                                subtitle: Text(subtitle, maxLines: 2, overflow: TextOverflow.ellipsis),
                                trailing: const Icon(Icons.chevron_right),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Color _getSeverityColor(String severity) {
    switch (severity.toString().toUpperCase()) {
      case 'CRITICAL':
        return Colors.redAccent;
      case 'HIGH':
        return Colors.orangeAccent;
      case 'MEDIUM':
        return Colors.amber;
      case 'LOW':
        return Colors.blueAccent;
      default:
        return Colors.grey;
    }
  }
}