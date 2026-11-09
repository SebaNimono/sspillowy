class ScanModel {
  final String id;
  final String? title;
  final String status;
  final String? summary;
  final DateTime createdAt;

  ScanModel({
    required this.id,
    this.title,
    required this.status,
    this.summary,
    DateTime? createdAt,
  }) : createdAt = (createdAt ?? DateTime.now()).toLocal();

  factory ScanModel.fromJson(Map<String, dynamic> json) {
    DateTime parsedDate = DateTime.now();
    if (json['created_at'] != null) {
      String dateStr = json['created_at'].toString();
      // Si la API no envía 'Z' ni formato offset (+00:00), se fuerza como UTC para toLocal()
      if (!dateStr.endsWith('Z') && !dateStr.contains('+')) {
        dateStr += 'Z';
      }
      final parsed = DateTime.tryParse(dateStr);
      if (parsed != null) {
        parsedDate = parsed.toLocal();
      }
    }
    return ScanModel(
      id: json['id']?.toString() ?? '',
      title: json['title'] ?? json['repository_url'],
      status: json['status'] ?? 'OPEN',
      summary: json['summary'] ?? json['description'],
      createdAt: parsedDate,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'status': status,
      'summary': summary,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
