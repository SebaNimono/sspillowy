enum IncidentSeverity { critical, high, medium, low }
enum IncidentStatus { open, blocked, resolved }

class IncidentModel {
  final String id;
  final String title;
  final String description;
  final IncidentSeverity severity;
  final IncidentStatus status;
  final String? pillowSummary;
  final String? snippet;
  final String payload;
  final DateTime createdAt;

  IncidentModel({
    required this.id,
    required this.title,
    required this.description,
    required this.severity,
    required this.status,
    this.pillowSummary,
    this.snippet,
    required this.payload,
    required this.createdAt,
  });

  factory IncidentModel.fromJson(Map<String, dynamic> json) {
    return IncidentModel(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      severity: _parseSeverity(json['severity']),
      status: _parseStatus(json['status']),
      pillowSummary: json['pillow_summary'],
      snippet: json['snippet'],
      payload: json['payload'] is String ? json['payload'] : json['payload'].toString(),
      createdAt: json['created_at'] != null 
          ? DateTime.parse(json['created_at']) 
          : DateTime.now(),
    );
  }

  static IncidentSeverity _parseSeverity(dynamic val) {
    final s = val.toString().toLowerCase();
    if (s.contains('crit')) return IncidentSeverity.critical;
    if (s.contains('high') || s.contains('alta')) return IncidentSeverity.high;
    if (s.contains('med')) return IncidentSeverity.medium;
    return IncidentSeverity.low;
  }

  static IncidentStatus _parseStatus(dynamic val) {
    final s = val.toString().toLowerCase();
    if (s.contains('block')) return IncidentStatus.blocked;
    if (s.contains('resolv')) return IncidentStatus.resolved;
    return IncidentStatus.open;
  }
}