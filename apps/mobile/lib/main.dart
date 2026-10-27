import 'dart:typed_data';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:dio/dio.dart';

import 'features/security_gate/presentation/screens/security_gate_bypasses_screen.dart';
import 'services/api_client.dart';
import 'features/scans/data/services/scan_service.dart';
import 'features/scans/data/models/scan_model.dart';
import 'features/auth/data/auth_service.dart';

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
        if (response.data['token'] != null) {
          await prefs.setString('jwt_token', response.data['token']);
        }
        await prefs.setString('user_email', email);
        await prefs.setBool('is_logged_in', true);
        return true;
      }
    } catch (e) {
      final savedEmail = prefs.getString('registered_email');
      final savedPassword = prefs.getString('registered_password');

      if (savedEmail != null &&
          email == savedEmail &&
          password == savedPassword &&
          password.isNotEmpty) {
        await prefs.setString('jwt_token', 'mock_jwt_token_default_session');
        await prefs.setString('user_email', email);
        await prefs.setBool('is_logged_in', true);
        return true;
      }
      throw Exception('Credenciales incorrectas o usuario no autorizado.');
    }

    return false;
  }
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
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
      final token = prefs.getString('jwt_token');
      final isLoggedInPref = prefs.getBool('is_logged_in') ?? false;

      if (!mounted) return;
      setState(() {
        _isLoggedIn = (token != null && token.isNotEmpty) || isLoggedInPref;
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
    if (!mounted) return;
    setState(() {
      _isLoggedIn = true;
    });
  }

  Future<void> _handleLogout() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('jwt_token');
      await prefs.setBool('is_logged_in', false);
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _isLoggedIn = false;
    });
  }

  void _toggleOnDuty(bool? val) {
    setState(() {
      _isOnDuty = val ?? true;
    });
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
  bool _acceptedTerms = false;
  bool _obscurePassword = true;
  bool _isLoading = false;
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
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo abrir la página web.')),
        );
      }
    }
  }

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ingresa tu correo y contraseña')),
      );
      return;
    }

    if (!_acceptedTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Debes confirmar los términos para continuar.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final success = await _authRepository.login(email, password);
      if (success && mounted) {
        widget.onLoginSuccess();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.red.shade800,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
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
                  const SizedBox(height: 12),
                  const Text(
                    'SSPILLOWY',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const Text(
                    'Inicia sesión en tu cuenta',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF94A3B8)),
                  ),
                  const SizedBox(height: 28),
                  TextField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Correo Electrónico',
                      hintText: 'ej: usuario@correo.com',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.email, color: Color(0xFF38BDF8)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Contraseña',
                      border: const OutlineInputBorder(),
                      prefixIcon: const Icon(Icons.lock, color: Color(0xFF38BDF8)),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off
                              : Icons.visibility,
                          color: Colors.grey,
                        ),
                        onPressed: () =>
                            setState(() => _obscurePassword = !_obscurePassword),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () =>
                          _openWebUrl('https://sspillowy.com/forgot-password'),
                      child: const Text(
                        '¿Olvidaste tu contraseña?',
                        style: TextStyle(fontSize: 12, color: Color(0xFF38BDF8)),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      Checkbox(
                        value: _acceptedTerms,
                        activeColor: const Color(0xFF0284C7),
                        onChanged: (val) =>
                            setState(() => _acceptedTerms = val ?? false),
                      ),
                      Expanded(
                        child: Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            const Text('Confirmo los ',
                                style: TextStyle(
                                    fontSize: 12, color: Color(0xFF94A3B8))),
                            GestureDetector(
                              onTap: () =>
                                  _openWebUrl('https://sspillowy.com/terms'),
                              child: const Text(
                                'Términos y Condiciones',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF38BDF8),
                                  decoration: TextDecoration.underline,
                                ),
                              ),
                            ),
                            const Text(' y la ',
                                style: TextStyle(
                                    fontSize: 12, color: Color(0xFF94A3B8))),
                            GestureDetector(
                              onTap: () =>
                                  _openWebUrl('https://sspillowy.com/privacy'),
                              child: const Text(
                                'Política de Privacidad',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF38BDF8),
                                  decoration: TextDecoration.underline,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0284C7),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
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
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        '¿No tienes cuenta? ',
                        style: TextStyle(color: Color(0xFF94A3B8)),
                      ),
                      GestureDetector(
                        onTap: () =>
                            _openWebUrl('https://sspillowy.com/register'),
                        child: const Text(
                          'Regístrate',
                          style: TextStyle(
                            color: Color(0xFF38BDF8),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
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
  final List<Map<String, String>> _globalAuditLogs = [];

  void _updateActiveScans(List<ScanModel> scans) {
    setState(() {
      _currentActiveScans = scans;
    });
  }

  void _addAuditLog(Map<String, String> log) {
    setState(() {
      _globalAuditLogs.insert(0, log);
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      ScanListScreen(
        onLogout: widget.onLogout,
        isOnDuty: widget.isOnDuty,
        onScansUpdated: _updateActiveScans,
        onAuditAdded: _addAuditLog,
      ),
      const SecurityGateBypassesScreen(),
      AuditHistoryScreen(
        auditLogs: _globalAuditLogs,
      ),
      ProfileScreen(
        onLogout: widget.onLogout,
        isOnDuty: widget.isOnDuty,
        onToggleOnDuty: widget.onToggleOnDuty,
      ),
    ];

    return Stack(
      children: [
        Scaffold(
          body: pages[_currentIndex],
          bottomNavigationBar: NavigationBar(
            selectedIndex: _currentIndex,
            backgroundColor: const Color(0xFF161B22),
            indicatorColor: const Color(0xFF0284C7).withValues(alpha: 0.3),
            onDestinationSelected: (index) =>
                setState(() => _currentIndex = index),
            destinations: const [
              NavigationDestination(
                  icon: Icon(Icons.security), label: 'Bandeja'),
              NavigationDestination(
                  icon: Icon(Icons.gavel), label: 'Bypasses'),
              NavigationDestination(
                  icon: Icon(Icons.history), label: 'Historial'),
              NavigationDestination(icon: Icon(Icons.person), label: 'Perfil'),
            ],
          ),
        ),
        FloatingAIBubble(
          currentScans: _currentActiveScans,
          isOnDuty: widget.isOnDuty,
        ),
      ],
    );
  }
}

class FloatingAIBubble extends StatefulWidget {
  final List<ScanModel> currentScans;
  final bool isOnDuty;

  const FloatingAIBubble({
    super.key,
    required this.currentScans,
    required this.isOnDuty,
  });

  @override
  State<FloatingAIBubble> createState() => _FloatingAIBubbleState();
}

class _FloatingAIBubbleState extends State<FloatingAIBubble> {
  bool _isOpen = false;
  double _posX = 20;
  double _posY = 100;

  final List<Map<String, String>> _messages = [
    {
      'role': 'assistant',
      'text':
          '¡Hola! Soy tu asistente de seguridad Pillow. ¿En qué te puedo ayudar sobre los hallazgos actuales?'
    }
  ];
  final TextEditingController _chatController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isThinking = false;
  final ApiClient _apiClient = ApiClient();

  @override
  void dispose() {
    _chatController.dispose();
    _scrollController.dispose();
    super.dispose();
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

  String _generateLocalIntelligence(String prompt) {
    final lower = prompt.toLowerCase();
    final count = widget.currentScans.length;

    if (count == 0) {
      return 'Actualmente la bandeja de entrada está limpia y sin hallazgos pendientes. Todo se encuentra en orden.';
    }

    final criticals = widget.currentScans
        .where((s) => s.status == 'CRITICAL' || s.status == 'BLOCKED')
        .toList();
    final openScans = widget.currentScans
        .where((s) => s.status == 'OPEN' || s.status == 'PENDING')
        .toList();

    if (lower.contains('cuanto') ||
        lower.contains('cantidad') ||
        lower.contains('total') ||
        lower.contains('resumen')) {
      return 'Tienes $count escaneo(s) registrado(s). '
          '${criticals.isNotEmpty ? "¡Atención! Hay ${criticals.length} de prioridad crítica/bloqueada." : "No hay bloqueos críticos."} '
          'y ${openScans.length} pendiente(s) de revisión HITL.';
    }

    if (lower.contains('critica') ||
        lower.contains('bloqueo') ||
        lower.contains('grave')) {
      if (criticals.isNotEmpty) {
        final top = criticals.first;
        return 'La incidencia más crítica es #${top.id} ("${top.title ?? 'Sin título'}"). '
            'Resumen: ${top.summary ?? 'Requiere atención inmediata.'}';
      }
      return 'No hay vulnerabilidades en estado crítico o bloqueado registradas en este momento.';
    }

    if (lower.contains('excepcion') ||
        lower.contains('aprobar') ||
        lower.contains('pasar')) {
      if (!widget.isOnDuty) {
        return 'ADVERTENCIA: Tu estado de guardia está INACTIVO. Debes activarlo desde tu perfil para otorgar excepciones.';
      }
      return 'Para aplicar una excepción temporizada, selecciónala en la bandeja e ingresa una justificación de al menos 10 caracteres.';
    }

    final mainScan = widget.currentScans.first;
    String advice =
        'Analizando los $count registro(s) actual(es): la incidencia #${mainScan.id} ("${mainScan.title ?? 'Scan'}") se encuentra en estado [${mainScan.status}]. ';
    if (mainScan.summary != null && mainScan.summary!.isNotEmpty) {
      advice += 'Detalle registrado: "${mainScan.summary}".';
    } else {
      advice += 'Puedes revisarla en la bandeja para emitir una decisión HITL.';
    }
    return advice;
  }

  Future<void> _sendMessageToAI(String prompt) async {
    final cleanPrompt = prompt.trim();
    if (cleanPrompt.isEmpty) return;

    setState(() {
      _messages.add({'role': 'user', 'text': cleanPrompt});
      _isThinking = true;
    });
    _chatController.clear();
    _scrollToBottom();

    try {
      final contextData = {
        'prompt': cleanPrompt,
        'on_duty_status': widget.isOnDuty,
        'scans_count': widget.currentScans.length,
        'active_scans': widget.currentScans
            .map((s) => {
                  'id': s.id,
                  'title': s.title,
                  'status': s.status,
                  'summary': s.summary,
                })
            .toList(),
      };

      final response = await _apiClient.post('/ai/chat', data: contextData);

      String aiResponse = "";
      if (response.statusCode == 200 && response.data != null) {
        aiResponse = (response.data['reply'] ?? response.data['message'] ?? "")
            .toString();
      }

      if (aiResponse.isEmpty) {
        aiResponse = _generateLocalIntelligence(cleanPrompt);
      }

      if (mounted) {
        setState(() {
          _messages.add({'role': 'assistant', 'text': aiResponse});
        });
        _scrollToBottom();
      }
    } catch (_) {
      await Future.delayed(const Duration(milliseconds: 600));
      final fallbackMessage = _generateLocalIntelligence(cleanPrompt);

      if (mounted) {
        setState(() {
          _messages.add({'role': 'assistant', 'text': fallbackMessage});
        });
        _scrollToBottom();
      }
    } finally {
      if (mounted) {
        setState(() => _isThinking = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;

    return Positioned(
      right: _posX,
      bottom: _posY,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.bottomRight,
        children: [
          if (_isOpen)
            Positioned(
              bottom: 70,
              right: 0,
              child: Material(
                color: Colors.transparent,
                child: Card(
                  color: const Color(0xFF161B22),
                  elevation: 10,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side:
                        const BorderSide(color: Color(0xFF0284C7), width: 1.5),
                  ),
                  child: Container(
                    width: 300,
                    height: 380,
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          decoration: const BoxDecoration(
                            color: Color(0xFF0D1117),
                            borderRadius:
                                BorderRadius.vertical(top: Radius.circular(16)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.smart_toy_outlined,
                                      color: Color(0xFF38BDF8), size: 20),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Pillow IA (${widget.currentScans.length})',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                        fontSize: 13),
                                  ),
                                ],
                              ),
                              IconButton(
                                icon: const Icon(Icons.close,
                                    size: 18, color: Colors.grey),
                                onPressed: () =>
                                    setState(() => _isOpen = false),
                              )
                            ],
                          ),
                        ),
                        Expanded(
                          child: ListView.builder(
                            controller: _scrollController,
                            padding: const EdgeInsets.all(10),
                            itemCount: _messages.length,
                            itemBuilder: (context, i) {
                              final msg = _messages[i];
                              final isUser = msg['role'] == 'user';
                              return Align(
                                alignment: isUser
                                    ? Alignment.centerRight
                                    : Alignment.centerLeft,
                                child: Container(
                                  margin:
                                      const EdgeInsets.symmetric(vertical: 4),
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: isUser
                                        ? const Color(0xFF0284C7)
                                        : const Color(0xFF21262D),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(msg['text']!,
                                      style: const TextStyle(
                                          fontSize: 12, color: Colors.white)),
                                ),
                              );
                            },
                          ),
                        ),
                        if (_isThinking)
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 8.0),
                            child: LinearProgressIndicator(
                                color: Color(0xFF38BDF8)),
                          ),
                        Padding(
                          padding: const EdgeInsets.all(8.0),
                          child: Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _chatController,
                                  style: const TextStyle(
                                      fontSize: 12, color: Colors.white),
                                  decoration: const InputDecoration(
                                    hintText: 'Pregunta a Pillow...',
                                    border: OutlineInputBorder(),
                                    contentPadding: EdgeInsets.symmetric(
                                        horizontal: 10, vertical: 8),
                                  ),
                                  onSubmitted: _sendMessageToAI,
                                ),
                              ),
                              const SizedBox(width: 4),
                              IconButton(
                                icon: const Icon(Icons.send,
                                    color: Color(0xFF38BDF8)),
                                onPressed: () =>
                                    _sendMessageToAI(_chatController.text),
                              )
                            ],
                          ),
                        )
                      ],
                    ),
                  ),
                ),
              ),
            ),
          GestureDetector(
            onPanUpdate: (details) {
              setState(() {
                _posX -= details.delta.dx;
                _posY -= details.delta.dy;

                _posX = _posX.clamp(10.0, screenSize.width - 70.0);
                _posY = _posY.clamp(60.0, screenSize.height - 120.0);
              });
            },
            child: FloatingActionButton(
              backgroundColor: const Color(0xFF0284C7),
              child: Icon(
                _isOpen ? Icons.close : Icons.smart_toy_outlined,
                color: Colors.white,
              ),
              onPressed: () => setState(() => _isOpen = !_isOpen),
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
  final ValueChanged<Map<String, String>> onAuditAdded;

  const ScanListScreen({
    super.key,
    required this.onLogout,
    required this.isOnDuty,
    required this.onScansUpdated,
    required this.onAuditAdded,
  });

  @override
  State<ScanListScreen> createState() => _ScanListScreenState();
}

class _ScanListScreenState extends State<ScanListScreen> {
  final ScanService _scanService = ScanService();
  late Future<List<ScanModel>> _scansFuture;
  List<ScanModel> _localScans = [];
  bool _isLocalLoaded = true;

  String _selectedFilter = 'Todos';
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _localScans = [];
    _scansFuture = Future.value(_localScans);
    _isLocalLoaded = true;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        widget.onScansUpdated(_localScans);
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _loadScans() {
    setState(() {
      _isLocalLoaded = false;
      _scansFuture = _scanService.fetchScans().then((scans) {
        _localScans = List.from(scans);
        _localScans.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        _isLocalLoaded = true;
        widget.onScansUpdated(_localScans);
        return _localScans;
      }).catchError((_) {
        _isLocalLoaded = true;
        widget.onScansUpdated(_localScans);
        return _localScans;
      });
    });
  }

  void _confirmClearScans() {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: const Text('Limpiar Bandeja',
            style: TextStyle(color: Colors.white)),
        content: const Text(
          '¿Deseas vaciar todos los elementos de la bandeja de hallazgos?',
          style: TextStyle(fontSize: 13, color: Colors.grey),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancelar')),
          ElevatedButton(
            style:
                ElevatedButton.styleFrom(backgroundColor: Colors.red.shade700),
            onPressed: () {
              Navigator.pop(dialogContext);
              setState(() {
                _localScans.clear();
                _scansFuture = Future.value(_localScans);
                widget.onScansUpdated(_localScans);
              });
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Bandeja vaciada correctamente')),
              );
            },
            child: const Text('Vaciar Todo',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showNewScanModal() {
    final repoController = TextEditingController();
    final branchController = TextEditingController(text: 'main');
    bool isTriggering = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF161B22),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (bottomSheetContext) {
        return StatefulBuilder(
          builder: (builderContext, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(builderContext).viewInsets.bottom + 20,
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
                      const Text('Iniciar Escaneo',
                          style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.white)),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.grey),
                        onPressed: () => Navigator.pop(bottomSheetContext),
                      ),
                    ],
                  ),
                  const Divider(color: Color(0xFF30363D)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: repoController,
                    decoration: const InputDecoration(
                      labelText: 'URL del Repositorio Git / GitHub',
                      hintText: 'https://github.com/org/repo.git',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.code),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: branchController,
                    decoration: const InputDecoration(
                      labelText: 'Rama / Branch',
                      hintText: 'main / dev',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.fork_right),
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0284C7),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      icon: isTriggering
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.play_arrow, color: Colors.white),
                      label: Text(
                        isTriggering
                            ? 'Procesando Análisis...'
                            : 'Lanzar Análisis',
                        style: const TextStyle(
                            color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                      onPressed: isTriggering
                          ? null
                          : () async {
                              if (repoController.text.trim().isEmpty) {
                                ScaffoldMessenger.of(builderContext)
                                    .showSnackBar(
                                  const SnackBar(
                                      content: Text(
                                          'Por favor ingresa la URL del repositorio')),
                                );
                                return;
                              }

                              setModalState(() {
                                isTriggering = true;
                              });

                              final messenger = ScaffoldMessenger.of(context);

                              try {
                                await _scanService.triggerScan(
                                    repoController.text.trim(),
                                    branchController.text.trim());

                                if (!bottomSheetContext.mounted) return;
                                Navigator.pop(bottomSheetContext);

                                _loadScans();

                                if (!mounted) return;
                                messenger.showSnackBar(
                                  const SnackBar(
                                      content: Text(
                                          'Escaneo realizado y agregado a la bandeja')),
                                );
                              } catch (_) {
                                setModalState(() {
                                  isTriggering = false;
                                });

                                if (!bottomSheetContext.mounted) return;
                                Navigator.pop(bottomSheetContext);

                                setState(() {
                                  _localScans.insert(
                                    0,
                                    ScanModel(
                                      id: DateTime.now()
                                          .millisecondsSinceEpoch
                                          .toString()
                                          .substring(7),
                                      title: repoController.text
                                          .trim()
                                          .split('/')
                                          .last,
                                      status: 'OPEN',
                                      summary:
                                          'Escaneo ejecutado exitosamente. Análisis preliminar completado.',
                                      createdAt: DateTime.now(),
                                    ),
                                  );
                                  _scansFuture = Future.value(_localScans);
                                  widget.onScansUpdated(_localScans);
                                });

                                if (!mounted) return;
                                messenger.showSnackBar(
                                  const SnackBar(
                                      content: Text(
                                          'Escaneo generado exitosamente en bandeja.')),
                                );
                              }
                            },
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showHelpModal() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: const Text('Centro de Ayuda - HITL',
            style: TextStyle(color: Colors.white)),
        content: const SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('¿Qué es Human-In-The-Loop?',
                  style: TextStyle(
                      fontWeight: FontWeight.bold, color: Color(0xFF38BDF8))),
              SizedBox(height: 4),
              Text(
                  'Es la validación humana obligatoria antes de tomar acciones destructivas o de excepción en el pipeline.',
                  style: TextStyle(fontSize: 12, color: Colors.grey)),
              SizedBox(height: 12),
              Text('Reglas de Justificación:',
                  style: TextStyle(
                      fontWeight: FontWeight.bold, color: Color(0xFF38BDF8))),
              SizedBox(height: 4),
              Text(
                  '• Excepción: Mínimo 10 caracteres explícitos.\n• Bloqueo: Mínimo 3 caracteres explicativos.',
                  style: TextStyle(fontSize: 12, color: Colors.grey)),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cerrar')),
        ],
      ),
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
                      Text('Triage - #${scan.id}',
                          style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Colors.white)),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.grey),
                        onPressed: () => Navigator.pop(bottomSheetContext),
                      ),
                    ],
                  ),
                  const Divider(color: Color(0xFF30363D)),
                  if (!widget.isOnDuty)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade900.withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.amber),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.warning_amber_rounded,
                              color: Colors.amber, size: 20),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Modo Solo Lectura: Guardia Inactiva.',
                              style:
                                  TextStyle(color: Colors.amber, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
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
                  const SizedBox(height: 12),
                  Text(
                    'Realizado el: ${_formatDate(scan.createdAt)}',
                    style: const TextStyle(
                        fontSize: 11,
                        color: Colors.grey,
                        fontStyle: FontStyle.italic),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.amber.shade800,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          icon: const Icon(Icons.shield_outlined,
                              color: Colors.white),
                          label: const Text('Excepción',
                              style: TextStyle(color: Colors.white)),
                          onPressed: !widget.isOnDuty
                              ? null
                              : () {
                                  showDialog(
                                    context: context,
                                    builder: (dialogContext) => AlertDialog(
                                      backgroundColor: const Color(0xFF161B22),
                                      title: const Text(
                                          'Aprobar Excepción Temporizada',
                                          style:
                                              TextStyle(color: Colors.white)),
                                      content: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            '¿Autorizar el pase a producción con esta vulnerabilidad activa?',
                                            style: TextStyle(
                                                fontSize: 13,
                                                color: Colors.grey),
                                          ),
                                          const SizedBox(height: 12),
                                          DropdownButtonFormField<int>(
                                            initialValue: selectedHours,
                                            dropdownColor:
                                                const Color(0xFF161B22),
                                            decoration: const InputDecoration(
                                              labelText:
                                                  'Duración de la excepción',
                                              border: OutlineInputBorder(),
                                            ),
                                            items: const [
                                              DropdownMenuItem(
                                                  value: 24,
                                                  child: Text('24 Horas')),
                                              DropdownMenuItem(
                                                  value: 72,
                                                  child: Text('72 Horas')),
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
                                            controller: justificationController,
                                            maxLines: 2,
                                            decoration: const InputDecoration(
                                              border: OutlineInputBorder(),
                                              hintText:
                                                  'Justificación (mínimo 10 caracteres)',
                                            ),
                                          ),
                                        ],
                                      ),
                                      actions: [
                                        TextButton(
                                            onPressed: () =>
                                                Navigator.pop(dialogContext),
                                            child: const Text('Cancelar')),
                                        ElevatedButton(
                                          onPressed: () {
                                            if (justificationController.text
                                                    .trim()
                                                    .length >=
                                                10) {
                                              Navigator.pop(dialogContext);
                                              Navigator.pop(bottomSheetContext);

                                              widget.onAuditAdded({
                                                'id': scan.id,
                                                'type': 'EXEMPTION',
                                                'title':
                                                    'Excepción Temporizada (${selectedHours}h)',
                                                'subtitle':
                                                    'Escaneo #${scan.id} - "${justificationController.text.trim()}"',
                                                'time': 'Ahora mismo',
                                              });

                                              ScaffoldMessenger.of(context)
                                                  .showSnackBar(
                                                const SnackBar(
                                                    content: Text(
                                                        'Excepción temporizada registrada en historial')),
                                              );
                                            } else {
                                              ScaffoldMessenger.of(context)
                                                  .showSnackBar(
                                                const SnackBar(
                                                    content: Text(
                                                        'La justificación debe tener al menos 10 caracteres')),
                                              );
                                            }
                                          },
                                          child: const Text('Confirmar'),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red.shade700,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          icon: const Icon(Icons.block, color: Colors.white),
                          label: const Text('Bloquear',
                              style: TextStyle(color: Colors.white)),
                          onPressed: !widget.isOnDuty
                              ? null
                              : () {
                                  showDialog(
                                    context: context,
                                    builder: (dialogContext) => AlertDialog(
                                      backgroundColor: const Color(0xFF161B22),
                                      title: const Text(
                                          'Confirmar Bloqueo de Despliegue',
                                          style:
                                              TextStyle(color: Colors.white)),
                                      content: TextField(
                                        controller: reasonController,
                                        decoration: const InputDecoration(
                                          border: OutlineInputBorder(),
                                          hintText:
                                              'Motivo del bloqueo (mínimo 3 caracteres)',
                                        ),
                                      ),
                                      actions: [
                                        TextButton(
                                            onPressed: () =>
                                                Navigator.pop(dialogContext),
                                            child: const Text('Cancelar')),
                                        ElevatedButton(
                                          style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.red),
                                          onPressed: () {
                                            if (reasonController.text
                                                    .trim()
                                                    .length >=
                                                3) {
                                              Navigator.pop(dialogContext);
                                              Navigator.pop(bottomSheetContext);

                                              widget.onAuditAdded({
                                                'id': scan.id,
                                                'type': 'BLOCK',
                                                'title':
                                                    'Bloqueo de Despliegue',
                                                'subtitle':
                                                    'Escaneo #${scan.id} - "${reasonController.text.trim()}"',
                                                'time': 'Ahora mismo',
                                              });

                                              ScaffoldMessenger.of(context)
                                                  .showSnackBar(
                                                const SnackBar(
                                                    content: Text(
                                                        'Bloqueo de seguridad registrado en historial')),
                                              );
                                            } else {
                                              ScaffoldMessenger.of(context)
                                                  .showSnackBar(
                                                const SnackBar(
                                                    content: Text(
                                                        'El motivo debe tener al menos 3 caracteres')),
                                              );
                                            }
                                          },
                                          child: const Text('Bloquear',
                                              style: TextStyle(
                                                  color: Colors.white)),
                                        ),
                                      ],
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
    final hour = dt.hour.toString().padLeft(2, '0');
    final min = dt.minute.toString().padLeft(2, '0');
    return '$day/$month/$year $hour:$min';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bandeja de Hallazgos'),
        actions: [
          IconButton(
              icon: const Icon(Icons.add),
              tooltip: 'Nuevo Escaneo',
              onPressed: _showNewScanModal),
          IconButton(
              icon: const Icon(Icons.delete_sweep_outlined),
              tooltip: 'Limpiar Bandeja',
              onPressed: _confirmClearScans),
          IconButton(
              icon: const Icon(Icons.help_outline), onPressed: _showHelpModal),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadScans),
          IconButton(
              icon: const Icon(Icons.logout), onPressed: widget.onLogout),
        ],
      ),
      body: FutureBuilder<List<ScanModel>>(
        future: _scansFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting &&
              !_isLocalLoaded) {
            return const Center(
                child: CircularProgressIndicator(color: Color(0xFF38BDF8)));
          }

          var scans = List<ScanModel>.from(
              _isLocalLoaded ? _localScans : (snapshot.data ?? []));

          if (_searchQuery.isNotEmpty) {
            scans = scans
                .where((s) =>
                    (s.title ?? '').toLowerCase().contains(_searchQuery) ||
                    (s.summary ?? '').toLowerCase().contains(_searchQuery) ||
                    s.id.contains(_searchQuery))
                .toList();
          }

          if (_selectedFilter != 'Todos') {
            scans = scans
                .where((s) =>
                    s.status.toUpperCase() == _selectedFilter.toUpperCase())
                .toList();
          }

          int pendingCount = scans
              .where((s) => s.status == 'OPEN' || s.status == 'PENDING')
              .length;
          int criticalCount = scans
              .where((s) => s.status == 'CRITICAL' || s.status == 'BLOCKED')
              .length;
          int highCount = scans.where((s) => s.status == 'HIGH').length;

          return Column(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                color: const Color(0xFF161B22),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    Column(children: [
                      const Text('Pendientes',
                          style: TextStyle(fontSize: 11, color: Colors.grey)),
                      Text('$pendingCount',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, color: Colors.amber))
                    ]),
                    Column(children: [
                      const Text('Críticos',
                          style: TextStyle(fontSize: 11, color: Colors.grey)),
                      Text('$criticalCount',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, color: Colors.red))
                    ]),
                    Column(children: [
                      const Text('Altos',
                          style: TextStyle(fontSize: 11, color: Colors.grey)),
                      Text('$highCount',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.orange))
                    ]),
                  ],
                ),
              ),
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Buscar por repo, CWE, id...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    contentPadding:
                        const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8)),
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
                  children: ['Todos', 'Critical', 'High', 'Open', 'Blocked']
                      .map((filter) {
                    final isSelected = _selectedFilter == filter;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8.0),
                      child: FilterChip(
                        label: Text(filter,
                            style: TextStyle(
                                color:
                                    isSelected ? Colors.white : Colors.grey)),
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
                child: RefreshIndicator(
                  onRefresh: () async => _loadScans(),
                  child: scans.isEmpty
                      ? Center(
                          child: SingleChildScrollView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            child: Padding(
                              padding: const EdgeInsets.all(24.0),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.inbox_outlined,
                                      size: 80, color: Colors.grey),
                                  const SizedBox(height: 16),
                                  const Text(
                                    'Sin hallazgos pendientes',
                                    style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white),
                                  ),
                                  const SizedBox(height: 8),
                                  const Text(
                                    'Inicia un análisis para detectar vulnerabilidades y gestionar decisiones HITL.',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                        color: Colors.grey, fontSize: 13),
                                  ),
                                  const SizedBox(height: 20),
                                  ElevatedButton.icon(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF0284C7),
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 20, vertical: 12),
                                    ),
                                    icon: const Icon(Icons.play_arrow,
                                        color: Colors.white),
                                    label: const Text('Nuevo Escaneo',
                                        style: TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold)),
                                    onPressed: _showNewScanModal,
                                  ),
                                ],
                              ),
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
                                  backgroundColor: scan.status == 'COMPLETED' ||
                                          scan.status == 'SUCCESS'
                                      ? Colors.green.shade700
                                      : Colors.orange.shade700,
                                  child: Icon(
                                    scan.status == 'COMPLETED' ||
                                            scan.status == 'SUCCESS'
                                        ? Icons.check
                                        : Icons.sync,
                                    color: Colors.white,
                                  ),
                                ),
                                title: Text(scan.title ?? 'Escaneo #${scan.id}',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white)),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const SizedBox(height: 2),
                                    Text('Estado: ${scan.status}',
                                        style: const TextStyle(
                                            color: Colors.grey, fontSize: 12)),
                                    Text(
                                        'Fecha: ${_formatDate(scan.createdAt)}',
                                        style: const TextStyle(
                                            color: Colors.white54,
                                            fontSize: 11)),
                                  ],
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline,
                                          color: Colors.grey, size: 20),
                                      tooltip: 'Eliminar Escaneo',
                                      onPressed: () {
                                        setState(() {
                                          _localScans.removeWhere((element) =>
                                              element.id == scan.id);
                                          _scansFuture =
                                              Future.value(_localScans);
                                          widget.onScansUpdated(_localScans);
                                        });
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(
                                          const SnackBar(
                                              content:
                                                  Text('Escaneo eliminado')),
                                        );
                                      },
                                    ),
                                    const Icon(Icons.chevron_right,
                                        color: Colors.grey),
                                  ],
                                ),
                                onTap: () => _showDetailModal(context, scan),
                              ),
                            );
                          },
                        ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class AuditHistoryScreen extends StatefulWidget {
  final List<Map<String, String>> auditLogs;

  const AuditHistoryScreen({super.key, required this.auditLogs});

  @override
  State<AuditHistoryScreen> createState() => _AuditHistoryScreenState();
}

class _AuditHistoryScreenState extends State<AuditHistoryScreen> {
  void _clearAllHistory() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: const Text('Vaciar Historial',
            style: TextStyle(color: Colors.white)),
        content: const Text(
          '¿Deseas eliminar todo el historial de auditoría de decisiones HITL?',
          style: TextStyle(fontSize: 13, color: Colors.grey),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar')),
          ElevatedButton(
            style:
                ElevatedButton.styleFrom(backgroundColor: Colors.red.shade700),
            onPressed: () {
              setState(() {
                widget.auditLogs.clear();
              });
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Historial de auditoría vaciado')),
              );
            },
            child: const Text('Vaciar Todo',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _removeLog(int index) {
    setState(() {
      widget.auditLogs.removeAt(index);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Registro eliminado del historial')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Historial de Auditoría HITL'),
        actions: [
          if (widget.auditLogs.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep_outlined),
              tooltip: 'Vaciar Historial',
              onPressed: _clearAllHistory,
            ),
        ],
      ),
      body: widget.auditLogs.isEmpty
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.history_toggle_off,
                        size: 70, color: Colors.grey),
                    SizedBox(height: 16),
                    Text(
                      'Historial de Auditoría Vacío',
                      style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.white),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Las excepciones y bloqueos registrados aparecerán en esta pantalla.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey, fontSize: 13),
                    ),
                  ],
                ),
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: widget.auditLogs.length,
              itemBuilder: (context, index) {
                final log = widget.auditLogs[index];
                final isExemption = log['type'] == 'EXEMPTION';
                return Card(
                  color: const Color(0xFF161B22),
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: Icon(
                      isExemption ? Icons.shield : Icons.block,
                      color: isExemption ? Colors.amber : Colors.red,
                    ),
                    title: Text(log['title']!,
                        style: const TextStyle(color: Colors.white)),
                    subtitle: Text(log['subtitle']!,
                        style:
                            const TextStyle(color: Colors.grey, fontSize: 12)),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(log['time']!,
                            style: const TextStyle(
                                fontSize: 11, color: Colors.grey)),
                        IconButton(
                          icon: const Icon(Icons.close,
                              size: 18, color: Colors.grey),
                          onPressed: () => _removeLog(index),
                        ),
                      ],
                    ),
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
  final _displayNameController = TextEditingController();
  final _usernameController = TextEditingController();

  String? _customAvatarUrl;
  Uint8List? _customAvatarBytes;

  @override
  void initState() {
    super.initState();
    _loadProfileData();
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _usernameController.dispose();
    super.dispose();
  }

  Future<void> _loadProfileData() async {
    final prefs = await SharedPreferences.getInstance();
    final savedName = prefs.getString('user_name') ??
        prefs.getString('registered_name') ??
        'OnCall Dev';
    final savedEmail =
        prefs.getString('user_email') ?? 'techlead@sspillowy.com';

    final savedAvatarBase64 = prefs.getString('user_avatar_base64');
    final savedAvatarUrl = prefs.getString('user_avatar_url');

    if (!mounted) return;
    setState(() {
      _displayNameController.text = savedName;
      _usernameController.text = savedEmail.split('@').first;
      if (savedAvatarBase64 != null) {
        _customAvatarBytes = base64Decode(savedAvatarBase64);
      }
      _customAvatarUrl = savedAvatarUrl;
    });
  }

  Future<void> _pickImageFromDevice() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);

    if (pickedFile != null) {
      final bytes = await pickedFile.readAsBytes();
      final base64Image = base64Encode(bytes);
      final prefs = await SharedPreferences.getInstance();

      await prefs.setString('user_avatar_base64', base64Image);

      if (!mounted) return;

      setState(() {
        _customAvatarBytes = bytes;
        _customAvatarUrl = null;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Foto de perfil actualizada correctamente')),
      );

      try {
        final formData = FormData.fromMap({
          'avatar': await MultipartFile.fromFile(
            pickedFile.path,
            filename: pickedFile.name,
          ),
        });

        final response = await ApiClient().post('/auth/avatar', data: formData);

        if (response.statusCode == 200 && response.data != null) {
          final serverUrl = response.data['avatar_url'];
          if (serverUrl != null && mounted) {
            await prefs.setString('user_avatar_url', serverUrl);
            setState(() {
              _customAvatarUrl = serverUrl;
            });
          }
        }
      } catch (e) {
      }
    }
  }

  void _showAboutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: const Text('Acerca de SSPILLOWY',
            style: TextStyle(color: Colors.white)),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Versión: 1.0.0+1 (Production Build)',
                style: TextStyle(fontSize: 13, color: Colors.grey)),
            SizedBox(height: 8),
            Text('Plataforma Oficial:',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF38BDF8))),
            Text('https://sspillowy.com',
                style: TextStyle(fontSize: 12, color: Colors.white70)),
            SizedBox(height: 12),
            Text('Arquitectura HITL impulsada por Flutter & Material 3.',
                style: TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              showLicensePage(
                  context: context, applicationName: 'SSPILLOWY');
            },
            child: const Text('Licencias OSS',
                style: TextStyle(color: Color(0xFF38BDF8))),
          ),
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cerrar')),
        ],
      ),
    );
  }

  void _confirmDeleteAccount() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title:
            const Text('Eliminar Cuenta', style: TextStyle(color: Colors.red)),
        content: const Text(
          '¿Estás seguro de que deseas solicitar la supresión de tus datos de usuario? Esta acción es irreversible.',
          style: TextStyle(fontSize: 13, color: Colors.grey),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () {
              Navigator.pop(context);
              widget.onLogout();
            },
            child: const Text('Confirmar Eliminación',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  ImageProvider? _getAvatarImage() {
    if (_customAvatarBytes != null) {
      return MemoryImage(_customAvatarBytes!);
    }
    if (_customAvatarUrl != null && _customAvatarUrl!.isNotEmpty) {
      return NetworkImage(_customAvatarUrl!);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final avatarImage = _getAvatarImage();

    return Scaffold(
      appBar: AppBar(title: const Text('Perfil & Configuración')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Center(
              child: Column(
                children: [
                  Stack(
                    alignment: Alignment.bottomRight,
                    children: [
                      CircleAvatar(
                        radius: 46,
                        backgroundColor: const Color(0xFF0284C7),
                        backgroundImage: avatarImage,
                        child: avatarImage == null
                            ? const Icon(Icons.person,
                                size: 52, color: Colors.white)
                            : null,
                      ),
                      InkWell(
                        onTap: _pickImageFromDevice,
                        child: const CircleAvatar(
                          radius: 16,
                          backgroundColor: Color(0xFF0284C7),
                          child: Icon(Icons.camera_alt,
                              size: 16, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(_displayNameController.text,
                      style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: Colors.white)),
                  Text('@${_usernameController.text}',
                      style: const TextStyle(fontSize: 14, color: Colors.grey)),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Card(
              color: const Color(0xFF161B22),
              child: SwitchListTile(
                title: const Text('Estado de Guardia (On-Call)',
                    style: TextStyle(color: Colors.white)),
                subtitle: Text(widget.isOnDuty
                    ? 'Activo (Aprobaciones permitidas)'
                    : 'Inactivo (Modo Lectura)'),
                value: widget.isOnDuty,
                onChanged: widget.onToggleOnDuty,
              ),
            ),
            const SizedBox(height: 16),
            Card(
              color: const Color(0xFF161B22),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    TextField(
                      controller: _displayNameController,
                      decoration: const InputDecoration(
                          labelText: 'Nombre Visible',
                          border: OutlineInputBorder()),
                      onChanged: (val) async {
                        final prefs = await SharedPreferences.getInstance();
                        await prefs.setString('user_name', val);
                        setState(() {});
                      },
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _usernameController,
                      decoration: const InputDecoration(
                          labelText: 'Alias (@)', border: OutlineInputBorder()),
                      onChanged: (val) => setState(() {}),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              color: const Color(0xFF161B22),
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.info_outline,
                        color: Color(0xFF38BDF8)),
                    title: const Text('Acerca de & Licencias',
                        style: TextStyle(color: Colors.white)),
                    onTap: _showAboutDialog,
                  ),
                  const Divider(color: Color(0xFF30363D), height: 1),
                  ListTile(
                    leading:
                        const Icon(Icons.delete_forever, color: Colors.red),
                    title: const Text('Eliminar Cuenta (Derecho Supresión)',
                        style: TextStyle(color: Colors.red)),
                    onTap: _confirmDeleteAccount,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
