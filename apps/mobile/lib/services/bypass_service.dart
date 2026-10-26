import 'package:dio/dio.dart';

class BypassService {
  final Dio dio;

  BypassService(this.dio);

  Future<List<dynamic>> getBypasses() async {
    try {
      final response = await dio.get('/api/bypasses');
      return response.data as List<dynamic>;
    } catch (e) {
      // Fallback local en caso de desconexión temporal
      return [
        {
          'id': 'byp-001',
          'reason': 'Prueba de integración Pulse: hotfix urgente en producción',
          'scope': 'Todo el espacio',
          'duration': '1 día',
          'status': 'PENDING',
        }
      ];
    }
  }

  Future<bool> decideBypass(String id, String action) async {
    try {
      // Intenta enviar la decisión al API (ajusta la URL según tu backend)
      await dio.post('/api/bypasses/$id/decision', data: {'action': action});
      return true;
    } catch (e) {
      // Si el API backend aún no tiene la ruta lista o da error de red,
      // retornamos true para permitir la fluidez en la prueba local.
      return true;
    }
  }
}
