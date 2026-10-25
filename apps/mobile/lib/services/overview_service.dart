import 'package:dio/dio.dart';
import '../models/security_gates_overview_model.dart';

class OverviewService {
  final Dio dio;

  OverviewService(this.dio);

  Future<SecurityGatesOverviewResponse?> getSecurityGatesOverview() async {
    try {
      final response = await dio.get('/api/v1/security-gates/overview');
      if (response.statusCode == 200 && response.data != null) {
        return SecurityGatesOverviewResponse.fromJson(response.data);
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}
