import 'dart:async';
import 'dart:ui';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';
import 'auth_headers.dart';
import 'notification_service.dart';

class OnCallBackgroundService {
  static bool _configured = false;

  static Future<void> initialize() async {
    if (_configured) return;
    try {
      final service = FlutterBackgroundService();

      const AndroidNotificationChannel serviceChannel = AndroidNotificationChannel(
        'sspillowy_oncall_fg',
        'Monitor de Guardia On-Call',
        description: 'Mantiene activa la recepción de alertas críticas en segundo plano',
        importance: Importance.low,
      );

      const AndroidNotificationChannel alertChannel = AndroidNotificationChannel(
        'sspillowy_channel',
        'Alertas On-Call',
        description: 'Canal de notificaciones emergentes de seguridad',
        importance: Importance.max,
      );

      final fln = FlutterLocalNotificationsPlugin();
      final androidFln = fln.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      await androidFln?.createNotificationChannel(serviceChannel);
      await androidFln?.createNotificationChannel(alertChannel);

      await service.configure(
        androidConfiguration: AndroidConfiguration(
          onStart: onStart,
          autoStart: false,
          autoStartOnBoot: false,
          isForegroundMode: true,
          notificationChannelId: 'sspillowy_oncall_fg',
          initialNotificationTitle: 'SSPILLOWY Pulse • Guardia Activa',
          initialNotificationContent: 'Monitoreando alertas de seguridad en tiempo real',
          foregroundServiceNotificationId: 888999,
          foregroundServiceTypes: [AndroidForegroundType.dataSync],
        ),
        iosConfiguration: IosConfiguration(
          autoStart: false,
          onForeground: onStart,
        ),
      );
      _configured = true;
    } catch (_) {}
  }

  static Future<void> ensureStarted() async {
    try {
      await initialize();
      final prefs = await SharedPreferences.getInstance();
      final isLoggedIn = prefs.getBool('is_logged_in') ?? false;
      final isOnDuty = prefs.getBool('is_on_duty') ?? true;
      if (!isLoggedIn || !isOnDuty) return;

      final service = FlutterBackgroundService();
      final running = await service.isRunning();
      if (!running) {
        await service.startService();
      }
    } catch (_) {}
  }

  static Future<void> stopIfRunning() async {
    try {
      final service = FlutterBackgroundService();
      final running = await service.isRunning();
      if (running) {
        service.invoke('stopService');
      }
    } catch (_) {}
  }

  static Future<void> checkNowAndPush({bool allowFirstBatchPush = true}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.reload();

      final isLoggedIn = prefs.getBool('is_logged_in') ?? false;
      if (!isLoggedIn) return;

      final isOnDuty = prefs.getBool('is_on_duty') ?? true;
      if (!isOnDuty) return;

      final sessionId = resolveStoredSession(
        jwtToken: prefs.getString('jwt_token'),
        sessionId: prefs.getString('session_id'),
      );
      if (sessionId == null || sessionId.isEmpty) return;

      final pushedIds = (prefs.getStringList('pushed_alert_ids') ?? []).toSet();
      final bool hasSeeded = prefs.getBool('notif_baseline_seeded') ?? false;
      final bool shouldPushNow = allowFirstBatchPush && hasSeeded;
      bool changed = false;
      int pushedInCycle = 0;

      final dio = Dio(
        BaseOptions(
          baseUrl: ApiClient.baseUrl,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 10),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        ),
      );
      applySessionHeaders(dio.options.headers, sessionId);

      // 1. Revisar notificaciones nuevas del servidor
      try {
        final res = await dio.get('/notifications');
        if (res.statusCode == 200 && res.data != null) {
          final data = res.data;
          final List rawList = data is List
              ? data
              : (data is Map
                  ? (data['notifications'] ?? data['data'] ?? data['items'] ?? [])
                  : []);

          for (final item in rawList) {
            if (item is Map) {
              final id = (item['id'] ?? item['_id'] ?? '').toString();
              final read = item['read'] == true || item['is_read'] == true;
              if (id.isNotEmpty && !read && !pushedIds.contains(id)) {
                pushedIds.add(id);
                changed = true;
                if (shouldPushNow && pushedInCycle < 3) {
                  pushedInCycle++;
                  final title = (item['title'] ?? item['subject'] ?? 'Alerta de Seguridad').toString();
                  final body = (item['body'] ?? item['message'] ?? item['description'] ?? 'Nuevo evento en SSPILLOWY').toString();
                  final type = (item['type'] ?? item['category'] ?? 'INFO').toString();
                  final findingId = (item['finding_id'] ?? item['resource_id'] ?? '').toString();
                  final payload = type.toUpperCase().contains('BYPASS')
                      ? '/bypass_detail?id=$findingId'
                      : '/finding_detail?id=$findingId';

                  await NotificationService.showLocalPush(
                    id: id.hashCode.abs() % 100000,
                    title: title,
                    body: body,
                    payload: payload,
                  );
                }
              }
            }
          }
        }
      } catch (_) {}

      // 2. Revisar solicitudes de Bypass pendientes
      try {
        final res = await dio.get('/security-gates/bypasses');
        if (res.statusCode == 200 && res.data != null) {
          final data = res.data;
          final List rawList = data is List
              ? data
              : (data is Map ? (data['bypasses'] ?? data['data'] ?? []) : []);

          for (final b in rawList) {
            if (b is Map) {
              final bId = (b['id'] ?? '').toString();
              final bStatus = (b['status'] ?? '').toString().toUpperCase();
              final notifKey = 'bypass_$bId';
              if (bId.isNotEmpty && bStatus == 'PENDING' && !pushedIds.contains(notifKey)) {
                pushedIds.add(notifKey);
                changed = true;
                if (shouldPushNow && pushedInCycle < 3) {
                  pushedInCycle++;
                  const title = 'Solicitud de Excepción (Bypass)';
                  final body = '${b['rule'] ?? b['title'] ?? 'Security Gate'} en ${b['repository'] ?? b['repo'] ?? 'repositorio'}';
                  final payload = '/bypass_detail?id=$bId';

                  await NotificationService.showLocalPush(
                    id: notifKey.hashCode.abs() % 100000,
                    title: title,
                    body: body,
                    payload: payload,
                  );
                }
              }
            }
          }
        }
      } catch (_) {}

      if (!hasSeeded) {
        await prefs.setBool('notif_baseline_seeded', true);
      }

      if (changed) {
        final list = pushedIds.toList();
        if (list.length > 200) {
          list.removeRange(0, list.length - 200);
        }
        await prefs.setStringList('pushed_alert_ids', list);
      }
    } catch (_) {}
  }
}

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  try {
    DartPluginRegistrant.ensureInitialized();
  } catch (_) {}
  try {
    WidgetsFlutterBinding.ensureInitialized();
  } catch (_) {}

  try {
    await NotificationService.initSystemNotifications((_) {});
  } catch (_) {}

  service.on('stopService').listen((event) {
    try {
      service.stopSelf();
    } catch (_) {}
  });

  await OnCallBackgroundService.checkNowAndPush(allowFirstBatchPush: true);
  Timer.periodic(const Duration(seconds: 15), (_) async {
    await OnCallBackgroundService.checkNowAndPush(allowFirstBatchPush: true);
  });
}
