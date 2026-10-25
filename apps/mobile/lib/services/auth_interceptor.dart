import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'token_storage.dart';

class AuthInterceptor extends Interceptor {
  final GlobalKey<NavigatorState> navigatorKey;

  AuthInterceptor({required this.navigatorKey});

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await TokenStorage.getToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    super.onRequest(options, handler);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      await TokenStorage.clearToken();

      final context = navigatorKey.currentContext;
      if (context != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Sesión expirada. Redirigiendo al login...'),
            backgroundColor: Colors.orange,
          ),
        );

        navigatorKey.currentState?.pushNamedAndRemoveUntil('/login', (route) => false);
      }
    }
    super.onError(err, handler);
  }
}
