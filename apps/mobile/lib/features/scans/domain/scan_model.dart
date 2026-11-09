class ScanModel {
  final String id;
  final String title;
  final String status;
  final String severity;
  final String timestamp;

  ScanModel({
    required this.id,
    required this.title,
    required this.status,
    required this.severity,
    required this.timestamp,
  });

  factory ScanModel.fromJson(Map<String, dynamic> json) {
    return ScanModel(
      id: json['id']?.toString() ?? '',
      title: json['title'] ?? json['name'] ?? 'Escaneo sin título',
      status: json['status'] ?? 'COMPLETED',
      severity: json['severity'] ?? 'LOW',
      timestamp: json['created_at'] ?? json['timestamp'] ?? 'Reciente',
    );
  }
}
