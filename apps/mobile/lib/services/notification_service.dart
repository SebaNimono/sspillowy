import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import '../models/notification_model.dart';

class NotificationService {
  final String baseUrl;
  final String token;

  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  NotificationService({
    required this.baseUrl,
    required this.token,
  });

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };

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

    // Solicitar permisos explícitos para Android 13+ y crear canal de notificaciones
    final androidImplementation =
        _localNotifications.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();

    if (androidImplementation != null) {
      await androidImplementation.requestNotificationsPermission();

      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        'sspillowy_channel',
        'Alertas On-Call',
        description: 'Canal de notificaciones emergentes de seguridad',
        importance: Importance.max,
      );

      await androidImplementation.createNotificationChannel(channel);
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

  // 3. Métodos HTTP de sincronización con la API (Soporta respuestas directas y envueltas)
  Future<List<NotificationModel>> fetchNotifications() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/v1/notifications'),
        headers: _headers,
      );

      if (response.statusCode == 200) {
        final dynamic decodedData = json.decode(response.body);
        List<dynamic> rawList = [];

        if (decodedData is List) {
          rawList = decodedData;
        } else if (decodedData is Map<String, dynamic>) {
          if (decodedData['notifications'] is List) {
            rawList = decodedData['notifications'] as List<dynamic>;
          } else if (decodedData['data'] is List) {
            rawList = decodedData['data'] as List<dynamic>;
          }
        }

        return rawList.map((json) => NotificationModel.fromJson(json)).toList();
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
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/v1/notifications/$notificationId/read'),
        headers: _headers,
      );

      return response.statusCode == 200 || response.statusCode == 204;
    } catch (e) {
      debugPrint('Error en markAsRead: $e');
      return false;
    }
  }
}
