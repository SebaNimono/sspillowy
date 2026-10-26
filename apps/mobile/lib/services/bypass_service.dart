import 'package:dio/dio.dart';

class BypassService {
  final Dio dio;

  // Reemplaza con la URL base exacta de tu servidor backend Web Hub
  static const String baseUrl = 'http://localhost:3000';

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
      return response.data as List<dynamic>;
    } catch (e) {
      print('Error al obtener bypasses: $e');
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
        data: {
          'note': note ?? 'Procesado desde la app móvil',
        },
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
      print('Error en la API al $action bypass ($bypassId): $e');
      return false;
    }
  }
}
