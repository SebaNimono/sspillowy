import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

class BiometricGuard {
  static final LocalAuthentication _auth = LocalAuthentication();
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  static const String _keyAlias = 'guard_biometric_alias';
  static const String _keyPin = 'guard_backup_pin_6';
  static const String _keyPassword = 'guard_backup_account_password';
  static const String _keyBiometricEnabled = 'guard_biometric_enabled';

  static Future getSecurityConfig() async {
    final alias = await _storage.read(key: _keyAlias);
    final pin = await _storage.read(key: _keyPin);
    final pwd = await _storage.read(key: _keyPassword);
    final bioEnabledRaw = await _storage.read(key: _keyBiometricEnabled);
    final canCheck = await _auth.canCheckBiometrics;
    final isSupported = await _auth.isDeviceSupported();

    return {
      'alias': alias ?? '',
      'hasPin': pin != null && pin.length == 6,
      'hasPassword': pwd != null && pwd.isNotEmpty,
      'biometricEnabled': bioEnabledRaw != 'false',
      'hardwareAvailable': canCheck || isSupported,
    };
  }

  static Future<void> saveSecurityConfig({
    String? alias,
    String? pin6,
    String? accountPassword,
    bool? biometricEnabled,
  }) async {
    if (alias != null) {
      final trimmed = alias.trim();
      if (trimmed.isEmpty) {
        await _storage.delete(key: _keyAlias);
      } else {
        await _storage.write(key: _keyAlias, value: trimmed);
      }
    }
    if (pin6 != null) {
      final trimmed = pin6.trim();
      if (trimmed.length == 6) {
        await _storage.write(key: _keyPin, value: trimmed);
      } else if (trimmed.isEmpty) {
        await _storage.delete(key: _keyPin);
      }
    }
    if (accountPassword != null) {
      final trimmed = accountPassword.trim();
      if (trimmed.isEmpty) {
        await _storage.delete(key: _keyPassword);
      } else {
        await _storage.write(key: _keyPassword, value: trimmed);
      }
    }
    if (biometricEnabled != null) {
      await _storage.write(
        key: _keyBiometricEnabled,
        value: biometricEnabled ? 'true' : 'false',
      );
    }
  }

  /// Exige firma biométrica (huella/rostro) y, si falla, está deshabilitada o no hay sensor,
  /// activa automáticamente el Plan B (PIN de 6 dígitos o contraseña de cuenta).
  static Future<bool> verifyIdentity({
    String reason =
        'Confirma tu identidad con huella, rostro o PIN para autorizar esta acción de seguridad',
    BuildContext? context,
  }) async {
    final config = await getSecurityConfig();
    final alias = (config['alias'] as String).trim();
    final bioEnabled = config['biometricEnabled'] as bool;
    final hardwareAvailable = config['hardwareAvailable'] as bool;

    final effectiveReason = alias.isNotEmpty
        ? '$reason (Credencial: $alias)'
        : reason;

    if (bioEnabled && hardwareAvailable) {
      try {
        final authenticated = await _auth.authenticate(
          localizedReason: effectiveReason,
          options: const AuthenticationOptions(
            biometricOnly: false,
            stickyAuth: true,
            useErrorDialogs: true,
          ),
        );
        if (authenticated) return true;
      } on PlatformException {
        // Sensor sucio, húmedo, bloqueado o sin huellas registradas -> pasar a Plan B
      } catch (_) {
        // Fallback a Plan B
      }
    }

    final targetContext =
        context ?? WidgetsBinding.instance.focusManager.primaryFocus?.context;
    if (targetContext == null || !targetContext.mounted) {
      return false;
    }

    return await _showPlanBFallbackDialog(targetContext, alias: alias);
  }

  static Future<bool> _showPlanBFallbackDialog(
    BuildContext context, {
    required String alias,
  }) async {
    final storedPin = await _storage.read(key: _keyPin);
    final storedPassword = await _storage.read(key: _keyPassword);
    final hasPin = storedPin != null && storedPin.length == 6;
    final hasPassword = storedPassword != null && storedPassword.isNotEmpty;

    if (!context.mounted) return false;

    bool usePasswordMode = !hasPin && hasPassword;
    bool isSetupMode = !hasPin && !hasPassword;
    final inputController = TextEditingController();
    final confirmPinController = TextEditingController();
    String? errorMsg;

    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (ctx, setState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF161B22),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Color(0xFF30363D)),
              ),
              title: Row(
                children: [
                  const Icon(Icons.lock_person_outlined,
                      color: Colors.amber, size: 22),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      isSetupMode
                          ? 'Configurar Plan B de Guardia'
                          : 'Plan B de Verificación',
                      style: const TextStyle(color: Colors.white, fontSize: 16),
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
                        ? 'No se pudo validar la biometría. Define un PIN de 6 dígitos de emergencia para continuar sin quedar bloqueado.'
                        : alias.isNotEmpty
                            ? 'Biometría no disponible para "$alias". Ingresa tu ${usePasswordMode ? "contraseña de cuenta" : "PIN de 6 dígitos"}.'
                            : 'Biometría no disponible o fallida. Ingresa tu ${usePasswordMode ? "contraseña de cuenta" : "PIN de 6 dígitos"} para autorizar.',
                    style: const TextStyle(
                        color: Color(0xFFC9D1D9), fontSize: 12.5),
                  ),
                  const SizedBox(height: 14),
                  if (!isSetupMode && hasPin && hasPassword)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: SegmentedButton<bool>(
                        segments: const [
                          ButtonSegment<bool>(
                            value: false,
                            label: Text('PIN 6 dígitos'),
                          ),
                          ButtonSegment<bool>(
                            value: true,
                            label: Text('Contraseña'),
                          ),
                        ],
                        selected: {usePasswordMode},
                        onSelectionChanged: (sel) {
                          setState(() {
                            usePasswordMode = sel.first;
                            inputController.clear();
                            errorMsg = null;
                          });
                        },
                      ),
                    ),
                  TextField(
                    controller: inputController,
                    obscureText: true,
                    keyboardType: (isSetupMode || !usePasswordMode)
                        ? TextInputType.number
                        : TextInputType.visiblePassword,
                    maxLength: (isSetupMode || !usePasswordMode) ? 6 : null,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: isSetupMode
                          ? 'Nuevo PIN de 6 dígitos'
                          : (usePasswordMode
                              ? 'Contraseña de cuenta'
                              : 'PIN de 6 dígitos'),
                      errorText: errorMsg,
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  if (isSetupMode) ...[
                    const SizedBox(height: 8),
                    TextField(
                      controller: confirmPinController,
                      obscureText: true,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                        labelText: 'Confirmar PIN de 6 dígitos',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ],
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogCtx).pop(false),
                  child: const Text('Cancelar'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.amber.shade700,
                    foregroundColor: Colors.black,
                  ),
                  onPressed: () async {
                    final val = inputController.text.trim();
                    if (isSetupMode) {
                      final confirmVal = confirmPinController.text.trim();
                      if (val.length != 6 || int.tryParse(val) == null) {
                        setState(() => errorMsg =
                            'El PIN debe tener exactamente 6 dígitos numéricos.');
                        return;
                      }
                      if (val != confirmVal) {
                        setState(() => errorMsg = 'Los PIN no coinciden.');
                        return;
                      }
                      await saveSecurityConfig(pin6: val);
                      if (dialogCtx.mounted) Navigator.of(dialogCtx).pop(true);
                      return;
                    }

                    if (usePasswordMode) {
                      if (val == storedPassword) {
                        Navigator.of(dialogCtx).pop(true);
                      } else {
                        setState(() => errorMsg = 'Contraseña incorrecta.');
                      }
                    } else {
                      if (val == storedPin) {
                        Navigator.of(dialogCtx).pop(true);
                      } else {
                        setState(() => errorMsg = 'PIN de 6 dígitos incorrecto.');
                      }
                    }
                  },
                  child: Text(isSetupMode ? 'Guardar y Autorizar' : 'Verificar'),
                ),
              ],
            );
          },
        );
      },
    );

    return result == true;
  }
}

/// Tarjeta configurable para Perfil / Seguridad (Huella + Seudónimo + Plan B PIN/Contraseña)
class BiometricSecuritySettingsCard extends StatefulWidget {
  const BiometricSecuritySettingsCard({super.key});

  @override
  State<BiometricSecuritySettingsCard> createState() =>
      _BiometricSecuritySettingsCardState();
}

class _BiometricSecuritySettingsCardState
    extends State<BiometricSecuritySettingsCard> {
  final TextEditingController _aliasController = TextEditingController();
  final TextEditingController _pinController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  bool _loading = true;
  bool _biometricEnabled = true;
  bool _hasPin = false;
  bool _hasPassword = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final cfg = await BiometricGuard.getSecurityConfig();
    if (!mounted) return;
    setState(() {
      _aliasController.text = cfg['alias'] as String;
      _biometricEnabled = cfg['biometricEnabled'] as bool;
      _hasPin = cfg['hasPin'] as bool;
      _hasPassword = cfg['hasPassword'] as bool;
      _loading = false;
    });
  }

  Future<void> _registerBiometricWithAlias() async {
    final alias = _aliasController.text.trim();
    if (alias.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Ingresa un seudónimo para identificar tu huella/rostro.'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    final ok = await BiometricGuard.verifyIdentity(
      reason: 'Registra tu huella o rostro con el seudónimo "$alias"',
      context: context,
    );

    if (!mounted) return;

    if (ok) {
      await BiometricGuard.saveSecurityConfig(
        alias: alias,
        biometricEnabled: true,
      );
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Credencial biométrica "$alias" registrada correctamente.'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  Future<void> _saveBackupCredentials() async {
    final pin = _pinController.text.trim();
    final pwd = _passwordController.text.trim();

    if (pin.isNotEmpty && (pin.length != 6 || int.tryParse(pin) == null)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('El PIN de respaldo debe tener exactamente 6 dígitos.'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    await BiometricGuard.saveSecurityConfig(
      alias: _aliasController.text.trim(),
      pin6: pin.isNotEmpty ? pin : null,
      accountPassword: pwd.isNotEmpty ? pwd : null,
      biometricEnabled: _biometricEnabled,
    );

    _pinController.clear();
    _passwordController.clear();
    await _load();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Configuración de seguridad y Plan B guardada.'),
        backgroundColor: Colors.green,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    return Card(
      color: const Color(0xFF161B22),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFF30363D)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.fingerprint, color: Colors.cyanAccent),
                SizedBox(width: 8),
                Text(
                  'Biometría y Plan B de Guardia',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text(
                'Autenticación biométrica (Huella / Face ID)',
                style: TextStyle(color: Colors.white, fontSize: 13.5),
              ),
              subtitle: const Text(
                'Si falla o el sensor está húmedo, se activará el Plan B',
                style: TextStyle(color: Colors.grey, fontSize: 12),
              ),
              value: _biometricEnabled,
              onChanged: (v) async {
                setState(() => _biometricEnabled = v);
                await BiometricGuard.saveSecurityConfig(biometricEnabled: v);
              },
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _aliasController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Seudónimo de huella (ej. Pulgar Derecho Guardia)',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _registerBiometricWithAlias,
                icon: const Icon(Icons.verified_user_outlined, size: 18),
                label: const Text('Registrar / Validar Huella con Seudónimo'),
              ),
            ),
            const Divider(height: 24, color: Color(0xFF30363D)),
            Text(
              'Plan B de Emergencia (${_hasPin ? "PIN configurado" : "Sin PIN"} • ${_hasPassword ? "Contraseña configurada" : "Sin contraseña"})',
              style: const TextStyle(
                color: Color(0xFFC9D1D9),
                fontWeight: FontWeight.w600,
                fontSize: 12.5,
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _pinController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              obscureText: true,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: _hasPin
                    ? 'Cambiar PIN de 6 dígitos'
                    : 'Configurar PIN de 6 dígitos',
                border: const OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _passwordController,
              obscureText: true,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: _hasPassword
                    ? 'Actualizar contraseña de respaldo'
                    : 'Ingresar contraseña de cuenta como respaldo',
                border: const OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saveBackupCredentials,
                child: const Text('Guardar Plan B y Seudónimo'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}