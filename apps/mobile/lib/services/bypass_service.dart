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

  Future<List<dynamic>> getBypasses() async {
    try {
      final response = await dio.get('/api/v1/security-gates/bypasses');
      if (response.data is List) {
        return response.data as List<dynamic>;
      } else if (response.data is Map && response.data['data'] != null) {
        return response.data['data'] as List<dynamic>;
      }
      return [];
    } catch (e) {
      print('Error al obtener bypasses: $e');
      return [];
    }
  }

  Future<bool> decideBypass(String id, String action) async {
    try {
      // Envía 'approve' o 'reject' directamente al backend
      final response = await dio.post(
        '/api/v1/security-gates/bypasses/$id/$action',
        data: {'note': 'Procesado desde la app móvil'},
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      print('Error al registrar decisión ($action): $e');
      return false;
    }
  }
}
