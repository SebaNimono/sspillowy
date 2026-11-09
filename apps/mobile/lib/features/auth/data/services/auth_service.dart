import 'dart:async';
import 'package:dio/dio.dart';

class AuthService {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.sspillowy.com/api/v1',
  );

  static String? _currentSessionId;
  final Dio _dio;

  AuthService({Dio? dio})
      : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: baseUrl,
                connectTimeout: const Duration(seconds: 10),
                receiveTimeout: const Duration(seconds: 10),
              ),
            ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (_currentSessionId != null && _currentSessionId!.isNotEmpty) {
            options.headers['X-Session-Id'] = _currentSessionId;
          }
          return handler.next(options);
        },
      ),
    );
  }

  static String? get currentSessionId => _currentSessionId;

  Future<bool> login(String username, String password) async {
    try {
      final response = await _dio.post(
        '/auth/login',
        data: {
          'email': username,
          'password': password,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final sessionId = response.data['session_id']?.toString();
        if (sessionId != null && sessionId.isNotEmpty) {
          _currentSessionId = sessionId;
          return true;
        }
      }
      return false;
    } on DioException catch (e) {
      if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
        throw Exception('Credenciales inválidas o acceso denegado.');
      }
      throw Exception('Error de conexión con el servidor de autenticación.');
    }
  }

  /// Obtiene los usuarios/perfiles del tenant desde el hub
  Future<List> fetchUserProfiles() async {
    if (_currentSessionId == null) return [];

    try {
      final response = await _dio.get('/users/profiles');
      if (response.statusCode == 200 && response.data != null) {
        if (response.data is List) {
          return response.data as List;
        } else if (response.data['users'] is List) {
          return response.data['users'] as List;
        }
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  void restoreSession(String savedSessionId) {
    _currentSessionId = savedSessionId;
  }

  void logout() {
    _currentSessionId = null;
  }
}