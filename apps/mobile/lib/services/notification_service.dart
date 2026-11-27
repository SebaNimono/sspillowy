import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/notification_model.dart';

class NotificationService {
  final String baseUrl;
  final String token;
  final String? workspaceId;

  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  NotificationService({
    required this.baseUrl,
    required this.token,
    this.workspaceId,
  });

  Future _buildHeaders() async {
    String? effectiveWorkspace = workspaceId?.trim();
    if (effectiveWorkspace == null || effectiveWorkspace.isEmpty) {
      try {
        final prefs = await SharedPreferences.getInstance();
        effectiveWorkspace =
            (prefs.getString('selected_workspace_id') ?? '').trim();
      } catch (_) {}
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
      'X-Session-Id': token,
      if (effectiveWorkspace != null && effectiveWorkspace.isNotEmpty)
        'X-Workspace-Id': effectiveWorkspace,
    };
  }

  // 1. Inicialización del sistema nativo de Push y Handler de Deep Linking
  static Future<void> initSystemNotifications(
      Function(String?) onNotificationTap) async {
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const DarwinInitializationSettings initializationSettingsIOS =
        DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const InitializationSettings initializationSettings =
        InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );

    await _localNotifications.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        onNotificationTap(response.payload);
      },
    );

    // Capturar si la app fue abierta desde una notificación cuando estaba cerrada
    final launchDetails =
        await _localNotifications.getNotificationAppLaunchDetails();
    if (launchDetails?.didNotificationLaunchApp == true) {
      final initialPayload = launchDetails?.notificationResponse?.payload;
      if (initialPayload != null && initialPayload.isNotEmpty) {
        Future.delayed(const Duration(milliseconds: 600), () {
          onNotificationTap(initialPayload);
        });
      }
    }

    // Solicitar permiso explícito en Android 13+
    final androidImplementation =
        _localNotifications.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (androidImplementation != null) {
      await androidImplementation.requestNotificationsPermission();
    }
  }

  // 2. Método para disparar la notificación emergente flotante en el celular
  static Future<void> showLocalPush({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    const AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      'sspillowy_channel',
      'Alertas On-Call',
      channelDescription: 'Canal de notificaciones emergentes de seguridad',
      importance: Importance.max,
      priority: Priority.high,
      showWhen: true,
    );

    const NotificationDetails details = NotificationDetails(
      android: androidDetails,
      iOS: DarwinNotificationDetails(),
    );

    await _localNotifications.show(id, title, body, details, payload: payload);
  }

  // 3. Métodos HTTP existentes de sincronización con la API
  Future<List<NotificationModel>> fetchNotifications() async {
    try {
      final headers = await _buildHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/api/v1/notifications'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final dynamic decoded = json.decode(response.body);
        final List<dynamic> data = decoded is List
            ? decoded
            : (decoded is Map && decoded['notifications'] is List
                ? decoded['notifications'] as List<dynamic>
                : []);
        return data.map((json) => NotificationModel.fromJson(json)).toList();
      } else {
        throw Exception(
            'Error al cargar notificaciones (${response.statusCode})');
      }
    } catch (e) {
      debugPrint('Error en fetchNotifications: $e');
      return [];
    }
  }

  Future<bool> markAsRead(String notificationId) async {
    final headers = await _buildHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/api/v1/notifications/$notificationId/read'),
      headers: headers,
    );

    if (response.statusCode == 200 || response.statusCode == 204) {
      return true;
    } else {
      throw Exception('Error al marcar notificación como leída');
    }
  }
}