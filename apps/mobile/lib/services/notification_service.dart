import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/notification_model.dart';

class NotificationService {
  final String baseUrl;
  final String token;

  NotificationService({
    required this.baseUrl,
    required this.token,
  });

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };

  Future<List<NotificationModel>> fetchNotifications() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/v1/notifications'),
      headers: _headers,
    );

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data.map((json) => NotificationModel.fromJson(json)).toList();
    } else {
      throw Exception('Error al cargar notificaciones (${response.statusCode})');
    }
  }

  Future<bool> markAsRead(String notificationId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/v1/notifications/$notificationId/read'),
      headers: _headers,
    );

    if (response.statusCode == 200 || response.statusCode == 204) {
      return true;
    } else {
      throw Exception('Error al marcar notificación como leída');
    }
  }
}
