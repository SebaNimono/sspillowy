import "dart:async";
import "package:dio/dio.dart";
import "package:flutter_secure_storage/flutter_secure_storage.dart";
import "package:shared_preferences/shared_preferences.dart";

import "auth_headers.dart";

class ApiClient {
  static const String baseUrl = "https://api.sspillowy.com/api/v1";
  static final StreamController<void> _sessionExpiredController = StreamController<void>.broadcast();
  static Stream<void> get sessionExpiredStream => _sessionExpiredController.stream;
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();

  late final Dio dio;
  String? _memoryToken;

  ApiClient() {
    dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final sessionId = _memoryToken ?? await readStoredToken();

          if (sessionId != null && sessionId.isNotEmpty) {
            applySessionHeaders(options.headers, sessionId);
          } else {
            options.headers.remove('Authorization');
            options.headers.remove('X-Session-Id');
          }
          handler.next(options);
        },
        onError: (DioException error, handler) async {
          final status = error.response?.statusCode;
          if (status == 401) {
            await clearAuthToken();
            if (!_sessionExpiredController.isClosed) {
              _sessionExpiredController.add(null);
            }
          } else if (status == 403 && error.requestOptions.path.contains('/auth/')) {
            await clearAuthToken();
          }
          return handler.next(error);
        },
      ),
    );
  }

  static Future<String?> readStoredToken() async {
    try {
      final secureJwt = await _secureStorage.read(key: "jwt_token");
      final secureSession = await _secureStorage.read(key: "session_id");
      final resolvedSecure = resolveStoredSession(
        jwtToken: secureJwt,
        sessionId: secureSession,
      );
      if (resolvedSecure != null && resolvedSecure.isNotEmpty) {
        return resolvedSecure;
      }

      // Migración única desde SharedPreferences en texto plano hacia SecureStorage
      final prefs = await SharedPreferences.getInstance();
      final legacyToken = resolveStoredSession(
        jwtToken: prefs.getString("jwt_token"),
        sessionId: prefs.getString("session_id"),
      );
      if (legacyToken != null && legacyToken.isNotEmpty) {
        await _secureStorage.write(key: "jwt_token", value: legacyToken);
        await _secureStorage.write(key: "session_id", value: legacyToken);
        await prefs.remove("jwt_token");
        await prefs.remove("session_id");
        return legacyToken;
      }
    } catch (_) {}
    return null;
  }

  void setAuthToken(String token) {
    final sessionId = token.trim();
    _memoryToken = sessionId.isEmpty ? null : sessionId;
    if (_memoryToken != null) {
      applySessionHeaders(dio.options.headers, _memoryToken!);
    } else {
      dio.options.headers.remove('Authorization');
      dio.options.headers.remove('X-Session-Id');
    }
  }

  Future<void> persistAuthToken(String token) async {
    final sessionId = token.trim();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove("jwt_token");
    await prefs.remove("session_id");
    await prefs.remove("auth_token");

    if (sessionId.isEmpty) {
      await clearAuthToken();
      return;
    }

    await _secureStorage.write(key: "jwt_token", value: sessionId);
    await _secureStorage.write(key: "session_id", value: sessionId);
    setAuthToken(sessionId);
  }

  Future<void> clearAuthToken() async {
    _memoryToken = null;
    dio.options.headers.remove('Authorization');
    dio.options.headers.remove('X-Session-Id');
    try {
      await _secureStorage.delete(key: "jwt_token");
      await _secureStorage.delete(key: "session_id");
    } catch (_) {}
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove("jwt_token");
      await prefs.remove("session_id");
      await prefs.remove("auth_token");
      await prefs.remove("cached_security_bypasses");
      await prefs.remove("persistent_chat_history");
      await prefs.remove("persistent_scans_list_v4");
      await prefs.setBool("is_logged_in", false);
    } catch (_) {}
  }

  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await dio.get(
      path,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response> post(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await dio.post(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response> put(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await dio.put(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response> patch(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await dio.patch(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response> delete(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return await dio.delete(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }
}



