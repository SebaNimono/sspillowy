import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';

class AuthService {
  final Dio _dio;

  AuthService([Dio? dio]) : _dio = dio ?? DioClient().dio;

  Future<bool> login(String email, String password) async {
    try {
      final cleanEmail = email.trim();
      final cleanPassword = password.trim();

      final response = await _dio.post(
        '/api/v1/auth/login',
        data: {
          'username': cleanEmail, // FastAPI OAuth2 estándar usa 'username'
          'password': cleanPassword,
        },
        options: Options(
          contentType: Headers.formUrlEncodedContentType,
        ),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final accessToken = response.data['access_token'];
        if (accessToken != null) {
          
        }
        return true;
      }
      return false;
    } on DioException catch (e) {
      if (e.response?.statusCode == 422 || e.response?.statusCode == 401) {
        return false;
      }
      rethrow;
    }
  }

  /// Solicita el correo de recuperación de contraseña al backend
  Future<bool> requestPasswordReset(String email) async {
    try {
      final cleanEmail = email.trim();
      
      // Ajusta la ruta ('/api/v1/auth/forgot-password' o la correspondiente) según Swagger
      final response = await _dio.post(
        '/api/v1/auth/forgot-password',
        data: {
          'email': cleanEmail,
        },
      );

      return response.statusCode == 200 || response.statusCode == 201;
    } on DioException catch (e) {
      debugPrint('Error al solicitar recuperación: ${e.message}');
      return false;
    }
  }
}