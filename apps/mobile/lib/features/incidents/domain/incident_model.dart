enum IncidentSeverity { critical, high, medium, low }
enum IncidentStatus { open, blocked, resolved }

class IncidentModel {
  final String id;
  final String title;
  final IncidentSeverity severity;
  final IncidentStatus status;
  final String repo;
  final String type;
  final String? pillowSummary;
  final String? snippet;
  final DateTime? createdAt;

  const IncidentModel({
    required this.id,
    required this.title,
    required this.severity,
    required this.status,
    required this.repo,
    required this.type,
    this.pillowSummary,
    this.snippet,
    this.createdAt,
  });

  // Alias para retrocompatibilidad con referencias a 'service'
  String get service => type;

  factory IncidentModel.fromJson(Map<String, dynamic> json) {
    return IncidentModel(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      severity: IncidentSeverity.values.firstWhere(
        (e) => e.name.toUpperCase() == (json['severity'] ?? 'HIGH').toString().toUpperCase(),
        orElse: () => IncidentSeverity.high,
      ),
      status: IncidentStatus.values.firstWhere(
        (e) => e.name.toUpperCase() == (json['status'] ?? 'OPEN').toString().toUpperCase(),
        orElse: () => IncidentStatus.open,
      ),
      repo: json['repo'] ?? 'N/A',
      type: json['type'] ?? json['service'] ?? 'SAST',
      pillowSummary: json['pillow_summary'],
      snippet: json['snippet'],
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at']) : null,
    );
  }

  // Lista estática requerida por incident_repository.dart e incidents_feed_view.dart
  static List<IncidentModel> mockList = [
    IncidentModel(
      id: 'INC-101',
      title: 'CWE-89: SQL Injection en /api/v1/auth',
      severity: IncidentSeverity.critical,
      status: IncidentStatus.open,
      repo: 'backend-core',
      type: 'SAST',
      pillowSummary: 'Se detectó concatenación directa de parámetros en consulta SQL activa en producción.',
      snippet: 'String query = "SELECT * FROM users WHERE email = \'" + input + "\'";',
      createdAt: DateTime.now().subtract(const Duration(hours: 2)),
    ),
    IncidentModel(
      id: 'INC-102',
      title: 'CWE-798: Hardcoded JWT Secret Key',
      severity: IncidentSeverity.high,
      status: IncidentStatus.open,
      repo: 'payment-gateway',
      type: 'Secretos',
      pillowSummary: 'Clave privada JWT expuesta en archivo de configuración de repositorio público.',
      snippet: 'const JWT_SECRET = "super_secret_key_12345";',
      createdAt: DateTime.now().subtract(const Duration(hours: 5)),
    ),
  ];
}