import 'package:dio/dio.dart';
import '../services/api_client.dart';

class IncidentRepository {
  final ApiClient _apiClient;

  IncidentRepository(this._apiClient);

  Future<List<dynamic>> getPendingIncidents({
    String? status,
    String? severity,
    String? query,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null) queryParams['status'] = status;
      if (severity != null) queryParams['severity'] = severity;
      if (query != null && query.isNotEmpty) queryParams['q'] = query;

      final response = await _apiClient.dio.get(
        '/findings',
        queryParameters: queryParams,
      );

      return response.data as List<dynamic>;
    } on DioException catch (e) {
      throw Exception(e.response?.data['detail'] ?? 'Error al obtener hallazgos');
    }
  }

  Future<bool> approveException({
    required String incidentId,
    required int durationHours,
    required String justification,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/findings/$incidentId/exception',
        data: {
          'duration_hours': durationHours,
          'justification': justification,
        },
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } on DioException catch (e) {
      throw Exception(e.response?.data['detail'] ?? 'Error al registrar excepción');
    }
  }

  Future<bool> confirmBlock({
    required String incidentId,
    required String reason,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/findings/$incidentId/block',
        data: {'reason': reason},
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } on DioException catch (e) {
      throw Exception(e.response?.data['detail'] ?? 'Error al confirmar bloqueo');
    }
  }
}