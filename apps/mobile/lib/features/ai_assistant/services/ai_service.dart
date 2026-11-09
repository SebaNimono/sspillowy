import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';

class AIService {
  final Dio _dio;

  AIService([Dio? dio]) : _dio = dio ?? DioClient().dio;

  Future<String> sendMessage({
    required String prompt,
    String? scanId,
    List<Map<String, dynamic>>? contextData,
  }) async {
    try {
      final response = await _dio.post(
        '/api/v1/ai/chat',
        data: {
          'prompt': prompt,
          if (scanId != null) 'scan_id': scanId,
          if (contextData != null) 'context': contextData,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return response.data['response'] ?? 
               response.data['message'] ?? 
               'No se obtuvo respuesta del asistente.';
      }
      
      return _getFallbackResponse(prompt);
    } on DioException catch (e) {
      debugPrint('Error en AIService: ${e.message}');
      return _getFallbackResponse(prompt);
    }
  }

  String _getFallbackResponse(String prompt) {
    final lower = prompt.toLowerCase();
    if (lower.contains('escaneo') || lower.contains('scan')) {
      return 'No hay escaneos activos en este momento. Puedes iniciar uno nuevo con el botón "+ Nuevo Escaneo".';
    } else if (lower.contains('cwe') || lower.contains('vulnerabilidad')) {
      return 'Puedo ayudarte a analizar hallazgos de seguridad y tomar decisiones HITL sobre tus repositorios.';
    }
    return 'Respuesta en modo desconectado: Estoy listo para asistirte con la gestión de vulnerabilidades On-Call.';
  }
}