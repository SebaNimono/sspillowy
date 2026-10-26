import 'package:dio/dio.dart';

class BypassService {
  final Dio dio;

  // URL del Web Hub
  static const String baseUrl = 'https://sspillowy.com';

  BypassService(Dio dioClient)
      : dio = dioClient
          ..options.baseUrl = baseUrl
          ..options.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          };

  Future<List<dynamic>> getBypasses({String? workspaceId, String? token}) async {
    try {
      final response = await dio.get(
        '/api/v1/security-gates/bypasses',
        options: Options(
          headers: {
            if (token != null) 'authorization': 'Bearer $token',
            if (workspaceId != null) 'X-Workspace-Id': workspaceId,
          },
        ),
      );

      if (response.data is List) {
        return response.data as List<dynamic>;
      } else if (response.data is Map && response.data['data'] != null) {
        return response.data['data'] as List<dynamic>;
      }
      return [];
    } catch (e) {
      print('Error al consultar GET /api/v1/security-gates/bypasses: $e');
      return [];
    }
  }

  Future<bool> decideBypass({
    required String bypassId,
    required String action, // 'approve' o 'reject'
    String? note,
    String? token,
    String? sessionId,
    String? workspaceId,
  }) async {
    try {
      final endpoint = '/api/v1/security-gates/bypasses/$bypassId/$action';
      final response = await dio.post(
        endpoint,
        data: {'note': note ?? 'Procesado desde la app móvil'},
        options: Options(
          headers: {
            if (token != null) 'authorization': 'Bearer $token',
            if (sessionId != null) 'X-Session-Id': sessionId,
            if (workspaceId != null) 'X-Workspace-Id': workspaceId,
          },
        ),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      print('Error al postear decisión ($action): $e');
      return false;
    }
  }
}
