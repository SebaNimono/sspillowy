class ScanModel {
  final String id;
  final String? title;
  final String status;
  final String? severity;
  final String? summary;
  final String? repo;
  final String? type;
  final DateTime createdAt;

  ScanModel({
    required this.id,
    this.title,
    required this.status,
    this.severity,
    this.summary,
    this.repo,
    this.type,
    required this.createdAt,
  });

  factory ScanModel.fromJson(Map<String, dynamic> json) {
    DateTime parsedDate = DateTime.now();
    final rawDate = json['createdAt'] ??
        json['created_at'] ??
        json['date'] ??
        json['timestamp'];

    if (rawDate != null) {
      if (rawDate is num) {
        final int timestamp = rawDate.toInt();
        parsedDate = timestamp > 100000000000
            ? DateTime.fromMillisecondsSinceEpoch(timestamp)
            : DateTime.fromMillisecondsSinceEpoch(timestamp * 1000);
      } else {
        parsedDate = DateTime.tryParse(rawDate.toString()) ?? DateTime.now();
      }
    }

    return ScanModel(
      id: (json['id'] ?? json['_id'] ?? json['cwe_id'] ?? '').toString(),
      title: json['title']?.toString() ??
          json['cwe']?.toString() ??
          json['rule_id']?.toString() ??
          json['repo']?.toString() ??
          json['repository_name']?.toString() ??
          json['name']?.toString() ??
          'Repositorio / CWE sin título',
      status:
          (json['status'] ?? json['state'] ?? 'OPEN').toString().toUpperCase(),
      summary: json['pillow_summary']?.toString() ??
          json['summary']?.toString() ??
          json['description']?.toString() ??
          json['message']?.toString() ??
          'Sin resumen de triage disponible.',
      severity:
          (json['severity'] ?? json['level'] ?? json['risk_level'] ?? 'HIGH')
              .toString()
              .toUpperCase(),
      repo: (json['repo'] ??
              json['repository'] ??
              json['repo_name'] ??
              json['repository_name'])
          ?.toString(),
      type: (json['type'] ?? json['scan_type'] ?? json['engine'] ?? 'SAST')
          .toString()
          .toUpperCase(),
      createdAt: parsedDate,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'status': status,
      'summary': summary,
      'severity': severity,
      'repo': repo,
      'type': type,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
