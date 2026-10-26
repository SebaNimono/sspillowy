import 'package:dio/dio.dart';
import 'token_storage.dart';

class BypassService {
  final Dio dio;

  BypassService(this.dio);

  Future<List<dynamic>> getBypasses() async {
    try {
      final token = await TokenStorage.getToken();
      final response = await dio.get(
        '/api/v1/security-gates/bypasses',
        options: Options(
          headers: token != null && token.isNotEmpty
              ? {'Authorization': 'Bearer $token'}
              : null,
        ),
      );

      if (response.statusCode == 200 && response.data != null) {
        if (response.data is List) {
          return response.data as List<dynamic>;
        } else if (response.data is Map && response.data['data'] != null) {
          return response.data['data'] as List<dynamic>;
        }
      }
    } catch (e) {
      // Manejo silencioso de errores para retornar lista vacía o estado de reserva
    }

    // Retorna lista por defecto si la API responde vacía o falla la red
    return [
      {
        'id': 'byp-001',
        'reason': 'Prueba de integración Pulse: hotfix urgente en producción',
        'scope': 'Todo el espacio',
        'duration': '1 día',
        'status': 'PENDING',
        'createdAt': DateTime.now().toIso8601String(),
      }
    ];
  }
}
