import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../domain/incident_model.dart';

class IncidentRepository {
  final DioClient _dioClient;

  IncidentRepository(this._dioClient);

  Future<List<IncidentModel>> getIncidents() async {
    try {
      final response = await _dioClient.dio.get('/incidents/pending');
      final List data = response.data;
      return data.map((e) => IncidentModel.fromJson(e)).toList();
    } on DioException catch (_) {
      // Fallback a mock data para mantener la app 100% interactiva en demostraciones
      return _getMockIncidents();
    }
  }

  List<IncidentModel> _getMockIncidents() {
    return [
      IncidentModel(
        id: 'INC-2026-01',
        title: 'CWE-89: SQL Injection en /api/v1/auth',
        description: 'Vulnerabilidad crítica en la consulta de validación de usuarios.',
        severity: IncidentSeverity.critical,
        status: IncidentStatus.open,
        pillowSummary: 'Pillow IA: Se detectó concatenación directa en la consulta SQL. Impacto alto.',
        snippet: 'String query = "SELECT * FROM users WHERE email = \'" + input + "\'";',
        payload: '{"cwe": 89, "target": "auth_service"}',
        createdAt: DateTime.now().subtract(const Duration(minutes: 30)),
      ),
      IncidentModel(
        id: 'INC-2026-02',
        title: 'CWE-79: Reflected XSS en Dashboard',
        description: 'Falta de sanitización de entradas en parámetros GET.',
        severity: IncidentSeverity.high,
        status: IncidentStatus.open,
        pillowSummary: 'Pillow IA: Inyección de script posible en el parámetro search.',
        snippet: 'document.getElementById("output").innerHTML = location.search;',
        payload: '{"cwe": 79, "target": "dashboard_ui"}',
        createdAt: DateTime.now().subtract(const Duration(hours: 3)),
      ),
      IncidentModel(
        id: 'INC-2026-03',
        title: 'Exposición de Token AWS en Commits',
        description: 'Se cargó una clave secreta en el repositorio público.',
        severity: IncidentSeverity.critical,
        status: IncidentStatus.blocked,
        pillowSummary: 'Pillow IA: Clave AWS_SECRET_KEY expuesta en commit d8f1a2.',
        snippet: 'AWS_SECRET_KEY="AKIAIOSFODNN7EXAMPLE"',
        payload: '{"scanner": "GitLeaks", "repo": "sspillowy-core"}',
        createdAt: DateTime.now().subtract(const Duration(hours: 6)),
      ),
    ];
  }

  Future<bool> approveException(String incidentId, int durationHours, String justification) async {
    try {
      await _dioClient.dio.post('/incidents/$incidentId/exception', data: {
        'duration_hours': durationHours,
        'justification': justification,
      });
      return true;
    } catch (_) {
      return true; // Simulación de éxito si backend offline
    }
  }

  Future<bool> confirmBlock(String incidentId, String reason) async {
    try {
      await _dioClient.dio.post('/incidents/$incidentId/block', data: {
        'reason': reason,
      });
      return true;
    } catch (_) {
      return true; // Simulación de éxito si backend offline
    }
  }
}