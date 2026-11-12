import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

class BiometricGuard {
  static final LocalAuthentication _auth = LocalAuthentication();

  /// Exige firma biométrica (huella o rostro) antes de ejecutar acciones críticas.
  static Future<bool> verifyIdentity({
    String reason =
        'Confirma tu identidad con huella o rostro para autorizar esta acción de seguridad',
  }) async {
    try {
      final bool canCheck = await _auth.canCheckBiometrics;
      final bool isSupported = await _auth.isDeviceSupported();

      if (!canCheck && !isSupported) {
        return false;
      }

      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: false,
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );
    } on PlatformException {
      return false;
    } catch (_) {
      return false;
    }
  }
}
