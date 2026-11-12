import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_client.dart';
import '../services/auth_headers.dart';

class AuthRepository {
  final ApiClient apiClient;

  AuthRepository(this.apiClient);

  Future<bool> login(String email, String password) async {
    final prefs = await SharedPreferences.getInstance();

    final response = await apiClient.post('/auth/login', data: {
      'email': email,
      'password': password,
    });

    if (response.statusCode == 200 && response.data != null) {
      final token = readSessionToken(response.data);
      if (token == null || token.isEmpty) {
        throw Exception('El servidor no devolvió un token de sesión válido.');
      }
      await apiClient.persistAuthToken(token);
      await prefs.setString('user_email', email);
      await prefs.setString('saved_email', email);
      await prefs.setBool('is_logged_in', true);
      // Limpia caché vieja de otra cuenta al iniciar sesión
      await prefs.remove('persistent_scans_list_v4');
      return true;
    }

    throw Exception('Usuario no registrado o contraseña incorrecta');
  }

  Future<bool> requestPasswordReset(String email) async {
    final response = await apiClient.post('/auth/forgot-password', data: {
      'email': email,
    });
    return response.statusCode == 200 || response.statusCode == 201;
  }
}
