class NotificationModel {
  final String id;
  final String type;
  final String title;
  final DateTime createdAt;
  final bool isRead;
  final String? findingId;

  NotificationModel({
    required this.id,
    required this.type,
    required this.title,
    required this.createdAt,
    required this.isRead,
    this.findingId,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id']?.toString() ?? '',
      type: json['type'] ?? 'info',
      title: json['title'] ?? '',
      createdAt: DateTime.tryParse(json['created_at'] ?? json['date'] ?? '') ?? DateTime.now(),
      isRead: json['is_read'] ?? json['read'] ?? false,
      findingId: json['finding_id']?.toString(),
    );
  }

  NotificationModel copyWith({bool? isRead}) {
    return NotificationModel(
      id: id,
      type: type,
      title: title,
      createdAt: createdAt,
      isRead: isRead ?? this.isRead,
      findingId: findingId,
    );
  }
}
