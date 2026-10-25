import 'package:flutter/foundation.dart';

class TokenStorage {
  static String? _token;

  static Future<void> saveToken(String token) async {
    _token = token;
  }

  static Future<String?> getToken() async {
    return _token;
  }

  static Future<void> clearToken() async {
    _token = null;
  }

  static Future<bool> hasToken() async {
    return _token != null && _token!.isNotEmpty;
  }
}
