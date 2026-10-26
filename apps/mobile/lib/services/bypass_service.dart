import 'package:dio/dio.dart';

class BypassService {
  final Dio dio;

  static const String baseUrl = 'https://api.sspillowy.com';

  BypassService(Dio dioClient)
      : dio = dioClient
          ..options.baseUrl = baseUrl
          ..options.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          };

  // Obtiene todas las excepciones (filtrables por estado o workspace)
  Future<List<dynamic>> getBypasses({
    String? workspaceId,
    String? token,
    String? sessionId,
  }) async {
    try {
      final response = await dio.get(
        '/api/v1/security-gates/bypasses',
        options: Options(
          headers: {
            if (token != null) 'authorization': 'Bearer $token',
            if (sessionId != null) 'X-Session-Id': sessionId,
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

  // Aprueba o Rechaza la excepción enviando el POST al backend
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
      print('Error en la API al $action bypass ($bypassId): $e');
      return false;
    }
  }
}
