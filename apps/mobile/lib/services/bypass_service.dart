import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';

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

  Future<Map<String, String>> _buildAuthHeaders({
    String? token,
    String? workspaceId,
    String? sessionId,
  }) async {
    final effectiveToken = token ?? await ApiClient.readStoredToken();
    final effectiveSession = sessionId ?? effectiveToken;

    return {
      if (effectiveToken != null && effectiveToken.isNotEmpty)
        'Authorization': 'Bearer $effectiveToken',
      if (effectiveSession != null && effectiveSession.isNotEmpty)
        'X-Session-Id': effectiveSession,
      if (workspaceId != null && workspaceId.isNotEmpty)
        'X-Workspace-Id': workspaceId,
    };
  }

  Future<List<dynamic>> getBypasses({
    String? token,
    String? workspaceId,
    String? sessionId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final headers = await _buildAuthHeaders(
      token: token,
      workspaceId: workspaceId,
      sessionId: sessionId,
    );

    try {
      final response = await dio.get(
        '/api/v1/security-gates/bypasses',
        options: Options(headers: headers),
      );

      List<dynamic> resultList = [];

      if (response.data is List) {
        resultList = response.data as List<dynamic>;
      } else if (response.data is Map) {
        final mapData = response.data as Map<String, dynamic>;
        if (mapData['data'] is List) {
          resultList = mapData['data'] as List<dynamic>;
        } else if (mapData['bypasses'] is List) {
          resultList = mapData['bypasses'] as List<dynamic>;
        } else if (mapData['items'] is List) {
          resultList = mapData['items'] as List<dynamic>;
        }
      }

      await prefs.setString(_cacheKey, jsonEncode(resultList));
      return resultList;
    } catch (e) {
      debugPrint('Error en getBypasses (Backend): $e. Cargando caché local...');

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

  Future<Map<String, dynamic>?> getBypassById(
    String id, {
    String? token,
    String? workspaceId,
    String? sessionId,
  }) async {
    final headers = await _buildAuthHeaders(
      token: token,
      workspaceId: workspaceId,
      sessionId: sessionId,
    );

    try {
      final response = await dio.get(
        '/api/v1/security-gates/bypasses/$id',
        options: Options(headers: headers),
      );
      if (response.statusCode == 200 && response.data is Map) {
        final raw = Map<String, dynamic>.from(response.data as Map);
        if (raw['data'] is Map) {
          return Map<String, dynamic>.from(raw['data'] as Map);
        }
        if (raw['bypass'] is Map) {
          return Map<String, dynamic>.from(raw['bypass'] as Map);
        }
        return raw;
      }
    } catch (_) {}

    try {
      final list = await getBypasses(
        token: token,
        workspaceId: workspaceId,
        sessionId: sessionId,
      );
      for (final item in list) {
        if (item is Map && (item['id'] ?? '').toString() == id) {
          return Map<String, dynamic>.from(item);
        }
      }
    } catch (_) {}

    return null;
  }

  String? lastDecisionError;

  Future<bool> decideBypass(
    String id,
    String action, {
    String? reason,
    String? expectedCommitSha,
    bool acknowledgeContextChange = false,
    String? token,
    String? workspaceId,
    String? sessionId,
  }) async {
    lastDecisionError = null;
    final headers = await _buildAuthHeaders(
      token: token,
      workspaceId: workspaceId,
      sessionId: sessionId,
    );

    final payload = <String, dynamic>{
      'note': reason ?? 'Procesado desde la app móvil',
      if (expectedCommitSha != null && expectedCommitSha.isNotEmpty)
        'expected_commit_sha': expectedCommitSha,
      if (acknowledgeContextChange)
        'acknowledge_context_change': true,
    };

    try {
      final response = await dio.post(
        '/api/v1/security-gates/bypasses/$id/$action',
        data: payload,
        options: Options(headers: headers),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } on DioException catch (e) {
      final detail = e.response?.data is Map
          ? (e.response?.data['detail']?.toString())
          : null;
      lastDecisionError = detail ?? 'Error al sincronizar con el servidor (${e.response?.statusCode ?? "red"}).';
      debugPrint('Error al $action el bypass $id: $lastDecisionError');
      return false;
    } catch (e) {
      lastDecisionError = 'Error inesperado al procesar la solicitud.';
      debugPrint('Error al $action el bypass $id: $e');
      return false;
    }
  }

  Future<bool> approveBypass(
    String id, {
    String? reason,
    String? expectedCommitSha,
    bool acknowledgeContextChange = false,
    String? token,
    String? workspaceId,
    String? sessionId,
  }) async {
    return decideBypass(
      id,
      'approve',
      reason: reason,
      expectedCommitSha: expectedCommitSha,
      acknowledgeContextChange: acknowledgeContextChange,
      token: token,
      workspaceId: workspaceId,
      sessionId: sessionId,
    );
  }

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



