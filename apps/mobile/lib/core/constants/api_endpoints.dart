class ApiEndpoints {
  static const String baseUrl = 'https://api.sspillowy.com';
  
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String forgotPassword = '/auth/forgot-password';
  static const String incidents = '/incidents';

  static String approveIncident(String id) => '/incidents/$id/approve';
  static String blockIncident(String id) => '/incidents/$id/block';
}