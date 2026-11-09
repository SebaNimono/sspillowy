import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package0:url_launcher/url_launcher.dart';
import '../repositories/auth_repository.dart';
import '../services/api_client.dart';
import 'forgot_password_screen.dart';

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
  String? _deletionNoticeMessage;
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  late final AuthRepository _authRepository;

  @override
  void initState() {
    super.initState();
    _authRepository = AuthRepository(ApiClient());
    _loadSavedEmailAndStatus();
  }

  Future<void> _loadSavedEmailAndStatus() async {
    final prefs = await SharedPreferences.getInstance();
    final savedEmail = prefs.getString('user_email');
    final pendingDeletion = prefs.getBool('pending_account_deletion') ?? false;

    if (savedEmail != null && savedEmail.isNotEmpty) {
      setState(() {
        _emailController.text = savedEmail;
      });
    }

    if (pendingDeletion) {
      setState(() {
        _deletionNoticeMessage =
            'Se ha registrado una solicitud de eliminación para tu cuenta. Revisa tu correo o vuelve a iniciar sesión dentro del período de gracia para cancelar el proceso.';
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

  Future<void> _handleOAuthLogin(String provider) async {
    final oauthUrl = 'https://sspillowy.com/api/v1/auth/$provider';
    await _openWebUrl(oauthUrl);
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
        final prefs = await SharedPreferences.getInstance();
        final werePending = prefs.getBool('pending_account_deletion') ?? false;

        await prefs.remove('pending_account_deletion');

        if (!mounted) return;
        ScaffoldMessenger.of(context).clearSnackBars();

        if (werePending) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                '¡Tu cuenta ha sido restablecida exitosamente y la solicitud de eliminación fue cancelada!',
              ),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 4),
            ),
          );
        }

        widget.onLoginSuccess();
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
                  if (_deletionNoticeMessage != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade900.withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.amber.shade700),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.info_outline,
                              color: Colors.amber, size: 22),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _deletionNoticeMessage!,
                              style: const TextStyle(
                                  color: Colors.amberAccent, fontSize: 12.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
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
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                      'Usa el inicio de sesión o accede directamente con redes sociales.'),
                                ),
                              );
                            },
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
                  const SizedBox(height: 24),
                  Row(
                    children: const [
                      Expanded(
                        child: Divider(color: Color(0xFF30363D)),
                      ),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 12.0),
                        child: Text(
                          'O inicia sesión con',
                          style: TextStyle(
                              color: Color(0xFF94A3B8), fontSize: 12),
                        ),
                      ),
                      Expanded(
                        child: Divider(color: Color(0xFF30363D)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      IconButton(
                        tooltip: 'Iniciar sesión con Google',
                        icon: const Icon(Icons.g_mobiledata,
                            size: 32, color: Colors.white),
                        style: IconButton.styleFrom(
                          backgroundColor: const Color(0xFF161B22),
                          side: const BorderSide(color: Color(0xFF30363D)),
                        ),
                        onPressed: () => _handleOAuthLogin('google'),
                      ),
                      IconButton(
                        tooltip: 'Iniciar sesión con GitHub',
                        icon: const Icon(Icons.code,
                            size: 24, color: Colors.white),
                        style: IconButton.styleFrom(
                          backgroundColor: const Color(0xFF161B22),
                          side: const BorderSide(color: Color(0xFF30363D)),
                        ),
                        onPressed: () => _handleOAuthLogin('github'),
                      ),
                      IconButton(
                        tooltip: 'Iniciar sesión con GitLab',
                        icon: const Icon(Icons.security,
                            size: 24, color: Colors.orangeAccent),
                        style: IconButton.styleFrom(
                          backgroundColor: const Color(0xFF161B22),
                          side: const BorderSide(color: Color(0xFF30363D)),
                        ),
                        onPressed: () => _handleOAuthLogin('gitlab'),
                      ),
                      IconButton(
                        tooltip: 'Iniciar sesión con Microsoft',
                        icon: const Icon(Icons.window,
                            size: 22, color: Colors.lightBlueAccent),
                        style: IconButton.styleFrom(
                          backgroundColor: const Color(0xFF161B22),
                          side: const BorderSide(color: Color(0xFF30363D)),
                        ),
                        onPressed: () => _handleOAuthLogin('microsoft'),
                      ),
                    ],
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
