import 'package:dio/dio.dart';

class AuthService {
  final Dio dio;

  AuthService(this.dio);

  Future<bool> logout() async {
    try {
      await dio.post('/api/v1/auth/logout');
      return true;
    } catch (e) {
      return false;
    }
  }
}
