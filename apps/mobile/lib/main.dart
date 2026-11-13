import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'services/notification_service.dart';
import 'services/on_call_background_service.dart';
import 'services/biometric_guard.dart';
import 'services/bypass_service.dart';
import 'screens/bypass_detail_screen.dart';
import 'features/security_gate/presentation/screens/security_gate_bypasses_screen.dart';
import 'repositories/incident_repository.dart';
import 'services/api_client.dart';
import 'services/auth_headers.dart';

typedef StringMap = Map<String, String>;

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();
final StreamController<String> notificationTapStream =
    StreamController<String>.broadcast();

class ScanModel {
  final String id;
  final String? title;
  final String status;
  final String? severity;
  final String? summary;
  final String? repo;
  final String? type;
  final DateTime createdAt;

  ScanModel({
    required this.id,
    this.title,
    required this.status,
    this.severity,
    this.summary,
    this.repo,
    this.type,
    required this.createdAt,
  });

  factory ScanModel.fromJson(Map<String, dynamic> json) {
    DateTime parsedDate = DateTime.now();
    final rawDate = json['createdAt'] ??
        json['created_at'] ??
        json['date'] ??
        json['timestamp'];

    if (rawDate != null) {
      if (rawDate is num) {
        final int timestamp = rawDate.toInt();
        parsedDate = timestamp > 100000000000
            ? DateTime.fromMillisecondsSinceEpoch(timestamp)
            : DateTime.fromMillisecondsSinceEpoch(timestamp * 1000);
      } else {
        parsedDate = DateTime.tryParse(rawDate.toString()) ?? DateTime.now();
      }
    }

    return ScanModel(
      id: (json['id'] ?? json['_id'] ?? json['cwe_id'] ?? '').toString(),
      title: json['title']?.toString() ??
          json['cwe']?.toString() ??
          json['rule_id']?.toString() ??
          json['repo']?.toString() ??
          json['repository_name']?.toString() ??
          json['name']?.toString() ??
          'Repositorio / CWE sin título',
      status:
          (json['status'] ?? json['state'] ?? 'OPEN').toString().toUpperCase(),
      summary: json['ai_summary']?.toString() ??
          json['pillow_summary']?.toString() ??
          json['summary']?.toString() ??
          json['description']?.toString() ??
          json['message']?.toString() ??
          'Sin resumen de triage disponible.',
      severity: () {
        final rawSev = json['severity'] ??
            json['level'] ??
            json['risk_level'] ??
            json['criticality'] ??
            json['severity_level'] ??
            json['priority'];
        if (rawSev == null) return 'HIGH';
        final str = rawSev.toString().toUpperCase();
        if (str.contains('CRIT') ||
            str == 'CRITICAL' ||
            str == '9' ||
            str == '10') {
          return 'CRITICAL';
        }
        if (str.contains('HIGH') || str.contains('ALT')) {
          return 'HIGH';
        }
        return str;
      }(),
      repo: (json['repo'] ??
              json['repository'] ??
              json['repo_name'] ??
              json['repository_name'])
          ?.toString(),
      type: (json['type'] ?? json['scan_type'] ?? json['engine'] ?? 'SAST')
          .toString()
          .toUpperCase(),
      createdAt: parsedDate,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'status': status,
      'summary': summary,
      'severity': severity,
      'repo': repo,
      'type': type,
      'created_at': createdAt.toIso8601String(),
    };
  }
}

class AuthRepository {
  final ApiClient apiClient;

  AuthRepository(this.apiClient);

  Future<bool> login(String email, String password) async {
    final prefs = await SharedPreferences.getInstance();

    try {
      final response = await apiClient.post('/auth/login', data: {
        'email': email,
        'password': password,
      });

      if (response.statusCode == 200 && response.data != null) {
        final token = readSessionToken(response.data);
        if (token != null && token.isNotEmpty) {
          await apiClient.persistAuthToken(token);
          await prefs.setString('user_email', email);
          await prefs.setString('primary_user_email', email);
          await prefs.setString('user_name', email.split('@').first);
          await prefs.setBool('is_logged_in', true);
          await prefs.remove('persistent_scans_list_v4');
          await prefs.remove('cached_security_bypasses');
      await prefs.remove('persistent_audit_logs');
      await prefs.remove('persistent_chat_history');
      await prefs.remove('pushed_alert_ids');
      await prefs.remove('notif_baseline_seeded');
          return true;
        }
      }
    } catch (_) {}

    return false;
  }

  Future<bool> requestPasswordReset(String email) async {
    final response = await apiClient.post('/auth/forgot-password', data: {
      'email': email,
    });
    return response.statusCode == 200 || response.statusCode == 201;
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await NotificationService.initSystemNotifications((payload) {
    debugPrint("Notificación seleccionada con payload: $payload");
    if (payload != null && payload.isNotEmpty) {
      notificationTapStream.add(payload);
    }
  });

  await OnCallBackgroundService.initialize();

  runApp(const SSPillowyApp());
}

class SSPillowyApp extends StatefulWidget {
  const SSPillowyApp({super.key});

  @override
  State<SSPillowyApp> createState() => _SSPillowyAppState();
}

class _SSPillowyAppState extends State<SSPillowyApp> {
  bool _isLoggedIn = false;
  bool _isLoading = true;
  bool _isOnDuty = true;

  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
  }

  Future<void> _checkLoginStatus() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = await ApiClient.readStoredToken();
      final isLoggedInPref = prefs.getBool('is_logged_in') ?? false;
      final savedOnDuty = prefs.getBool('is_on_duty') ?? true;

      if (!mounted) return;
      setState(() {
        _isLoggedIn = (token != null && token.isNotEmpty) && isLoggedInPref;
        _isOnDuty = savedOnDuty;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoggedIn = false;
        _isLoading = false;
      });
    }
  }

  Future<void> _handleLoginSuccess() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('is_logged_in', true);
    await prefs.setBool('is_on_duty', _isOnDuty);
    if (!mounted) return;
    setState(() {
      _isLoggedIn = true;
    });
  }

  Future<void> _handleLogout() async {
    try {
      await OnCallBackgroundService.stopIfRunning();
      await ApiClient().clearAuthToken();
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('user_email');
      await prefs.remove('primary_user_email');
      await prefs.remove('primary_user_name');
      await prefs.remove('user_name');
      await prefs.remove('persistent_scans_list_v4');
      await prefs.remove('cached_security_bypasses');
      await prefs.remove('persistent_audit_logs');
      await prefs.remove('persistent_chat_history');
      await prefs.remove('pushed_alert_ids');
      await prefs.remove('notif_baseline_seeded');
      await prefs.setBool('is_logged_in', false);
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _isLoggedIn = false;
    });
  }

  void _toggleOnDuty(bool? val) async {
    final nextVal = val ?? true;
    setState(() {
      _isOnDuty = nextVal;
    });
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('is_on_duty', nextVal);
    if (nextVal) {
      await OnCallBackgroundService.ensureStarted();
    } else {
      await OnCallBackgroundService.stopIfRunning();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          backgroundColor: Color(0xFF0D1117),
          body: Center(
              child: CircularProgressIndicator(color: Color(0xFF38BDF8))),
        ),
      );
    }

    return MaterialApp(
      navigatorKey: rootNavigatorKey,
      title: 'SSPILLOWY',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: const Color(0xFF0D1117),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF0284C7),
          secondary: Color(0xFF38BDF8),
          surface: Color(0xFF161B22),
        ),
      ),
      home: !_isLoggedIn
          ? LoginScreenWithTerms(onLoginSuccess: _handleLoginSuccess)
          : MainNavigationWrapper(
              onLogout: _handleLogout,
              isOnDuty: _isOnDuty,
              onToggleOnDuty: (val) => _toggleOnDuty(val),
            ),
    );
  }
}

class LoginScreenWithTerms extends StatefulWidget {
  final VoidCallback onLoginSuccess;

  const LoginScreenWithTerms({
    super.key,
    required this.onLoginSuccess,
  });

  @override
  State<LoginScreenWithTerms> createState() => _LoginScreenWithTermsState();
}

class _LoginScreenWithTermsState extends State<LoginScreenWithTerms> {
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _inlineLoginError;
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  late final AuthRepository _authRepository;

  @override
  void initState() {
    super.initState();
    _authRepository = AuthRepository(ApiClient());
    _loadSavedEmail();
  }

  Future<void> _loadSavedEmail() async {
    final prefs = await SharedPreferences.getInstance();
    final savedEmail = prefs.getString('user_email');
    if (savedEmail != null && savedEmail.isNotEmpty) {
      setState(() {
        _emailController.text = savedEmail;
      });
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _openWebUrl(String url) async {
    FocusScope.of(context).unfocus();
    final uri = Uri.parse(url);
    try {
      bool launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
    } catch (_) {
      try {
        await launchUrl(uri, mode: LaunchMode.inAppWebView);
      } catch (_) {}
    }
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
  }

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    setState(() => _inlineLoginError = null);

    if (email.isEmpty || password.isEmpty || !_isValidEmail(email)) {
      setState(() {
        _inlineLoginError = 'Ingresa tu correo y/o contraseña';
      });
      return;
    }

    setState(() => _isLoading = true);

    try {
      final success = await _authRepository.login(email, password);
      if (success && mounted) {
        ScaffoldMessenger.of(context).clearSnackBars();
        widget.onLoginSuccess();
      } else {
        if (mounted) {
          setState(() {
            _inlineLoginError = 'Usuario no registrado o contraseña incorrecta';
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _inlineLoginError = 'Usuario no registrado o contraseña incorrecta';
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding:
                const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Image.asset(
                      'assets/logo/logo_2.png',
                      height: 100,
                      errorBuilder: (_, __, ___) => const Icon(
                        Icons.shield_outlined,
                        size: 80,
                        color: Color(0xFF38BDF8),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'SSPILLOWY',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Inicia sesión en tu cuenta',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                  ),
                  const SizedBox(height: 32),
                  TextField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    style: const TextStyle(color: Colors.white, fontSize: 15),
                    decoration: InputDecoration(
                      labelText: 'Correo Electrónico',
                      labelStyle:
                          const TextStyle(color: Colors.white, fontSize: 14),
                      prefixIcon:
                          const Icon(Icons.email_outlined, color: Colors.grey),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 16),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6),
                        borderSide:
                            const BorderSide(color: Colors.white, width: 1),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6),
                        borderSide: const BorderSide(
                            color: Color(0xFF38BDF8), width: 1.5),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    style: const TextStyle(color: Colors.white, fontSize: 15),
                    decoration: InputDecoration(
                      labelText: 'Contraseña',
                      labelStyle:
                          const TextStyle(color: Colors.white, fontSize: 14),
                      prefixIcon:
                          const Icon(Icons.lock_outline, color: Colors.grey),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          color: Colors.grey,
                        ),
                        onPressed: () => setState(
                            () => _obscurePassword = !_obscurePassword),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 16),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6),
                        borderSide:
                            const BorderSide(color: Colors.white, width: 1),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6),
                        borderSide: const BorderSide(
                            color: Color(0xFF38BDF8), width: 1.5),
                      ),
                    ),
                  ),
                  if (_inlineLoginError != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.red.shade900.withValues(alpha: 0.4),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.red.shade700),
                      ),
                      child: Text(
                        _inlineLoginError!,
                        style: const TextStyle(
                            color: Colors.redAccent, fontSize: 13),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      InkWell(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const ForgotPasswordScreen(),
                            ),
                          );
                        },
                        child: const Padding(
                          padding: EdgeInsets.symmetric(vertical: 4.0),
                          child: Text(
                            '¿Olvidaste tu contraseña?',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF38BDF8),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                      Row(
                        children: [
                          const Text(
                            '¿No tienes cuenta? ',
                            style: TextStyle(
                                fontSize: 12, color: Color(0xFF94A3B8)),
                          ),
                          InkWell(
                            onTap: () =>
                                _openWebUrl('https://sspillowy.com/register'),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(vertical: 4.0),
                              child: Text(
                                'Regístrate',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF38BDF8),
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF21262D),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6),
                        side: const BorderSide(color: Color(0xFF30363D)),
                      ),
                    ),
                    onPressed: _isLoading ? null : _handleLogin,
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Iniciar Sesión',
                            style: TextStyle(
                              fontSize: 16,
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final TextEditingController _emailController = TextEditingController();
  bool _isLoading = false;
  String? _message;
  bool _isSuccess = false;
  late final AuthRepository _authRepository;

  @override
  void initState() {
    super.initState();
    _authRepository = AuthRepository(ApiClient());
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleSendResetLink() async {
    final email = _emailController.text.trim();
    if (email.isEmpty ||
        !RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email)) {
      setState(() {
        _message = 'Ingresa un correo electrónico válido';
        _isSuccess = false;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _message = null;
    });

    try {
      final success = await _authRepository.requestPasswordReset(email);
      if (mounted) {
        setState(() {
          _isSuccess = success;
          _message = success
              ? 'Te hemos enviado un enlace para definir tu contraseña nueva.'
              : 'No se pudo procesar la solicitud.';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isSuccess = false;
          _message =
              'Ocurrió un problema al enviar el enlace. Inténtalo nuevamente.';
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding:
                const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Image.asset(
                      'assets/logo/logo_2.png',
                      height: 80,
                      errorBuilder: (_, __, ___) => const Icon(
                        Icons.shield_outlined,
                        size: 70,
                        color: Color(0xFF38BDF8),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Recuperar contraseña',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Te enviaremos un enlace para definir una contraseña nueva.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                  ),
                  const SizedBox(height: 28),
                  TextField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    style: const TextStyle(color: Colors.white, fontSize: 15),
                    decoration: InputDecoration(
                      labelText: 'Correo electrónico',
                      labelStyle:
                          const TextStyle(color: Colors.white, fontSize: 14),
                      prefixIcon:
                          const Icon(Icons.email_outlined, color: Colors.grey),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 16),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6),
                        borderSide:
                            const BorderSide(color: Colors.white, width: 1),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6),
                        borderSide: const BorderSide(
                            color: Color(0xFF38BDF8), width: 1.5),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Si entraste solo con Google o GitHub, usa «Crear cuenta» con el mismo correo para definir una contraseña.',
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 11.5),
                  ),
                  if (_message != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: _isSuccess
                            ? Colors.green.shade900.withValues(alpha: 0.4)
                            : Colors.red.shade900.withValues(alpha: 0.4),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: _isSuccess
                              ? Colors.green.shade700
                              : Colors.red.shade700,
                        ),
                      ),
                      child: Text(
                        _message!,
                        style: TextStyle(
                          color: _isSuccess
                              ? Colors.greenAccent
                              : Colors.redAccent,
                          fontSize: 13,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ),
                    onPressed: _isLoading ? null : _handleSendResetLink,
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'Enviar enlace de recuperación',
                                style: TextStyle(
                                  fontSize: 15,
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              SizedBox(width: 8),
                              Icon(Icons.arrow_forward,
                                  size: 18, color: Colors.white),
                            ],
                          ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text(
                      'Volver al inicio de sesión',
                      style: TextStyle(
                        color: Color(0xFF38BDF8),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class MainNavigationWrapper extends StatefulWidget {
  final VoidCallback onLogout;
  final bool isOnDuty;
  final ValueChanged<bool> onToggleOnDuty;

  const MainNavigationWrapper({
    super.key,
    required this.onLogout,
    required this.isOnDuty,
    required this.onToggleOnDuty,
  });

  @override
  State<MainNavigationWrapper> createState() => _MainNavigationWrapperState();
}

class _MainNavigationWrapperState extends State<MainNavigationWrapper> {
  int _currentIndex = 0;
  List<ScanModel> _currentActiveScans = [];
  List<StringMap> _globalAuditLogs = [];
  List _inAppNotifications = [];
  final ApiClient _apiClient = ApiClient();
  Timer? _onCallPollingTimer;
  StreamSubscription<String>? _notifTapSub;
  final Set<String> _pushedAlertIds = {};

  late final IncidentRepository _incidentRepository;
  late final BypassService _bypassService;

  @override
  void initState() {
    super.initState();
    _incidentRepository = IncidentRepository(_apiClient);
    _bypassService = BypassService(Dio());
    _loadPersistentAuditLogs();
    OnCallBackgroundService.ensureStarted();
    _loadNotificationsFromApiAndPrefs(triggerSystemPush: false);

    // Polling automático cada 15s cuando el usuario está En Guardia (On-Call)
    _onCallPollingTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (widget.isOnDuty) {
        _loadNotificationsFromApiAndPrefs(triggerSystemPush: true);
      }
    });

    // Deep linking al tocar una notificación nativa del celular
    _notifTapSub = notificationTapStream.stream.listen((payload) {
      _handleNotificationPayload(payload);
    });
  }

  @override
  void dispose() {
    _onCallPollingTimer?.cancel();
    _notifTapSub?.cancel();
    super.dispose();
  }

  Future<void> _handleNotificationPayload(String payload) async {
    if (!mounted) return;
    if (payload.contains('bypass')) {
      final idMatch = RegExp(r'id=([^&]+)').firstMatch(payload);
      final bypassId = idMatch?.group(1);
      setState(() => _currentIndex = 2);
      if (bypassId != null && bypassId.isNotEmpty) {
        rootNavigatorKey.currentState?.push(
          MaterialPageRoute(
            builder: (_) => BypassDetailScreen(
              bypassId: bypassId,
              bypassService: _bypassService,
            ),
          ),
        );
      }
    } else if (payload.contains('finding')) {
      final idMatch = RegExp(r'id=([^&]+)').firstMatch(payload);
      final findingId = idMatch?.group(1);
      setState(() => _currentIndex = 0);
      if (findingId != null && findingId.isNotEmpty) {
        await _openFindingDetailFromServer(findingId);
      }
    }
  }

  Future<void> _openFindingDetailFromServer(String findingId) async {
    Map<String, dynamic>? findingData;
    try {
      final res = await _apiClient.get('/findings/$findingId');
      if (res.statusCode == 200 && res.data is Map) {
        final raw = Map<String, dynamic>.from(res.data as Map);
        findingData = raw['data'] is Map
            ? Map<String, dynamic>.from(raw['data'] as Map)
            : raw;
      }
    } catch (_) {}

    if (findingData == null) {
      try {
        final listRes = await _apiClient.get('/findings');
        if (listRes.statusCode == 200 && listRes.data != null) {
          final rawList = listRes.data is List
              ? listRes.data as List
              : (listRes.data is Map
                  ? ((listRes.data['data'] ?? listRes.data['findings'] ?? []) as List)
                  : []);
          for (final item in rawList) {
            if (item is Map && (item['id'] ?? '').toString() == findingId) {
              findingData = Map<String, dynamic>.from(item);
              break;
            }
          }
        }
      } catch (_) {}
    }

    if (!mounted) return;
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: Text(
          findingData != null
              ? (findingData['title'] ?? 'Hallazgo #$findingId').toString()
              : 'Hallazgo #$findingId',
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
        content: findingData == null
            ? const Text(
                'No se pudo recuperar el detalle actualizado del hallazgo desde el servidor.',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Severidad: ${(findingData['severity'] ?? 'N/A').toString().toUpperCase()}',
                    style: const TextStyle(
                        color: Colors.orangeAccent,
                        fontWeight: FontWeight.bold,
                        fontSize: 13),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Estado actual: ${(findingData['status'] ?? 'OPEN').toString().toUpperCase()}',
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  if ((findingData['repo'] ?? findingData['repository']) != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Repositorio: ${findingData['repo'] ?? findingData['repository']}',
                      style: const TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Text(
                    (findingData['summary'] ??
                            findingData['description'] ??
                            'Sin descripción adicional.')
                        .toString(),
                    style: const TextStyle(color: Colors.white60, fontSize: 12.5),
                  ),
                ],
              ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('Cerrar'),
          ),
        ],
      ),
    );
  }

  Future<void> _loadPersistentAuditLogs() async {
    final prefs = await SharedPreferences.getInstance();
    final savedLogsJson = prefs.getString('persistent_audit_logs');
    if (savedLogsJson != null) {
      try {
        final List decoded = jsonDecode(savedLogsJson);
        setState(() {
          _globalAuditLogs = decoded.map((e) => StringMap.from(e)).toList();
        });
      } catch (_) {}
    }
  }

  Future<void> _savePersistentAuditLogs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        'persistent_audit_logs', jsonEncode(_globalAuditLogs));
  }

  Future<void> _loadNotificationsFromApiAndPrefs({
    bool triggerSystemPush = false,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final savedNotifsJson = prefs.getString('persistent_in_app_notifs');
    List localNotifs = [];

    if (savedNotifsJson != null && savedNotifsJson.isNotEmpty) {
      try {
        final List decoded = jsonDecode(savedNotifsJson);
        localNotifs =
            decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      } catch (_) {}
    }

    try {
      final token = await ApiClient.readStoredToken();
      if (token != null && token.isNotEmpty) {
        _apiClient.setAuthToken(token);
      }

      // 1. Consultar notificaciones generales desde el backend
      dynamic responseData;
      try {
        final res = await _apiClient.get('/notifications');
        if (res.statusCode == 200 && res.data != null) {
          responseData = res.data;
        }
      } catch (_) {}

      if (responseData != null) {
        List rawList = [];
        if (responseData is List) {
          rawList = responseData;
        } else if (responseData is Map) {
          rawList = responseData['notifications'] ??
              responseData['data'] ??
              responseData['items'] ??
              [];
        }

        for (final item in rawList) {
          if (item is Map) {
            final id = (item['id'] ?? item['_id'] ?? '').toString();
            final title =
                (item['title'] ?? item['subject'] ?? 'Alerta de Seguridad')
                    .toString();
            final body =
                (item['body'] ?? item['message'] ?? item['description'] ?? '')
                    .toString();
            final type =
                (item['type'] ?? item['category'] ?? 'INFO').toString();
            final read = item['read'] == true || item['is_read'] == true;
            final dateStr =
                (item['created_at'] ?? item['date'] ?? '').toString();
            final findingId =
                (item['finding_id'] ?? item['resource_id'] ?? '').toString();
            final payload = type.toUpperCase().contains('BYPASS')
                ? '/bypass_detail?id=$findingId'
                : '/finding_detail?id=$findingId';

            if (id.isNotEmpty) {
              if (!localNotifs.any((n) => n['id'] == id)) {
                localNotifs.insert(0, {
                  'id': id,
                  'title': title,
                  'body': body,
                  'type': type,
                  'payload': payload,
                  'read': read,
                  'time': dateStr.isNotEmpty
                      ? dateStr.substring(
                          0, dateStr.length > 16 ? 16 : dateStr.length)
                      : '${DateTime.now().hour.toString().padLeft(2, '0')}:${DateTime.now().minute.toString().padLeft(2, '0')}',
                });
              }

              if (triggerSystemPush &&
                  widget.isOnDuty &&
                  !read &&
                  !_pushedAlertIds.contains(id)) {
                _pushedAlertIds.add(id);
                await NotificationService.showLocalPush(
                  id: id.hashCode.abs() % 100000,
                  title: title,
                  body: body,
                  payload: payload,
                );
              }
            }
          }
        }
      }

      // 2. Consultar solicitudes de Bypass pendientes creadas desde la Web/CI
      try {
        final bypasses = await _bypassService.getBypasses();
        for (final b in bypasses) {
          if (b is Map) {
            final bId = (b['id'] ?? '').toString();
            final bStatus = (b['status'] ?? '').toString().toUpperCase();
            final notifKey = 'bypass_$bId';
            if (bId.isNotEmpty && bStatus == 'PENDING') {
              const title = 'Solicitud de Excepción (Bypass)';
              final body =
                  '${b['rule'] ?? b['title'] ?? 'Security Gate'} en ${b['repository'] ?? b['repo'] ?? 'repositorio'}';
              final payload = '/bypass_detail?id=$bId';

              if (!localNotifs.any((n) => n['id'] == notifKey)) {
                localNotifs.insert(0, {
                  'id': notifKey,
                  'title': title,
                  'body': body,
                  'type': 'BYPASS',
                  'payload': payload,
                  'read': false,
                  'time':
                      '${DateTime.now().hour.toString().padLeft(2, '0')}:${DateTime.now().minute.toString().padLeft(2, '0')}',
                });
              }

              if (triggerSystemPush &&
                  widget.isOnDuty &&
                  !_pushedAlertIds.contains(notifKey)) {
                _pushedAlertIds.add(notifKey);
                await NotificationService.showLocalPush(
                  id: notifKey.hashCode.abs() % 100000,
                  title: title,
                  body: body,
                  payload: payload,
                );
              }
            }
          }
        }
      } catch (_) {}
    } catch (_) {}

    if (mounted) {
      setState(() {
        _inAppNotifications = localNotifs;
      });
      _savePersistentNotifications();
    }
  }

  Future<void> _savePersistentNotifications() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        'persistent_in_app_notifs', jsonEncode(_inAppNotifications));
  }

  Future<void> _addInAppNotification(
      String title, String body, String type) async {
    final newId = DateTime.now().millisecondsSinceEpoch.toString();
    final newNotif = {
      'id': newId,
      'title': title,
      'body': body,
      'type': type,
      'read': false,
      'time':
          '${DateTime.now().hour.toString().padLeft(2, '0')}:${DateTime.now().minute.toString().padLeft(2, '0')}',
    };

    setState(() {
      _inAppNotifications.insert(0, newNotif);
    });
    await _savePersistentNotifications();
  }

  Future<void> _markNotificationAsRead(int index) async {
    final notifId = _inAppNotifications[index]['id'];
    final payload = (_inAppNotifications[index]['payload'] ?? '').toString();
    setState(() {
      _inAppNotifications[index]['read'] = true;
    });
    await _savePersistentNotifications();

    try {
      final token = await ApiClient.readStoredToken();
      if (token != null && token.isNotEmpty) {
        _apiClient.setAuthToken(token);
      }
      await _apiClient
          .post('/notifications/$notifId/read', data: {'read': true});
    } catch (_) {}

    if (payload.isNotEmpty) {
      _handleNotificationPayload(payload);
    }
  }

  Future<void> _markAllNotificationsAsRead() async {
    setState(() {
      for (var n in _inAppNotifications) {
        n['read'] = true;
      }
    });
    await _savePersistentNotifications();

    try {
      final token = await ApiClient.readStoredToken();
      if (token != null && token.isNotEmpty) {
        _apiClient.setAuthToken(token);
      }
      await _apiClient.post('/notifications/read-all', data: {});
    } catch (_) {}
  }

  Future<void> _clearNotifications() async {
    setState(() {
      _inAppNotifications.clear();
    });
    await _savePersistentNotifications();
  }

  void _updateActiveScans(List<ScanModel> scans) {
    setState(() {
      _currentActiveScans = scans;
    });
  }

  void _addAuditLog(StringMap log) {
    setState(() {
      _globalAuditLogs.insert(0, log);
    });
    _savePersistentAuditLogs();
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      ScanListScreen(
        onLogout: widget.onLogout,
        isOnDuty: widget.isOnDuty,
        onScansUpdated: _updateActiveScans,
        onAuditAdded: _addAuditLog,
        onAddNotification: _addInAppNotification,
        notifications: _inAppNotifications,
        onMarkRead: _markNotificationAsRead,
        onMarkAllRead: _markAllNotificationsAsRead,
        onClearNotifs: _clearNotifications,
      ),
      PillowChatScreen(
        currentScans: _currentActiveScans,
        isOnDuty: widget.isOnDuty,
      ),
      SecurityGateBypassesScreen(
        repository: _incidentRepository,
      ),
      AuditHistoryScreen(
        auditLogs: _globalAuditLogs,
      ),
      ProfileScreen(
        onLogout: widget.onLogout,
        isOnDuty: widget.isOnDuty,
        onToggleOnDuty: widget.onToggleOnDuty,
      ),
    ];

    return Scaffold(
      body: pages[_currentIndex],
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          indicatorColor: const Color(0xFF0284C7).withValues(alpha: 0.3),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 12);
            }
            return const TextStyle(color: Colors.grey, fontSize: 12);
          }),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const IconThemeData(color: Color(0xFF38BDF8));
            }
            return const IconThemeData(color: Colors.grey);
          }),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          backgroundColor: const Color(0xFF161B22),
          onDestinationSelected: (index) =>
              setState(() => _currentIndex = index),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.security), label: 'Bandeja'),
            NavigationDestination(
                icon: Icon(Icons.smart_toy_outlined), label: 'Pillow IA'),
            NavigationDestination(icon: Icon(Icons.gavel), label: 'Bypasses'),
            NavigationDestination(
                icon: Icon(Icons.history), label: 'Historial'),
            NavigationDestination(icon: Icon(Icons.person), label: 'Perfil'),
          ],
        ),
      ),
    );
  }
}

class PillowChatScreen extends StatefulWidget {
  final List<ScanModel> currentScans;
  final bool isOnDuty;

  const PillowChatScreen({
    super.key,
    required this.currentScans,
    required this.isOnDuty,
  });

  @override
  State<PillowChatScreen> createState() => _PillowChatScreenState();
}

class _PillowChatScreenState extends State<PillowChatScreen> {
  List<StringMap> _messages = [
    {
      'role': 'assistant',
      'text':
          '¡Hola! Soy tu asistente de seguridad Pillow IA para la aplicación móvil. ¿En qué te puedo ayudar sobre los hallazgos actuales de tus repositorios?'
    }
  ];
  final TextEditingController _chatController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isThinking = false;
  final ApiClient _apiClient = ApiClient();

  @override
  void initState() {
    super.initState();
    _loadChatHistory();
  }

  @override
  void dispose() {
    _chatController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadChatHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final savedHistoryJson = prefs.getString('persistent_chat_history');
    if (savedHistoryJson != null && savedHistoryJson.isNotEmpty) {
      try {
        final dynamic decoded = jsonDecode(savedHistoryJson);
        if (decoded is List) {
          setState(() {
            _messages =
                decoded.map((e) => Map<String, String>.from(e as Map)).toList();
          });
        }
      } catch (_) {}
    }
  }

  Future<void> _saveChatHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('persistent_chat_history', jsonEncode(_messages));
  }

  Future<void> _clearChatHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('persistent_chat_history');
    setState(() {
      _messages = [
        {
          'role': 'assistant',
          'text':
              '¡Hola! Soy tu asistente de seguridad Pillow IA para la aplicación móvil. ¿En qué te puedo ayudar sobre los hallazgos actuales de tus repositorios?'
        }
      ];
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  String _sanitizeMobileResponse(String text) {
    var cleaned = text;
    cleaned = cleaned.replaceAll(
        RegExp(r'esta vista del Dashboard', caseSensitive: false),
        'la Bandeja de Hallazgos');
    cleaned = cleaned.replaceAll(RegExp(r'Dashboard', caseSensitive: false),
        'Bandeja de Hallazgos Móvil');
    cleaned = cleaned.replaceAll(
        RegExp(r'incorporar los siguientes widgets a tu panel',
            caseSensitive: false),
        'revisar el detalle de las alertas desde tu lista');
    cleaned = cleaned.replaceAll(
        RegExp(r'widgets', caseSensitive: false), 'métricas de la app');
    cleaned = cleaned.replaceAll(
        RegExp(r'panel', caseSensitive: false), 'aplicación');
    return cleaned;
  }

  Future<void> _sendMessageToAI(String prompt) async {
    final cleanPrompt = prompt.trim();
    if (cleanPrompt.isEmpty) return;

    setState(() {
      _messages.add({'role': 'user', 'text': cleanPrompt});
      _isThinking = true;
    });
    await _saveChatHistory();
    _chatController.clear();
    _scrollToBottom();

    String? serverReply;
    String? errorDetail;

    try {
      final prefs = await SharedPreferences.getInstance();
      final userEmail = prefs.getString('user_email') ?? '';
      final token = await ApiClient.readStoredToken();

      if (token != null && token.isNotEmpty) {
        _apiClient.setAuthToken(token);
      }

      final findingsPayload = widget.currentScans
          .map((scan) => {
                'id': scan.id,
                'title': scan.title,
                'status': scan.status,
                'severity': scan.severity,
                'summary': scan.summary,
                'repo': scan.repo,
                'type': scan.type,
              })
          .toList();

      final historyPayload = _messages
          .map((m) => {
                'role': m['role'] == 'assistant' ? 'assistant' : 'user',
                'content': m['text'] ?? '',
                'text': m['text'] ?? '',
              })
          .toList();

      final bodyData = {
        'message': cleanPrompt,
        'prompt': cleanPrompt,
        'user_key': userEmail,
        'page': 'mobile_app',
        'dashboard_context': {
          'app_type': 'mobile',
          'on_duty': widget.isOnDuty,
        },
        'page_context': {
          'app_type': 'mobile',
          'total_findings': widget.currentScans.length,
          'on_duty': widget.isOnDuty,
          'findings': findingsPayload,
        },
        'history': historyPayload,
      };

      final res = await _apiClient.post('/pillow/chat', data: bodyData);
      if (res.data != null) {
        final raw = res.data;
        if (raw is Map) {
          final target = (raw['data'] is Map)
              ? raw['data']
              : (raw['result'] is Map)
                  ? raw['result']
                  : raw;

          serverReply = (target['reply'] ??
                  target['content'] ??
                  target['message'] ??
                  target['response'] ??
                  target['answer'] ??
                  target['output'])
              ?.toString();
        } else if (raw is String && raw.trim().isNotEmpty) {
          serverReply = raw;
        }
      }
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      final data = e.response?.data;
      final msg = data is Map
          ? (data['detail'] ?? data['message'] ?? data['error'] ?? '')
              .toString()
          : '';
      errorDetail = status != null
          ? 'Error del servidor Pillow IA ($status)${msg.isNotEmpty ? ": $msg" : ""}.'
          : 'Sin conexión con el servicio de Pillow IA. Verifica tu red.';
    } catch (e) {
      errorDetail = 'No se pudo obtener respuesta de Pillow IA: $e';
    }

    if (serverReply != null && serverReply.trim().isNotEmpty) {
      serverReply = _sanitizeMobileResponse(serverReply);
    } else {
      serverReply = errorDetail ??
          'El servidor de Pillow IA devolvió una respuesta vacía.';
    }

    if (mounted) {
      setState(() {
        _messages.add({'role': 'assistant', 'text': serverReply!});
        _isThinking = false;
      });
      await _saveChatHistory();
      _scrollToBottom();
    }
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Asistente Pillow IA'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_comment_outlined),
            tooltip: 'Nuevo Chat / Limpiar Historial',
            onPressed: () {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  backgroundColor: const Color(0xFF161B22),
                  title: const Text('Iniciar Nuevo Chat',
                      style: TextStyle(color: Colors.white)),
                  content: const Text(
                      '¿Deseas reiniciar la conversación y limpiar el historial guardado?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cancelar'),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0284C7)),
                      onPressed: () {
                        Navigator.pop(context);
                        _clearChatHistory();
                      },
                      child: const Text('Limpiar Historial',
                          style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              );
            },
          )
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              itemBuilder: (context, i) {
                final msg = _messages[i];
                final isUser = msg['role'] == 'user';
                return Align(
                  alignment:
                      isUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 6),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isUser
                          ? const Color(0xFF0284C7)
                          : const Color(0xFF21262D),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      msg['text']!,
                      style: const TextStyle(fontSize: 14, color: Colors.white),
                    ),
                  ),
                );
              },
            ),
          ),
          if (_isThinking)
            const LinearProgressIndicator(color: Color(0xFF38BDF8)),
          Container(
            padding: const EdgeInsets.all(12),
            color: const Color(0xFF161B22),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _chatController,
                    style: const TextStyle(fontSize: 14, color: Colors.white),
                    decoration: const InputDecoration(
                      hintText: 'Escribe tu consulta a Pillow...',
                      border: OutlineInputBorder(),
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    onSubmitted: _sendMessageToAI,
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.send, color: Color(0xFF38BDF8)),
                  onPressed: () => _sendMessageToAI(_chatController.text),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ScanListScreen extends StatefulWidget {
  final VoidCallback onLogout;
  final bool isOnDuty;
  final ValueChanged<List<ScanModel>> onScansUpdated;
  final ValueChanged<StringMap> onAuditAdded;
  final Function(String title, String body, String type) onAddNotification;
  final List notifications;
  final Function(int index) onMarkRead;
  final VoidCallback onMarkAllRead;
  final VoidCallback onClearNotifs;

  const ScanListScreen({
    super.key,
    required this.onLogout,
    required this.isOnDuty,
    required this.onScansUpdated,
    required this.onAuditAdded,
    required this.onAddNotification,
    required this.notifications,
    required this.onMarkRead,
    required this.onMarkAllRead,
    required this.onClearNotifs,
  });

  @override
  State<ScanListScreen> createState() => _ScanListScreenState();
}

class _ScanListScreenState extends State<ScanListScreen> {
  List<ScanModel> _localScans = [];
  bool _sortAscending = true;
  bool _isLoading = false;

  String _selectedFilter = 'Todos';
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  final ApiClient _apiClient = ApiClient();

  @override
  void initState() {
    super.initState();
    _initScans();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _saveScansToPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonList = _localScans.map((s) => s.toJson()).toList();
    await prefs.setString('persistent_scans_list_v4', jsonEncode(jsonList));
  }

  Future<void> _initScans() async {
    setState(() => _isLoading = true);

    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString('persistent_scans_list_v4');

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = await ApiClient.readStoredToken();

      if (token != null && token.isNotEmpty) {
        _apiClient.setAuthToken(token);
      }

      dynamic responseData;
      int statusCode = 0;

      try {
        var res = await _apiClient.get('/findings');
        statusCode = res.statusCode ?? 0;
        responseData = res.data;
      } on DioException catch (e) {
        if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
          await _apiClient.clearAuthToken();
          await prefs.setBool('is_logged_in', false);
          if (mounted) {
            setState(() => _isLoading = false);
            widget.onLogout();
          }
          return;
        }
        try {
          var res = await _apiClient.get('/scans');
          statusCode = res.statusCode ?? 0;
          responseData = res.data;
        } catch (_) {}
      }

      if (statusCode == 200 && responseData != null) {
        List rawData = [];

        if (responseData is List) {
          rawData = responseData;
        } else if (responseData is Map) {
          rawData = responseData['findings'] ??
              responseData['incidents'] ??
              responseData['scans'] ??
              responseData['repositories'] ??
              responseData['data'] ??
              responseData['repos'] ??
              [];
        }

        if (rawData.isEmpty) {
          try {
            var repoRes = await _apiClient.get('/repositories');
            if (repoRes.statusCode == 200 && repoRes.data is List) {
              rawData = repoRes.data as List;
            }
          } catch (_) {}
        }

        if (rawData.isNotEmpty) {
          _localScans = rawData
              .map(
                  (item) => ScanModel.fromJson(Map<String, dynamic>.from(item)))
              .toList();

          await _saveScansToPrefs();
          _applySorting();
          widget.onScansUpdated(_localScans);
          if (mounted) setState(() => _isLoading = false);
          return;
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('--- ERROR AL CONSULTAR BACKEND FINDINGS ---');
        debugPrint(e.toString());
        debugPrint('-------------------------------------------');
      }
    }

    if (jsonStr != null) {
      try {
        final List decoded = jsonDecode(jsonStr);
        _localScans = decoded
            .map((item) => ScanModel.fromJson(Map<String, dynamic>.from(item)))
            .toList();
      } catch (_) {
        _localScans = [];
      }
    } else {
      _localScans = [];
    }

    _applySorting();
    widget.onScansUpdated(_localScans);
    if (mounted) setState(() => _isLoading = false);
  }

  void _applySorting() {
    _localScans.sort((a, b) {
      final nameA = (a.title ?? '').toLowerCase();
      final nameB = (b.title ?? '').toLowerCase();
      return _sortAscending ? nameA.compareTo(nameB) : nameB.compareTo(nameA);
    });
  }

  void _showNotificationCenter(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF161B22),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (modalContext) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final unreadCount =
                widget.notifications.where((n) => n['read'] == false).length;

            return Container(
              height: MediaQuery.of(context).size.height * 0.65,
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.notifications_active,
                              color: Color(0xFF38BDF8)),
                          const SizedBox(width: 8),
                          const Text(
                            'Centro de Notificaciones',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          if (unreadCount > 0) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.redAccent,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                '$unreadCount',
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold),
                              ),
                            ),
                          ]
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.grey),
                        onPressed: () => Navigator.pop(modalContext),
                      ),
                    ],
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      TextButton.icon(
                        icon: const Icon(Icons.done_all,
                            size: 16, color: Color(0xFF38BDF8)),
                        label: const Text('Marcar todas leídas',
                            style: TextStyle(
                                color: Color(0xFF38BDF8), fontSize: 12)),
                        onPressed: () {
                          widget.onMarkAllRead();
                          setModalState(() {});
                          setState(() {});
                        },
                      ),
                      TextButton.icon(
                        icon: const Icon(Icons.delete_sweep,
                            size: 16, color: Colors.grey),
                        label: const Text('Limpiar',
                            style: TextStyle(color: Colors.grey, fontSize: 12)),
                        onPressed: () {
                          widget.onClearNotifs();
                          setModalState(() {});
                          setState(() {});
                        },
                      ),
                    ],
                  ),
                  const Divider(color: Color(0xFF30363D)),
                  Expanded(
                    child: widget.notifications.isEmpty
                        ? const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.notifications_off_outlined,
                                    size: 50, color: Colors.grey),
                                SizedBox(height: 8),
                                Text('Sin notificaciones recientes',
                                    style: TextStyle(color: Colors.grey)),
                              ],
                            ),
                          )
                        : ListView.builder(
                            itemCount: widget.notifications.length,
                            itemBuilder: (context, index) {
                              final notif = widget.notifications[index];
                              final isRead = notif['read'] == true;

                              return Card(
                                color: isRead
                                    ? const Color(0xFF0D1117)
                                    : const Color(0xFF21262D),
                                margin: const EdgeInsets.only(bottom: 8),
                                child: ListTile(
                                  onTap: () {
                                    Navigator.pop(modalContext);
                                    widget.onMarkRead(index);
                                  },
                                  leading: CircleAvatar(
                                    radius: 16,
                                    backgroundColor: notif['type'] == 'BLOCK'
                                        ? Colors.red.shade900
                                        : Colors.amber.shade900,
                                    child: Icon(
                                      notif['type'] == 'BLOCK'
                                          ? Icons.block
                                          : Icons.shield,
                                      size: 16,
                                      color: Colors.white,
                                    ),
                                  ),
                                  title: Text(
                                    notif['title'] ?? 'Alerta',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 14,
                                      fontWeight: isRead
                                          ? FontWeight.normal
                                          : FontWeight.bold,
                                    ),
                                  ),
                                  subtitle: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        notif['body'] ?? '',
                                        style: const TextStyle(
                                            color: Colors.grey, fontSize: 12),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        notif['time'] ?? '',
                                        style: const TextStyle(
                                            color: Color(0xFF38BDF8),
                                            fontSize: 10),
                                      ),
                                    ],
                                  ),
                                  trailing: isRead
                                      ? null
                                      : IconButton(
                                          icon: const Icon(Icons.check_circle,
                                              color: Color(0xFF38BDF8),
                                              size: 20),
                                          tooltip: 'Marcar como leída',
                                          onPressed: () {
                                            widget.onMarkRead(index);
                                            setModalState(() {});
                                            setState(() {});
                                          },
                                        ),
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showDetailModal(BuildContext context, ScanModel scan) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF161B22),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (bottomSheetContext) {
        final justificationController = TextEditingController();
        final reasonController = TextEditingController();
        int selectedHours = 24;

        final bool isAlreadyProcessed =
            scan.status == 'EXEMPTED' || scan.status == 'BLOCKED';

        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom + 16,
                top: 24,
                left: 20,
                right: 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(scan.title ?? 'Sintetización del Hallazgo',
                            style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.white)),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.grey),
                        onPressed: () => Navigator.pop(bottomSheetContext),
                      ),
                    ],
                  ),
                  const Divider(color: Color(0xFF30363D)),
                  const SizedBox(height: 8),
                  const Text('Resumen Pillow:',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF38BDF8))),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0D1117),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFF30363D)),
                    ),
                    child: Text(
                      scan.summary ??
                          'Análisis detectó vulnerabilidades que requieren revisión HITL.',
                      style:
                          const TextStyle(fontSize: 13, color: Colors.white70),
                    ),
                  ),
                  const SizedBox(height: 20),
                  if (!widget.isOnDuty)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade900.withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.amber.shade700),
                      ),
                      child: const Text(
                        'Modo Lectura (Fuera de Guardia): No tienes permiso para aprobar ni bloquear excepciones.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.amber, fontSize: 12),
                      ),
                    ),
                  if (isAlreadyProcessed)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF21262D),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Estado actual: ${scan.status == "EXEMPTED" ? "Excepción Lanzada" : "Despliegue Bloqueado"}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            color: Colors.amber, fontWeight: FontWeight.bold),
                      ),
                    )
                  else
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: widget.isOnDuty
                                  ? Colors.amber.shade800
                                  : Colors.grey.shade800,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            icon: const Icon(Icons.fingerprint,
                                color: Colors.white),
                            label: const Text('Excepción',
                                style: TextStyle(color: Colors.white)),
                            onPressed: !widget.isOnDuty
                                ? null
                                : () {
                                    String? inlineError;
                                    showDialog(
                                      context: context,
                                      builder: (dialogContext) =>
                                          StatefulBuilder(
                                        builder: (context, setDialogState) {
                                          return AlertDialog(
                                            backgroundColor:
                                                const Color(0xFF161B22),
                                            title: const Text(
                                                'Aprobar Excepción Temporizada',
                                                style: TextStyle(
                                                    color: Colors.white)),
                                            content: Column(
                                              mainAxisSize: MainAxisSize.min,
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                const Text(
                                                  '¿Autorizar el pase a producción con esta vulnerabilidad activa? Se solicitará huella o rostro.',
                                                  style: TextStyle(
                                                      fontSize: 13,
                                                      color: Colors.grey),
                                                ),
                                                const SizedBox(height: 12),
                                                DropdownButtonFormField<int>(
                                                  initialValue: selectedHours,
                                                  dropdownColor:
                                                      const Color(0xFF161B22),
                                                  decoration:
                                                      const InputDecoration(
                                                    labelText:
                                                        'Duración de la excepción',
                                                    border:
                                                        OutlineInputBorder(),
                                                  ),
                                                  items: const [
                                                    DropdownMenuItem(
                                                        value: 24,
                                                        child:
                                                            Text('24 Horas')),
                                                    DropdownMenuItem(
                                                        value: 72,
                                                        child:
                                                            Text('72 Horas')),
                                                    DropdownMenuItem(
                                                        value: 168,
                                                        child: Text(
                                                            '168 Horas (1 Semana)')),
                                                  ],
                                                  onChanged: (val) =>
                                                      selectedHours = val ?? 24,
                                                ),
                                                const SizedBox(height: 12),
                                                TextField(
                                                  controller:
                                                      justificationController,
                                                  maxLines: 2,
                                                  decoration: InputDecoration(
                                                    border:
                                                        const OutlineInputBorder(),
                                                    hintText:
                                                        'Justificación (mínimo 10 caracteres)',
                                                    errorText: inlineError,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            actions: [
                                              TextButton(
                                                  onPressed: () =>
                                                      Navigator.pop(
                                                          dialogContext),
                                                  child:
                                                      const Text('Cancelar')),
                                              ElevatedButton(
                                                onPressed: () async {
                                                  final justificationText =
                                                      justificationController
                                                          .text
                                                          .trim();
                                                  if (justificationText
                                                          .length >=
                                                      10) {
                                                    final verified =
                                                        await BiometricGuard
                                                            .verifyIdentity(
                                                      reason:
                                                          'Confirma con huella o rostro para lanzar la excepción',
                                                    );
                                                    if (!verified) {
                                                      setDialogState(() {
                                                        inlineError =
                                                            'Firma biométrica requerida para autorizar.';
                                                      });
                                                      return;
                                                    }

                                                    if (!dialogContext
                                                            .mounted ||
                                                        !bottomSheetContext
                                                            .mounted) {
                                                      return;
                                                    }
                                                    Navigator.pop(
                                                        dialogContext);
                                                    Navigator.pop(
                                                        bottomSheetContext);

                                                    try {
                                                          await SharedPreferences
                                                              .getInstance();
                                                      final token =
                                                          await ApiClient.readStoredToken();

                                                      if (token != null &&
                                                          token.isNotEmpty) {
                                                        _apiClient.setAuthToken(
                                                            token);
                                                      }

                                                      await _apiClient.patch(
                                                          '/findings/${scan.id}',
                                                          data: {
                                                            'status':
                                                                'EXEMPTED',
                                                            'duration_hours':
                                                                selectedHours,
                                                            'justification':
                                                                justificationText,
                                                          });

                                                      try {
                                                        await _apiClient.post(
                                                            '/security-gates/bypasses',
                                                            data: {
                                                              'finding_id':
                                                                  scan.id,
                                                              'duration_hours':
                                                                  selectedHours,
                                                              'justification':
                                                                  justificationText,
                                                            });
                                                      } catch (_) {}
                                                    } catch (_) {}

                                                    await NotificationService
                                                        .showLocalPush(
                                                      id: DateTime.now()
                                                              .millisecondsSinceEpoch ~/
                                                          1000,
                                                      title:
                                                          'Excepción Lanzada',
                                                      body:
                                                          'Se aprobó la excepción para "${scan.title}" por $selectedHours Horas.',
                                                      payload:
                                                          '/finding_detail?id=${scan.id}',
                                                    );

                                                    widget.onAddNotification(
                                                      'Excepción Lanzada',
                                                      'Se aprobó la excepción para "${scan.title}" por $selectedHours Horas.',
                                                      'EXEMPTION',
                                                    );

                                                    setState(() {
                                                      final idx = _localScans
                                                          .indexWhere((s) =>
                                                              s.id == scan.id);
                                                      if (idx != -1) {
                                                        _localScans[idx] =
                                                            ScanModel(
                                                          id: scan.id,
                                                          title: scan.title,
                                                          status: 'EXEMPTED',
                                                          severity:
                                                              scan.severity,
                                                          summary: scan.summary,
                                                          repo: scan.repo,
                                                          type: scan.type,
                                                          createdAt:
                                                              scan.createdAt,
                                                        );
                                                      }
                                                    });
                                                    await _saveScansToPrefs();
                                                    widget.onScansUpdated(
                                                        _localScans);

                                                    widget.onAuditAdded({
                                                      'id': scan.id,
                                                      'type': 'EXEMPTION',
                                                      'title':
                                                          'Excepción Lanzada',
                                                      'subtitle':
                                                          '${scan.title ?? 'Repo'} - "$justificationText"',
                                                      'time':
                                                          'Quedan $selectedHours h',
                                                      'duration':
                                                          '$selectedHours Horas',
                                                    });
                                                  } else {
                                                    setDialogState(() {
                                                      inlineError =
                                                          'La justificación debe tener al menos 10 caracteres.';
                                                    });
                                                  }
                                                },
                                                child: const Text('Confirmar'),
                                              ),
                                            ],
                                          );
                                        },
                                      ),
                                    );
                                  },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: widget.isOnDuty
                                  ? Colors.red.shade700
                                  : Colors.grey.shade800,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            icon: const Icon(Icons.fingerprint,
                                color: Colors.white),
                            label: const Text('Bloquear',
                                style: TextStyle(color: Colors.white)),
                            onPressed: !widget.isOnDuty
                                ? null
                                : () {
                                    String? inlineError;
                                    showDialog(
                                      context: context,
                                      builder: (dialogContext) =>
                                          StatefulBuilder(
                                        builder: (context, setDialogState) {
                                          return AlertDialog(
                                            backgroundColor:
                                                const Color(0xFF161B22),
                                            title: const Text(
                                                'Confirmar Bloqueo de Despliegue',
                                                style: TextStyle(
                                                    color: Colors.white)),
                                            content: TextField(
                                              controller: reasonController,
                                              decoration: InputDecoration(
                                                border:
                                                    const OutlineInputBorder(),
                                                hintText:
                                                    'Motivo del bloqueo (mínimo 3 caracteres)',
                                                errorText: inlineError,
                                              ),
                                            ),
                                            actions: [
                                              TextButton(
                                                  onPressed: () =>
                                                      Navigator.pop(
                                                          dialogContext),
                                                  child:
                                                      const Text('Cancelar')),
                                              ElevatedButton(
                                                style: ElevatedButton.styleFrom(
                                                    backgroundColor:
                                                        Colors.red),
                                                onPressed: () async {
                                                  final reasonText =
                                                      reasonController.text
                                                          .trim();
                                                  if (reasonText.length >= 3) {
                                                    final verified =
                                                        await BiometricGuard
                                                            .verifyIdentity(
                                                      reason:
                                                          'Confirma con huella o rostro para BLOQUEAR este despliegue',
                                                    );
                                                    if (!verified) {
                                                      setDialogState(() {
                                                        inlineError =
                                                            'Firma biométrica requerida para bloquear.';
                                                      });
                                                      return;
                                                    }

                                                    if (!dialogContext
                                                            .mounted ||
                                                        !bottomSheetContext
                                                            .mounted) {
                                                      return;
                                                    }
                                                    Navigator.pop(
                                                        dialogContext);
                                                    Navigator.pop(
                                                        bottomSheetContext);

                                                    try {
                                                          await SharedPreferences
                                                              .getInstance();
                                                      final token =
                                                          await ApiClient.readStoredToken();

                                                      if (token != null &&
                                                          token.isNotEmpty) {
                                                        _apiClient.setAuthToken(
                                                            token);
                                                      }

                                                      await _apiClient.patch(
                                                          '/findings/${scan.id}',
                                                          data: {
                                                            'status': 'BLOCKED',
                                                            'reason':
                                                                reasonText,
                                                          });
                                                    } catch (_) {}

                                                    await NotificationService
                                                        .showLocalPush(
                                                      id: DateTime.now()
                                                              .millisecondsSinceEpoch ~/
                                                          1000,
                                                      title: 'Bloqueo Aplicado',
                                                      body:
                                                          'Se bloqueó el despliegue para "${scan.title}". Motivo: $reasonText',
                                                      payload:
                                                          '/finding_detail?id=${scan.id}',
                                                    );

                                                    widget.onAddNotification(
                                                      'Bloqueo Aplicado',
                                                      'Se bloqueó el despliegue para "${scan.title}". Motivo: $reasonText',
                                                      'BLOCK',
                                                    );

                                                    setState(() {
                                                      final idx = _localScans
                                                          .indexWhere((s) =>
                                                              s.id == scan.id);
                                                      if (idx != -1) {
                                                        _localScans[idx] =
                                                            ScanModel(
                                                          id: scan.id,
                                                          title: scan.title,
                                                          status: 'BLOCKED',
                                                          severity:
                                                              scan.severity,
                                                          summary: scan.summary,
                                                          repo: scan.repo,
                                                          type: scan.type,
                                                          createdAt:
                                                              scan.createdAt,
                                                        );
                                                      }
                                                    });
                                                    await _saveScansToPrefs();
                                                    widget.onScansUpdated(
                                                        _localScans);

                                                    widget.onAuditAdded({
                                                      'id': scan.id,
                                                      'type': 'BLOCK',
                                                      'title':
                                                          'Bloqueo de Despliegue',
                                                      'subtitle':
                                                          '${scan.title ?? 'Repo'} - "$reasonText"',
                                                      'time': 'Bloqueado',
                                                      'duration': 'Permanente',
                                                    });
                                                  } else {
                                                    setDialogState(() {
                                                      inlineError =
                                                          'El motivo debe tener al menos 3 caracteres.';
                                                    });
                                                  }
                                                },
                                                child: const Text('Bloquear',
                                                    style: TextStyle(
                                                        color: Colors.white)),
                                              ),
                                            ],
                                          );
                                        },
                                      ),
                                    );
                                  },
                          ),
                        ),
                      ],
                    ),
                  const SizedBox(height: 12),
                ],
              ),
            );
          },
        );
      },
    );
  }

  String _formatDate(DateTime dt) {
    final day = dt.day.toString().padLeft(2, '0');
    final month = dt.month.toString().padLeft(2, '0');
    final year = dt.year;
    return '$day/$month/$year';
  }

  @override
  Widget build(BuildContext context) {
    var scans = List<ScanModel>.from(_localScans);

    if (_searchQuery.isNotEmpty) {
      scans = scans
          .where((s) =>
              (s.title ?? '').toLowerCase().contains(_searchQuery) ||
              (s.summary ?? '').toLowerCase().contains(_searchQuery) ||
              s.id.contains(_searchQuery))
          .toList();
    }

    if (_selectedFilter != 'Todos') {
      scans = scans.where((s) {
        final status = s.status.toUpperCase();
        final severity = (s.severity ?? '').toUpperCase();

        if (_selectedFilter == 'Crítico') {
          return severity == 'CRITICAL';
        }
        if (_selectedFilter == 'Alto') {
          return severity == 'HIGH';
        }
        if (_selectedFilter == 'Bloqueado') {
          return status == 'BLOCKED' || status == 'BLOQUEADO';
        }
        if (_selectedFilter == 'Abierto') {
          return status == 'OPEN' || status == 'ABIERTO';
        }

        return true;
      }).toList();
    }

    final unreadCount =
        widget.notifications.where((n) => n['read'] == false).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bandeja de Hallazgos'),
        actions: [
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined),
                tooltip: 'Centro de Notificaciones',
                onPressed: () => _showNotificationCenter(context),
              ),
              if (unreadCount > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: Colors.redAccent,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 16,
                      minHeight: 16,
                    ),
                    child: Text(
                      '$unreadCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Recargar Bandeja',
            onPressed: () => _initScans(),
          ),
          IconButton(
            icon: Icon(_sortAscending ? Icons.sort_by_alpha : Icons.sort),
            tooltip: 'Ordenar A-Z / Z-A',
            onPressed: () {
              setState(() {
                _sortAscending = !_sortAscending;
                _applySorting();
              });
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12.0),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Buscar por repo, CWE, id...',
                prefixIcon: const Icon(Icons.search, size: 20),
                contentPadding:
                    const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                filled: true,
                fillColor: const Color(0xFF161B22),
              ),
              onChanged: (val) =>
                  setState(() => _searchQuery = val.toLowerCase()),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: ['Todos', 'Crítico', 'Alto', 'Abierto', 'Bloqueado']
                  .map((filter) {
                final isSelected = _selectedFilter == filter;
                return Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: FilterChip(
                    label: Text(filter,
                        style: TextStyle(
                            color: isSelected ? Colors.white : Colors.grey)),
                    selected: isSelected,
                    selectedColor: const Color(0xFF0284C7),
                    backgroundColor: const Color(0xFF161B22),
                    onSelected: (selected) =>
                        setState(() => _selectedFilter = filter),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
                : scans.isEmpty
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.inbox_outlined,
                                  size: 80, color: Colors.grey),
                              SizedBox(height: 16),
                              Text(
                                'Sin hallazgos pendientes',
                                style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white),
                              ),
                              SizedBox(height: 8),
                              Text(
                                'Tus repositorios vinculados se sincronizarán aquí automáticamente.',
                                textAlign: TextAlign.center,
                                style:
                                    TextStyle(color: Colors.grey, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView.builder(
                        itemCount: scans.length,
                        padding: const EdgeInsets.all(12),
                        itemBuilder: (context, index) {
                          final scan = scans[index];
                          return Card(
                            elevation: 2,
                            color: const Color(0xFF161B22),
                            margin: const EdgeInsets.only(bottom: 12),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: scan.status == 'EXEMPTED'
                                    ? Colors.amber.shade800
                                    : scan.status == 'BLOCKED'
                                        ? Colors.red.shade800
                                        : Colors.green.shade700,
                                child: Icon(
                                  scan.status == 'EXEMPTED'
                                      ? Icons.shield_outlined
                                      : scan.status == 'BLOCKED'
                                          ? Icons.block
                                          : Icons.security,
                                  color: Colors.white,
                                ),
                              ),
                              title: Text(
                                  scan.title ?? 'Repositorio #${scan.id}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white)),
                              subtitle: Text(
                                'Estado: ${scan.status} - Fecha: ${_formatDate(scan.createdAt)}',
                                style: const TextStyle(
                                    color: Colors.grey, fontSize: 12),
                              ),
                              trailing: const Icon(Icons.chevron_right,
                                  color: Colors.grey),
                              onTap: () => _showDetailModal(context, scan),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

class AuditHistoryScreen extends StatefulWidget {
  final List<StringMap> auditLogs;

  const AuditHistoryScreen({super.key, required this.auditLogs});

  @override
  State<AuditHistoryScreen> createState() => _AuditHistoryScreenState();
}

class _AuditHistoryScreenState extends State<AuditHistoryScreen> {
  void _showLogDetail(BuildContext context, StringMap log) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF161B22),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              log['title'] ?? 'Detalle de Auditoría',
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white),
            ),
            const Divider(color: Color(0xFF303030)),
            const SizedBox(height: 8),
            Text('Detalle: ${log['subtitle']}',
                style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 8),
            Text('Estado: ${log['time']}',
                style: const TextStyle(color: Colors.amber)),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cerrar'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Historial de Auditoría')),
      body: widget.auditLogs.isEmpty
          ? const Center(
              child: Text(
                'Historial de auditoría vacío',
                style: TextStyle(color: Colors.grey),
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: widget.auditLogs.length,
              itemBuilder: (context, index) {
                final log = widget.auditLogs[index];
                return Card(
                  color: const Color(0xFF161B22),
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: Icon(
                      log['type'] == 'EXEMPTION'
                          ? Icons.shield
                          : log['type'] == 'BLOCK'
                              ? Icons.block
                              : Icons.history_edu,
                      color: log['type'] == 'EXEMPTION'
                          ? Colors.amber
                          : log['type'] == 'BLOCK'
                              ? Colors.red
                              : Colors.grey,
                    ),
                    title: Text(log['title']!,
                        style: const TextStyle(color: Colors.white)),
                    subtitle: Text(log['subtitle']!,
                        style:
                            const TextStyle(color: Colors.grey, fontSize: 12)),
                    trailing: Text(log['time']!,
                        style:
                            const TextStyle(fontSize: 11, color: Colors.amber)),
                    onTap: () => _showLogDetail(context, log),
                  ),
                );
              },
            ),
    );
  }
}

class ProfileScreen extends StatefulWidget {
  final VoidCallback onLogout;
  final bool isOnDuty;
  final ValueChanged<bool> onToggleOnDuty;

  const ProfileScreen({
    super.key,
    required this.onLogout,
    required this.isOnDuty,
    required this.onToggleOnDuty,
  });

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final ApiClient _apiClient = ApiClient();
  bool _isLoadingProfiles = true;
  String _activeUserEmail = '';
  String _activeUserName = '';
  List _availableProfiles = [];

  @override
  void initState() {
    super.initState();
    _fetchUsersAndProfiles();
  }

  Future<void> _fetchUsersAndProfiles() async {
    final prefs = await SharedPreferences.getInstance();
    final token = await ApiClient.readStoredToken();

    String activeEmail = prefs.getString('user_email') ?? '';
    String primaryEmail = prefs.getString('primary_user_email') ?? activeEmail;
    String primaryName = prefs.getString('primary_user_name') ??
        (primaryEmail.isNotEmpty && primaryEmail.contains('@')
            ? primaryEmail.split('@').first
            : 'Usuario');

    if (prefs.getString('primary_user_email') == null &&
        activeEmail.isNotEmpty) {
      await prefs.setString('primary_user_email', activeEmail);
      await prefs.setString('primary_user_name', primaryName);
    }

    if (token != null && token.isNotEmpty) {
      _apiClient.setAuthToken(token);
    }

    final List fetchedList = [];

    if (primaryEmail.isNotEmpty) {
      fetchedList.add({
        'name': primaryName,
        'email': primaryEmail,
        'role': 'Propietario',
      });
    }

    try {
      dynamic resData;
      try {
        var res = await _apiClient.get('/workspaces');
        if (res.statusCode == 200 && res.data != null) {
          resData = res.data;
        }
      } catch (_) {}

      if (resData is Map) {
        final members = resData['members'];
        if (members is List) {
          for (var item in members) {
            if (item is Map) {
              final email =
                  (item['email'] ?? item['user_email'] ?? '').toString().trim();
              final rawName = (item['name'] ?? '').toString().trim();
              final name = rawName.isNotEmpty
                  ? rawName
                  : (email.isNotEmpty ? email.split('@').first : 'Miembro');
              final role =
                  (item['role_label'] ?? item['role'] ?? 'Miembro').toString();

              if (email.isNotEmpty) {
                final existingIdx = fetchedList.indexWhere((p) =>
                    p['email'].toString().toLowerCase() == email.toLowerCase());
                if (existingIdx != -1) {
                  fetchedList[existingIdx] = {
                    'name': name,
                    'email': email,
                    'role': role,
                  };
                } else {
                  fetchedList.add({
                    'name': name,
                    'email': email,
                    'role': role,
                  });
                }
              }
            }
          }
        }

        final invitations = resData['invitations'];
        if (invitations is List) {
          for (var inv in invitations) {
            if (inv is Map) {
              final email = (inv['email'] ?? '').toString().trim();
              final role =
                  (inv['role_label'] ?? inv['role'] ?? 'Miembro').toString();
              if (email.isNotEmpty &&
                  !fetchedList.any((p) =>
                      p['email'].toString().toLowerCase() ==
                      email.toLowerCase())) {
                fetchedList.add({
                  'name': email.split('@').first,
                  'email': email,
                  'role': '$role (Pendiente)',
                });
              }
            }
          }
        }
      }
    } catch (_) {}

    if (mounted) {
      setState(() {
        _availableProfiles = fetchedList;
        _activeUserEmail = activeEmail.isNotEmpty ? activeEmail : primaryEmail;
        _activeUserName = prefs.getString('user_name') ??
            (activeEmail.isNotEmpty
                ? activeEmail.split('@').first
                : primaryName);
        _isLoadingProfiles = false;
      });
    }
  }

  Future<void> _switchProfile(Map<String, dynamic> profile) async {
    final prefs = await SharedPreferences.getInstance();
    final targetEmail = profile['email'].toString().trim();
    final primaryEmail = (prefs.getString('primary_user_email') ?? '').trim();

    if (primaryEmail.isNotEmpty && targetEmail.toLowerCase() != primaryEmail.toLowerCase()) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Para operar como $targetEmail debes iniciar sesión con sus credenciales.'),
          backgroundColor: Colors.orange,
          action: SnackBarAction(
            label: 'Cambiar cuenta',
            textColor: Colors.white,
            onPressed: () => widget.onLogout(),
          ),
        ),
      );
      return;
    }
  }

  Future<void> _handleDeleteAccountRequest() async {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: const Text('Eliminación de cuenta',
            style: TextStyle(color: Colors.white)),
        content: Text(
          'La eliminación definitiva de la cuenta ($_activeUserEmail) no está habilitada directamente desde la app móvil.\n\nPara tramitar la baja real de tu cuenta y datos asociados, gestiónalo desde el portal web de SSPILLOWY o solicita la baja al administrador de tu organización.',
          style: const TextStyle(color: Colors.white70, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cerrar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0EA5E9)),
            onPressed: () {
              Navigator.pop(dialogContext);
              _openWebUrl('https://sspillowy.com');
            },
            child: const Text('Abrir portal web',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _openWebUrl(String url) async {
    final uri = Uri.parse(url);
    try {
      bool launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
    } catch (_) {
      try {
        await launchUrl(uri, mode: LaunchMode.inAppWebView);
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentProfileObj = _availableProfiles.firstWhere(
      (p) =>
          p['email'].toString().toLowerCase() == _activeUserEmail.toLowerCase(),
      orElse: () => {'role': 'Propietario'},
    );
    final bool isReadOnly = (currentProfileObj['role'] ?? '')
        .toString()
        .toLowerCase()
        .contains('lectura');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Perfil & Configuración'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Sincronizar perfiles del Hub',
            onPressed: () {
              setState(() => _isLoadingProfiles = true);
              _fetchUsersAndProfiles();
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const ClampingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Column(
                  children: [
                    const CircleAvatar(
                      radius: 36,
                      backgroundColor: Color(0xFF0284C7),
                      child: Icon(Icons.person, size: 40, color: Colors.white),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _activeUserName.isNotEmpty
                          ? _activeUserName
                          : 'Cargando...',
                      style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white),
                    ),
                    Text(
                      _activeUserEmail,
                      style: const TextStyle(fontSize: 13, color: Colors.grey),
                    ),
                    if (isReadOnly)
                      Container(
                        margin: const EdgeInsets.only(top: 8),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.amber.shade900.withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.amber.shade700),
                        ),
                        child: const Text(
                          'Modo Solo Lectura',
                          style: TextStyle(
                              color: Colors.amber,
                              fontSize: 11,
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Perfiles / Cuentas Vinculadas Hub',
                style: TextStyle(
                  color: Color(0xFF38BDF8),
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              _isLoadingProfiles
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(16.0),
                        child:
                            CircularProgressIndicator(color: Color(0xFF38BDF8)),
                      ),
                    )
                  : Card(
                      color: const Color(0xFF161B22),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                        child: Column(
                          children: _availableProfiles.map((profile) {
                            final isCurrent =
                                profile['email'].toString().toLowerCase() ==
                                    _activeUserEmail.toLowerCase();
                            return ListTile(
                              leading: CircleAvatar(
                                radius: 16,
                                backgroundColor: isCurrent
                                    ? const Color(0xFF0284C7)
                                    : const Color(0xFF21262D),
                                child: Icon(
                                  isCurrent
                                      ? Icons.check
                                      : Icons.person_outline,
                                  size: 16,
                                  color: Colors.white,
                                ),
                              ),
                              title: Text(
                                profile['name'].toString(),
                                style: TextStyle(
                                  color: isCurrent
                                      ? Colors.white
                                      : Colors.grey.shade300,
                                  fontWeight: isCurrent
                                      ? FontWeight.bold
                                      : FontWeight.normal,
                                ),
                              ),
                              subtitle: Text(
                                '${profile['email']} • ${profile['role']}',
                                style: const TextStyle(
                                    fontSize: 11, color: Colors.grey),
                              ),
                              trailing: isCurrent
                                  ? const Chip(
                                      label: Text('Activo',
                                          style: TextStyle(
                                              fontSize: 10,
                                              color: Colors.white)),
                                      backgroundColor: Color(0xFF0284C7),
                                      padding: EdgeInsets.zero,
                                    )
                                  : OutlinedButton(
                                      style: OutlinedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 8),
                                        side: const BorderSide(
                                            color: Color(0xFF38BDF8)),
                                      ),
                                      onPressed: () => _switchProfile(profile),
                                      child: const Text(
                                        'Cambiar',
                                        style: TextStyle(
                                            fontSize: 11,
                                            color: Color(0xFF38BDF8)),
                                      ),
                                    ),
                            );
                          }).toList(),
                        ),
                      ),
                    ),
              const SizedBox(height: 16),
              Card(
                color: const Color(0xFF161B22),
                child: SwitchListTile(
                  title: const Text('Estado de Guardia (On-Call)',
                      style: TextStyle(color: Colors.white)),
                  subtitle: Text(isReadOnly
                      ? 'Deshabilitado (Cuenta en solo lectura)'
                      : (widget.isOnDuty
                          ? 'Activo (Aprobaciones permitidas)'
                          : 'Inactivo')),
                  value: isReadOnly ? false : widget.isOnDuty,
                  onChanged: isReadOnly ? null : widget.onToggleOnDuty,
                ),
              ),
              const SizedBox(height: 8),
              Card(
                color: const Color(0xFF161B22),
                child: ListTile(
                  leading: const Icon(Icons.description_outlined,
                      color: Color(0xFF38BDF8)),
                  title: const Text('Términos y Condiciones',
                      style: TextStyle(color: Colors.white)),
                  onTap: () => _openWebUrl('https://sspillowy.com/terminos'),
                ),
              ),
              if (!isReadOnly) ...[
                const SizedBox(height: 8),
                Card(
                  color: const Color(0xFF161B22),
                  child: ListTile(
                    leading:
                        const Icon(Icons.delete_forever, color: Colors.red),
                    title: const Text('Solicitud de eliminación de cuenta',
                        style: TextStyle(color: Colors.red)),
                    onTap: _handleDeleteAccountRequest,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade800,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  icon: const Icon(Icons.logout, color: Colors.white),
                  label: const Text('Cerrar Sesión',
                      style: TextStyle(
                          color: Colors.white, fontWeight: FontWeight.bold)),
                  onPressed: widget.onLogout,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}












