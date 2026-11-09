import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_client.dart';
import '../services/auth_headers.dart';

class AuthRepository {
  final ApiClient apiClient;

  AuthRepository(this.apiClient);

  Future<bool> login(String email, String password) async {
    final prefs = await SharedPreferences.getInstance();

    final response = await apiClient.post('/api/v1/auth/login', data: {
      'email': email,
      'password': password,
    });

    if (response.statusCode == 200 && response.data != null) {
      final token = readSessionToken(response.data) ?? 'token_$email';
      await apiClient.persistAuthToken(token);
      await prefs.setString('user_email', email);
      await prefs.setBool('is_logged_in', true);
      return true;
    }

    final savedEmail = prefs.getString('user_email');
    final savedToken = prefs.getString('jwt_token');
    if (savedEmail != null &&
        savedEmail == email &&
        savedToken != null &&
        savedToken.isNotEmpty) {
      await prefs.setBool('is_logged_in', true);
      apiClient.setAuthToken(savedToken);
      return true;
    }

    throw Exception('Usuario no registrado o contraseña incorrecta');
  }

  Future<bool> requestPasswordReset(String email) async {
    final response = await apiClient.post('/api/v1/auth/forgot-password', data: {
      'email': email,
    });
    return response.statusCode == 200 || response.statusCode == 201;
  }
}
