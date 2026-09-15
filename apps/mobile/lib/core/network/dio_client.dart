import 'package:dio/dio.dart';
import '../constants/api_endpoints.dart';

class DioClient {
  late final Dio _dio;

  DioClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: {'Content-Type': 'application/json'},
      ),
    );
  }

  // Permite acceder a la instancia de Dio desde AuthService y Repositories
  Dio get dio => _dio;
}