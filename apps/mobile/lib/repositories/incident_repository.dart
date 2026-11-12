import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../services/api_client.dart';

class IncidentRepository {
  final ApiClient _apiClient;

  IncidentRepository(this._apiClient);

  /// Obtiene la lista de hallazgos pendientes (Bandeja)
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
      throw Exception(
          e.response?.data['detail'] ?? 'Error al obtener hallazgos');
    }
  }

  /// Obtiene la lista de Bypasses y Excepciones registradas (Gobernanza)
  Future<List<dynamic>> getBypasses() async {
    try {
      final response = await _apiClient.dio.get('/security-gates/bypasses');

      final data = response.data;
      if (data is Map<String, dynamic>) {
        final rawList =
            data['exceptions'] ?? data['bypasses'] ?? data['data'] ?? [];
        return rawList is List ? rawList : [];
      }
      return data is List ? data : [];
    } on DioException catch (e) {
      debugPrint("Error en getBypasses (Backend): ${e.message}");
      return [];
    }
  }

  /// Solicita / Aprueba una Excepción (Bypass) con sincronización al servidor
  Future<bool> approveException({
    required String incidentId,
    required int durationHours,
    required String justification,
  }) async {
    try {
      final response = await _apiClient.dio.patch(
        '/findings/$incidentId',
        data: {
          'status': 'EXEMPTED',
          'duration_hours': durationHours,
          'justification': justification,
        },
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } on DioException catch (e) {
      throw Exception(
          e.response?.data['detail'] ?? 'Error al registrar excepción');
    }
  }

  /// Confirma un Bloqueo de Despliegue
  Future<bool> confirmBlock({
    required String incidentId,
    required String reason,
  }) async {
    try {
      final response = await _apiClient.dio.patch(
        '/findings/$incidentId',
        data: {
          'status': 'BLOCKED',
          'reason': reason,
        },
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } on DioException catch (e) {
      throw Exception(
          e.response?.data['detail'] ?? 'Error al confirmar bloqueo');
    }
  }
}
