import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../main.dart' show rootNavigatorKey;

class BiometricGuard {
  static final LocalAuthentication _auth = LocalAuthentication();
  static const String _pinHashKey = 'sspillowy_fallback_pin_hash_v1';

  /// Exige firma biométrica (huella, rostro o PIN/patrón del dispositivo) antes de ejecutar acciones críticas.
  /// Si el dispositivo no dispone de biometría o el sensor falla, activa automáticamente el Plan B con PIN de 6 dígitos.
  static Future<bool> verifyIdentity({
    String reason =
        'Confirma tu identidad con huella, rostro o PIN para autorizar esta acción de seguridad',
  }) async {
    try {
      final bool canCheck = await _auth.canCheckBiometrics;
      final bool isSupported = await _auth.isDeviceSupported();

      if (!canCheck && !isSupported) {
        return await _verifyWithFallbackPin(reason);
      }

      final bool authenticated = await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: false,
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );

      return authenticated;
    } on PlatformException catch (e) {
      final code = e.code.toLowerCase();
      // Si el usuario canceló manualmente la biometría, bloquear estrictamente.
      if (code.contains('cancel')) {
        return false;
      }
      // Si el hardware no está disponible, no hay huellas registradas o es un emulador sin sensor, usar Plan B PIN.
      return await _verifyWithFallbackPin(reason);
    } catch (_) {
      return await _verifyWithFallbackPin(reason);
    }
  }

  /// Hash determinístico con salt para no almacenar el PIN en texto plano.
  static String _hashPin(String pin) {
    final bytes = utf8.encode('sspillowy_guard_salt_2026:$pin');
    int h1 = 0x811c9dc5;
    int h2 = 0x01000193;
    for (final b in bytes) {
      h1 ^= b;
      h1 = (h1 * 0x01000193) & 0xFFFFFFFF;
      h2 = ((h2 << 5) - h2 + b) & 0xFFFFFFFF;
    }
    return '${h1.toRadixString(16).padLeft(8, '0')}${h2.toRadixString(16).padLeft(8, '0')}';
  }

  static Future<bool> _verifyWithFallbackPin(String reason) async {
    final initialCtx = rootNavigatorKey.currentContext;
    if (initialCtx == null || !initialCtx.mounted) {
      return false;
    }

    final prefs = await SharedPreferences.getInstance();
    final storedHash = prefs.getString(_pinHashKey);
    final bool isSetupMode = storedHash == null || storedHash.isEmpty;

    final ctx = rootNavigatorKey.currentContext;
    if (ctx == null || !ctx.mounted) {
      return false;
    }

    final pinController = TextEditingController();
    final confirmController = TextEditingController();
    String? errorText;

    final result = await showDialog<bool>(
      context: ctx,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF161B22),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Color(0xFF30363D)),
              ),
              title: Row(
                children: [
                  const Icon(Icons.pin_outlined, color: Color(0xFF38BDF8)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      isSetupMode
                          ? 'Configurar PIN de Respaldo'
                          : 'Verificación con PIN (Plan B)',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isSetupMode
                        ? 'Biometría no disponible en este dispositivo. Define un PIN numérico de 6 dígitos para firmar acciones críticas:'
                        : reason,
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: pinController,
                    autofocus: true,
                    obscureText: true,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      letterSpacing: 6,
                      fontWeight: FontWeight.bold,
                    ),
                    decoration: InputDecoration(
                      labelText: isSetupMode
                          ? 'Nuevo PIN (6 dígitos)'
                          : 'Ingresa tu PIN (6 dígitos)',
                      labelStyle:
                          const TextStyle(color: Colors.grey, fontSize: 13),
                      counterText: '',
                      border: const OutlineInputBorder(),
                      errorText: isSetupMode ? null : errorText,
                    ),
                  ),
                  if (isSetupMode) ...[
                    const SizedBox(height: 12),
                    TextField(
                      controller: confirmController,
                      obscureText: true,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        letterSpacing: 6,
                        fontWeight: FontWeight.bold,
                      ),
                      decoration: InputDecoration(
                        labelText: 'Confirmar PIN (6 dígitos)',
                        labelStyle:
                            const TextStyle(color: Colors.grey, fontSize: 13),
                        counterText: '',
                        border: const OutlineInputBorder(),
                        errorText: errorText,
                      ),
                    ),
                  ],
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogCtx, false),
                  child: const Text('Cancelar'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                  ),
                  onPressed: () async {
                    final pin = pinController.text.trim();
                    if (pin.length != 6) {
                      setDialogState(() {
                        errorText = 'El PIN debe tener exactamente 6 dígitos.';
                      });
                      return;
                    }

                    if (isSetupMode) {
                      final confirm = confirmController.text.trim();
                      if (pin != confirm) {
                        setDialogState(() {
                          errorText = 'Los códigos PIN no coinciden.';
                        });
                        return;
                      }
                      final navigator = Navigator.of(dialogCtx);
                      await prefs.setString(_pinHashKey, _hashPin(pin));
                      navigator.pop(true);
                    } else {
                      if (_hashPin(pin) == storedHash) {
                        Navigator.pop(dialogCtx, true);
                      } else {
                        setDialogState(() {
                          errorText = 'PIN incorrecto. Autorización denegada.';
                        });
                      }
                    }
                  },
                  child: Text(
                    isSetupMode ? 'Guardar y Autorizar' : 'Autorizar',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );

    pinController.dispose();
    confirmController.dispose();
    return result ?? false;
  }
}
