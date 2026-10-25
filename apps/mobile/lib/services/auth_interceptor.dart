import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

class AuthInterceptor extends Interceptor {
  final GlobalKey<NavigatorState> navigatorKey;

  AuthInterceptor({required this.navigatorKey});

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      // 1. Limpiar sesión/token guardado
      await _clearStoredSession();

      // 2. Redirigir al Login limpiando la pila de navegación y mostrando mensaje
      final context = navigatorKey.currentContext;
      if (context != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'),
            backgroundColor: Colors.orange,
            duration: Duration(seconds: 4),
          ),
        );

        navigatorKey.currentState?.pushNamedAndRemoveUntil('/login', (route) => false);
      }
    }
    super.onError(err, handler);
  }

  Future<void> _clearStoredSession() async {
    // Aquí se limpia la sesión local (SharedPreferences / Secure Storage)
  }
}
