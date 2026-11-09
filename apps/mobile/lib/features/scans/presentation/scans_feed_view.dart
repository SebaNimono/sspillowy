import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../data/scans_service.dart';
import '../domain/scan_model.dart';

class ScansFeedView extends StatefulWidget {
  const ScansFeedView({super.key});

  @override
  State<ScansFeedView> createState() => _ScansFeedViewState();
}

class _ScansFeedViewState extends State<ScansFeedView> {
  late final ScansService _scansService;
  
  bool _isLoading = true;
  String? _errorMessage;
  List<ScanModel> _scans = [];

  @override
  void initState() {
    super.initState();
    _scansService = ScansService(DioClient().dio);
    _loadScans();
  }

  Future<void> _loadScans() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final rawData = await _scansService.fetchScans();
      setState(() {
        _scans = rawData.map((json) => ScanModel.fromJson(json)).toList();
        _isLoading = false;
      });
    } on DioException catch (e) {
      setState(() {
        _errorMessage = e.type == DioExceptionType.connectionTimeout || 
                        e.type == DioExceptionType.receiveTimeout
            ? 'Tiempo de espera agotado. Verifica tu conexión.'
            : 'Error de red al conectar con /api/v1/scans.';
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Ocurrió un error inesperado al procesar los datos.';
        _isLoading = false;
      });
    }
  }

  Color _getSeverityColor(String severity) {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return const Color(0xFFCF222E);
      case 'HIGH':
        return Colors.orange;
      case 'MEDIUM':
        return const Color(0xFFD29922);
      default:
        return const Color(0xFF0969DA);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      appBar: AppBar(
        title: const Text(
          'Escaneos SSPillowy',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        backgroundColor: const Color(0xFF1F2328),
        elevation: 0,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF0969DA)),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.wifi_off_rounded, color: Color(0xFFCF222E), size: 64),
              const SizedBox(height: 16),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: 16),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF238636),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onPressed: _loadScans,
                icon: const Icon(Icons.refresh, color: Colors.white),
                label: const Text('Reintentar', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      );
    }

    if (_scans.isEmpty) {
      return RefreshIndicator(
        color: const Color(0xFF0969DA),
        onRefresh: _loadScans,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(height: 180),
            Center(
              child: Column(
                children: [
                  Icon(Icons.verified_user_outlined, color: Colors.white38, size: 64),
                  SizedBox(height: 16),
                  Text(
                    'No hay escaneos registrados',
                    style: TextStyle(color: Colors.white54, fontSize: 16),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: const Color(0xFF0969DA),
      onRefresh: _loadScans,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16.0),
        itemCount: _scans.length,
        itemBuilder: (context, index) {
          final scan = _scans[index];
          final color = _getSeverityColor(scan.severity);

          return Card(
            color: const Color(0xFF1F2328),
            margin: const EdgeInsets.only(bottom: 12.0),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
              side: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
            ),
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              leading: Container(
                width: 10,
                height: 40,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              title: Text(
                scan.title,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
              subtitle: Text(
                'Estado: \ • \',
                style: const TextStyle(color: Colors.white54, fontSize: 13),
              ),
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  scan.severity,
                  style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 11),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
