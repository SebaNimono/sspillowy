import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/services/auth_headers.dart';

void main() {
  test('login payload keeps the hub session_id', () {
    expect(
      readSessionToken({
        'session_id': 'sid-real',
        'email': 'dev@sspillowy.com',
        'name': 'dev',
        'provider': 'password',
      }),
      'sid-real',
    );
  });

  test('local test tokens are sent, not dropped', () {
    expect(
      resolveStoredSession(
        jwtToken: 'token_dev@sspillowy.com',
        sessionId: null,
      ),
      'token_dev@sspillowy.com',
    );
  });

  test('session_id is used when jwt_token is missing', () {
    expect(
      resolveStoredSession(jwtToken: '   ', sessionId: 'sid-stored'),
      'sid-stored',
    );
  });

  test('both auth headers are attached for the API', () {
    final headers = <String, dynamic>{'Content-Type': 'application/json'};
    applySessionHeaders(headers, 'sid-real');
    expect(headers['X-Session-Id'], 'sid-real');
    expect(headers['Authorization'], 'Bearer sid-real');
  });

  test('a non-map login body does not throw', () {
    expect(readSessionToken('ok'), isNull);
  });
}
