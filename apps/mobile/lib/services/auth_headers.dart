/// Resolves the session sent to the hub.
///
/// `jwt_token` wins when it is present. A local test value such as
/// `token_user@host` is a valid session string and is not discarded.
String? resolveStoredSession({String? jwtToken, String? sessionId}) {
  for (final raw in [jwtToken, sessionId]) {
    final value = raw?.trim();
    if (value != null && value.isNotEmpty) {
      return value;
    }
  }
  return null;
}

/// Reads the session from a login payload.
///
/// The hub returns `session_id`. Older payloads may use `token` or
/// `access_token`. Non-map bodies yield null instead of a cast error.
String? readSessionToken(dynamic data) {
  if (data is! Map) return null;
  return resolveStoredSession(
    jwtToken: _asText(data['session_id']) ??
        _asText(data['jwt_token']) ??
        _asText(data['token']),
    sessionId: _asText(data['access_token']),
  );
}

String? _asText(dynamic value) {
  if (value == null) return null;
  final text = value.toString().trim();
  if (text.isEmpty || text == 'null') return null;
  return text;
}

/// Writes both headers the API accepts for every outgoing call.
void applySessionHeaders(Map<String, dynamic> headers, String sessionId) {
  headers['X-Session-Id'] = sessionId;
  headers['Authorization'] = 'Bearer $sessionId';
}
