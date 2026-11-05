import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class BypassService {
  final Dio dio;

  static const String baseUrl = 'https://api.sspillowy.com';
  static const String _cacheKey = 'cached_security_bypasses';

  BypassService(Dio dioClient)
      : dio = dioClient
          ..options.baseUrl = baseUrl
          ..options.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          };

  Future<List<dynamic>> getBypasses({
    String? token,
    String? workspaceId,
    String? sessionId,
  }) async {
    final prefs = await SharedPreferences.getInstance();

    // Intentar obtener token guardado si no viene explícito
    final effectiveToken = token ?? prefs.getString('auth_token');

    try {
      final response = await dio.get(
        '/api/v1/security-gates/bypasses',
        options: Options(
          headers: {
            if (effectiveToken != null && effectiveToken.isNotEmpty)
              'Authorization': 'Bearer $effectiveToken',
            if (sessionId != null) 'X-Session-Id': sessionId,
            if (workspaceId != null) 'X-Workspace-Id': workspaceId,
          },
        ),
      );

      List<dynamic> resultList = [];

      if (response.data is List) {
        resultList = response.data as List<dynamic>;
      } else if (response.data is Map && response.data['data'] != null) {
        resultList = response.data['data'] as List<dynamic>;
      }

      // Si obtuvimos respuesta válida del servidor, actualizamos la caché local
      if (resultList.isNotEmpty) {
        await prefs.setString(_cacheKey, jsonEncode(resultList));
      }

      return resultList;
    } catch (e) {
      debugPrint('Error en getBypasses (Backend): $e. Cargando caché local...');

      // Fallback: Recuperar datos desde SharedPreferences si el backend falla (401, 404, etc.)
      final cachedString = prefs.getString(_cacheKey);
      if (cachedString != null) {
        try {
          final List<dynamic> cachedList = jsonDecode(cachedString);
          return cachedList;
        } catch (jsonErr) {
          debugPrint('Error decodificando caché de bypasses: $jsonErr');
        }
      }
      return [];
    }
  }

  /// Procesa la decisión (aprobar/rechazar) de un bypass específico
  Future<bool> decideBypass(
    String id,
    String action, {
    String? reason,
    String? token,
    String? workspaceId,
    String? sessionId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final effectiveToken = token ?? prefs.getString('auth_token');

    try {
      final response = await dio.post(
        '/api/v1/security-gates/bypasses/$id/$action',
        data: {
          'note': reason ?? 'Procesado desde la app móvil',
        },
        options: Options(
          headers: {
            if (effectiveToken != null && effectiveToken.isNotEmpty)
              'Authorization': 'Bearer $effectiveToken',
            if (sessionId != null) 'X-Session-Id': sessionId,
            if (workspaceId != null) 'X-Workspace-Id': workspaceId,
          },
        ),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      debugPrint('Error al $action el bypass $id: $e');
      return false;
    }
  }

  /// Método llamado por BypassDetailScreen para aprobar
  Future<bool> approveBypass(
    String id, {
    String? reason,
    String? token,
    String? workspaceId,
    String? sessionId,
  }) async {
    return decideBypass(
      id,
      'approve',
      reason: reason,
      token: token,
      workspaceId: workspaceId,
      sessionId: sessionId,
    );
  }

  /// Método llamado por BypassDetailScreen para rechazar
  Future<bool> rejectBypass(
    String id, {
    String? reason,
    String? token,
    String? workspaceId,
    String? sessionId,
  }) async {
    return decideBypass(
      id,
      'reject',
      reason: reason,
      token: token,
      workspaceId: workspaceId,
      sessionId: sessionId,
    );
  }
}
