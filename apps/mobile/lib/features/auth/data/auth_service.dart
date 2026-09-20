import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';

class AuthService {
  final Dio _dio;

  AuthService([Dio? dio]) : _dio = dio ?? DioClient().dio;

  Future<Response> login(String email, String password) async {
    return await _dio.post('/api/v1/auth/login', data: {
      'email': email,
      'password': password,
    });
  }
}
