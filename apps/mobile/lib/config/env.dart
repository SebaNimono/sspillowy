class Env {
  // Configuración autónoma para producción (Servidor remoto SSPillowY)
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.sspillowy.com/api/v1',
  );
}