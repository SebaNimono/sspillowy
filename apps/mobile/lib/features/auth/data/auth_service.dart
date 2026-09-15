import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/constants/api_endpoints.dart';
import '../../../core/network/dio_client.dart';

class AuthService {
  final DioClient _dioClient;

  // Cambiar a 'false' cuando el backend tenga los endpoints listos en producción
  static const bool _useMock = true;

  AuthService(this._dioClient);

  /// Parsea las excepciones de Dio para extraer el mensaje detallado del backend
  String _parseDioError(DioException e, String fallbackMessage) {
    final data = e.response?.data;
    if (data != null && data is Map && data['message'] != null) {
      final message = data['message'];
      if (message is List) {
        return message.join(', ');
      }
      return message.toString();
    }

    switch (e.response?.statusCode) {
      case 400:
        return 'Los datos ingresados son inválidos o no cumplen los requisitos.';
      case 401:
        return 'Credenciales incorrectas. Verifique correo y contraseña.';
      case 403:
        return 'Acceso denegado. No tiene permisos para esta acción.';
      case 404:
        return 'El endpoint de registro/login no fue encontrado en el servidor.';
      case 409:
        return 'El correo electrónico ya se encuentra registrado.';
      case 500:
        return 'Error interno del servidor. Intente más tarde.';
      default:
        return fallbackMessage;
    }
  }

  /// Inicia sesión con correo y contraseña.
  Future<bool> login(String email, String password) async {
    if (_useMock) {
      await Future.delayed(const Duration(milliseconds: 800)); // Simula red
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('jwt_token', 'mock_jwt_token_pulse_12345');
      return true;
    }

    try {
      final response = await _dioClient.dio.post(
        ApiEndpoints.login,
        data: {'email': email, 'password': password},
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final token = response.data['token'] ?? response.data['access_token'];
        if (token != null) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('jwt_token', token.toString());
        }
        return true;
      }
      return false;
    } on DioException catch (e) {
      throw Exception(
        _parseDioError(e, 'Error de autenticación con el servidor.'),
      );
    } catch (e) {
      throw Exception('Error inesperado al iniciar sesión.');
    }
  }

  /// Registra un nuevo usuario en la plataforma.
  Future<bool> register({
    required String name,
    required String email,
    required String password,
  }) async {
    if (_useMock) {
      await Future.delayed(const Duration(milliseconds: 800)); // Simula red
      return true;
    }

    try {
      final response = await _dioClient.dio.post(
        ApiEndpoints.register,
        data: {'name': name, 'email': email, 'password': password},
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return true;
      }
      return false;
    } on DioException catch (e) {
      throw Exception(
        _parseDioError(e, 'No se pudo completar el registro del usuario.'),
      );
    } catch (e) {
      throw Exception('Error inesperado durante el registro.');
    }
  }

  /// Solicita el restablecimiento/recuperación de contraseña mediante correo.
  Future<bool> resetPassword(String email) async {
    if (_useMock) {
      await Future.delayed(const Duration(milliseconds: 800));
      return true;
    }

    try {
      final response = await _dioClient.dio.post(
        ApiEndpoints.forgotPassword,
        data: {'email': email},
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return true;
      }
      return false;
    } on DioException catch (e) {
      throw Exception(
        _parseDioError(e, 'No se pudo procesar la solicitud de recuperación.'),
      );
    } catch (e) {
      throw Exception('Error inesperado al solicitar restablecimiento.');
    }
  }

  /// Cierra sesión eliminando el token guardado localmente.
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
  }

  /// Comprueba si el usuario tiene una sesión activa.
  Future<bool> isAuthenticated() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token');
    return token != null && token.isNotEmpty;
  }
}
