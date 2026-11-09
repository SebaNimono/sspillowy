import 'package:dio/dio.dart';
import 'package:mobile/features/auth/data/services/auth_service.dart';

class FindingService {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.sspillowy.com/api/v1',
  );

  final Dio _dio;

  FindingService({Dio? dio})
      : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: baseUrl,
                connectTimeout: const Duration(seconds: 10),
                receiveTimeout: const Duration(seconds: 10),
              ),
            );

  Future<List<dynamic>> fetchFindings({String? sessionId}) async {
    final activeSession = sessionId ?? AuthService.currentSessionId;
    if (activeSession == null || activeSession.isEmpty) {
      return [];
    }

    try {
      final response = await _dio.get(
        '/findings',
        options: Options(headers: {
          'X-Session-Id': activeSession,
          'Authorization': 'Bearer $activeSession',
        }),
      );

      final data = response.data;
      if (data is List) {
        return data;
      } else if (data is Map) {
        if (data['findings'] is List) return data['findings'] as List;
        if (data['data'] is List) return data['data'] as List;
        if (data['items'] is List) return data['items'] as List;
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<bool> updateFindingStatus({
    String? sessionId,
    required String findingId,
    required String newStatus,
  }) async {
    final activeSession = sessionId ?? AuthService.currentSessionId;
    try {
      final response = await _dio.patch(
        '/findings/$findingId',
        data: {'status': newStatus},
        options: Options(headers: {
          'X-Session-Id': activeSession,
          'Authorization': 'Bearer $activeSession',
        }),
      );
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}