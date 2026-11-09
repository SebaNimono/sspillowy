import 'package:dio/dio.dart';
import '../../../../services/api_client.dart';

class SecurityGateService {
  final ApiClient _apiClient;

  SecurityGateService(this._apiClient);

  Future<List<dynamic>> fetchPendingBypasses() async {
    try {
      final response = await _apiClient.dio.get('/security-gates/bypasses');
      if (response.statusCode == 200 && response.data != null) {
        if (response.data is List) {
          return response.data as List<dynamic>;
        }
      }
      return [];
    } on DioException catch (e) {
      throw Exception(e.response?.data['detail'] ?? 'Error al obtener excepciones pendientes');
    } catch (e) {
      throw Exception('Error inesperado al conectar con Security Gate');
    }
  }
}
