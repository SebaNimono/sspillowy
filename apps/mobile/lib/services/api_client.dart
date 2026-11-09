import "package:dio/dio.dart";
import "package:shared_preferences/shared_preferences.dart";

import "auth_headers.dart";

class ApiClient {
  static const String baseUrl = "https://api.sspillowy.com/api/v1";
  late final Dio dio;
  String? _memoryToken;

  ApiClient() {
    dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final prefs = await SharedPreferences.getInstance();
          final sessionId = _memoryToken ??
              resolveStoredSession(
                jwtToken: prefs.getString("jwt_token"),
                sessionId: prefs.getString("session_id"),
              );

          if (sessionId != null) {
            applySessionHeaders(options.headers, sessionId);
          }
          handler.next(options);
        },
        onError: (DioException error, handler) async {
          if (error.response?.statusCode == 401 ||
              error.response?.statusCode == 403) {
            final path = error.requestOptions.path;
            if (path.contains('/auth/')) {
              final prefs = await SharedPreferences.getInstance();
              await prefs.remove("session_id");
              await prefs.remove("jwt_token");
              await prefs.remove("is_logged_in");
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  /// Guarda el token en memoria y en las cabeceras por defecto de Dio.
  /// Acepta sesiones del hub y tokens de prueba locales.
  void setAuthToken(String token) {
    final sessionId = token.trim();
    _memoryToken = sessionId.isEmpty ? null : sessionId;
    if (_memoryToken != null) {
      applySessionHeaders(dio.options.headers, _memoryToken!);
    }
  }

  /// Persiste la sesión en SharedPreferences y la deja lista para Dio.
  Future<void> persistAuthToken(String token) async {
    final sessionId = token.trim();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString("jwt_token", sessionId);
    await prefs.setString("session_id", sessionId);
    setAuthToken(sessionId);
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