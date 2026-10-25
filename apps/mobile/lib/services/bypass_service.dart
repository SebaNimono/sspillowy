import 'package:dio/dio.dart';

class BypassService {
  final Dio _dio;

  BypassService(this._dio);

  Future<bool> sendBypassDecision({
    required String bypassId,
    required String action, // 'approve' o 'reject'
    String? comment,
  }) async {
    try {
      final response = await _dio.post(
        '/api/v1/security-gates/bypasses/$bypassId/$action',
        data: {'comment': comment ?? ''},
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      return false;
    }
  }
}
