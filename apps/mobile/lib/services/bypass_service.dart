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

  Future _buildAuthHeaders({
    String? token,
    String? workspaceId,
    String? sessionId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final effectiveToken = token ??
        prefs.getString('jwt_token') ??
        prefs.getString('session_id') ??
        prefs.getString('auth_token');
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

  Future<bool> decideBypass(
    String id,
    String action, {
    String? reason,
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
      final response = await dio.post(
        '/api/v1/security-gates/bypasses/$id/$action',
        data: {
          'note': reason ?? 'Procesado desde la app móvil',
        },
        options: Options(headers: headers),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      debugPrint('Error al $action el bypass $id: $e');
      return false;
    }
  }

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