import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'features/security_gate/presentation/screens/security_gate_bypasses_screen.dart';
import 'services/api_client.dart';
import 'features/scans/data/services/scan_service.dart';
import 'features/scans/data/models/scan_model.dart';

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
        final token = response.data['token'] ?? response.data['access_token'];
        if (token != null && token.toString().isNotEmpty) {
          await prefs.setString('jwt_token', token.toString());
        } else {
          await prefs.setString('jwt_token', 'authenticated_session_$email');
        }
        await prefs.setString('user_email', email);
        await prefs.setBool('is_logged_in', true);
        return true;
      } else {
        throw Exception('Credenciales incorrectas o usuario no registrado.');
      }
    } catch (e) {
      final regEmail = prefs.getString('registered_email');
      final regPass = prefs.getString('registered_password');

      if (regEmail != null && regPass != null && email == regEmail && password == regPass) {
        await prefs.setString('jwt_token', 'offline_session_$email');
        await prefs.setString('user_email', email);
        await prefs.setBool('is_logged_in', true);
        return true;
      }

      throw Exception('Credenciales inválidas. Verifica tu correo y contraseña.');
    }
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
        _isLoggedIn = (token != null && token.isNotEmpty) && isLoggedInPref;
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

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    setState(() => _inlineLoginError = null);

    if (email.isEmpty || password.isEmpty) {
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
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _inlineLoginError = e.toString().replaceAll('Exception: ', '');
        });
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
                      prefixIcon: Icon(Icons.email, color: Color(0xFF30363D)),
                      focusedBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: Color(0xFF30363D), width: 1.5),
                      ),
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
                      focusedBorder: const OutlineInputBorder(
                        borderSide: BorderSide(color: Color(0xFF30363D), width: 1.5),
                      ),
                      prefixIcon: const Icon(Icons.lock, color: Color(0xFF30363D)),
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
                  if (_inlineLoginError != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.red.shade900.withValues(alpha: 0.4),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.red.shade700),
                      ),
                      child: Text(
                        _inlineLoginError!,
                        style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: InkWell(
                      onTap: () => _openWebUrl('https://sspillowy.com/forgot-password'),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8.0, horizontal: 4.0),
                        child: Text(
                          '¿Olvidaste tu contraseña?',
                          style: TextStyle(fontSize: 12, color: Color(0xFF38BDF8), fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF21262D),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
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
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        '¿No tienes cuenta? ',
                        style: TextStyle(color: Color(0xFF94A3B8)),
                      ),
                      InkWell(
                        onTap: () => _openWebUrl('https://sspillowy.com/register'),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8.0, horizontal: 4.0),
                          child: Text(
                            'Regístrate',
                            style: TextStyle(
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
  List<Map<String, String>> _globalAuditLogs = [];

  @override
  void initState() {
    super.initState();
    _loadPersistentAuditLogs();
  }

  Future<void> _loadPersistentAuditLogs() async {
    final prefs = await SharedPreferences.getInstance();
    final savedLogsJson = prefs.getString('persistent_audit_logs');
    if (savedLogsJson != null) {
      try {
        final List decoded = jsonDecode(savedLogsJson);
        setState(() {
          _globalAuditLogs = decoded.map((e) => Map<String, String>.from(e)).toList();
        });
      } catch (_) {}
    }
  }

  Future<void> _savePersistentAuditLogs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('persistent_audit_logs', jsonEncode(_globalAuditLogs));
  }

  void _updateActiveScans(List<ScanModel> scans) {
    setState(() {
      _currentActiveScans = scans;
    });
  }

  void _addAuditLog(Map<String, String> log) {
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
      ),
      PillowChatScreen(
        currentScans: _currentActiveScans,
        isOnDuty: widget.isOnDuty,
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

    return Scaffold(
      body: pages[_currentIndex],
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          indicatorColor: const Color(0xFF0284C7).withValues(alpha: 0.3),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12);
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
            NavigationDestination(
                icon: Icon(Icons.security), label: 'Bandeja'),
            NavigationDestination(
                icon: Icon(Icons.smart_toy_outlined), label: 'Pillow IA'),
            NavigationDestination(
                icon: Icon(Icons.gavel), label: 'Bypasses'),
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
  final List<Map<String, String>> _messages = [
    {
      'role': 'assistant',
      'text':
          '¡Hola! Soy tu asistente de seguridad Pillow IA. ¿En qué te puedo ayudar sobre los hallazgos actuales de tus repositorios?'
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

  String _generateDynamicAIResponse(String prompt) {
    final lower = prompt.toLowerCase().trim();
    final count = widget.currentScans.length;

    if (lower == 'hola' || lower.contains('buenos dias') || lower.contains('buenas')) {
      return '¡Hola! Estoy listo para asistirte con el análisis de tus vulnerabilidades. Actualmente tienes $count repositorio(s) vinculado(s). ¿Qué deseas revisar?';
    }

    if (lower.contains('ayuda') || lower.contains('puedes ayudar') || lower.contains('que haces')) {
      return 'Te puedo ayudar a resumir los hallazgos SAST, evaluar bloqueos en pases a producción, explicar vulnerabilidades CWE o dar sugerencias sobre excepciones temporizadas.';
    }

    if (lower.contains('resumen') || lower.contains('hallazgos') || lower.contains('estado') || lower.contains('repo')) {
      if (count == 0) {
        return 'Tu bandeja está vacía. No hay hallazgos ni vulnerabilidades pendientes registradas en este momento.';
      }
      final names = widget.currentScans.map((s) => s.title ?? 'Repo').join(', ');
      return 'Sincronización activa: $count repositorio(s) [$names]. Puedes seleccionar cualquiera en la pestaña de Bandeja para aplicar excepciones o bloqueos.';
    }

    if (lower.contains('bypass') || lower.contains('bloqueo') || lower.contains('excepcion')) {
      return 'Las decisiones HITL tomadas desde la Bandeja se auditan inmediatamente en la pestaña de Historial con su respectiva vigencia.';
    }

    return 'Entendido. Estoy monitoreando tus $count repositorio(s) sincronizado(s). Si necesitas detalles sobre algún fallo específico o CWE, solo indícamelo.';
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
      final response = await _apiClient.post('/ai/chat', data: {
        'prompt': cleanPrompt,
        'on_duty_status': widget.isOnDuty,
        'scans_count': widget.currentScans.length,
      });

      String aiResponse = "";
      if (response.statusCode == 200 && response.data != null) {
        aiResponse = (response.data['reply'] ?? response.data['message'] ?? "").toString();
      }

      if (aiResponse.isEmpty) {
        aiResponse = _generateDynamicAIResponse(cleanPrompt);
      }

      if (mounted) {
        setState(() {
          _messages.add({'role': 'assistant', 'text': aiResponse});
        });
        _scrollToBottom();
      }
    } catch (_) {
      final fallbackMessage = _generateDynamicAIResponse(cleanPrompt);
      if (mounted) {
        setState(() {
          _messages.add({'role': 'assistant', 'text': fallbackMessage});
        });
        _scrollToBottom();
      }
    } finally {
      if (mounted) setState(() => _isThinking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Asistente Pillow IA'),
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
                  alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 6),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isUser ? const Color(0xFF0284C7) : const Color(0xFF21262D),
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
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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
  List<ScanModel> _localScans = [];
  bool _sortAscending = true;

  String _selectedFilter = 'Todos';
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

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
    final jsonList = _localScans.map((s) => {
      'id': s.id,
      'title': s.title,
      'status': s.status,
      'summary': s.summary,
      'createdAt': s.createdAt.toIso8601String(),
    }).toList();
    await prefs.setString('persistent_scans_list_v2', jsonEncode(jsonList));
  }

  Future<void> _initScans() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString('persistent_scans_list_v2');

    if (jsonStr != null) {
      try {
        final List decoded = jsonDecode(jsonStr);
        _localScans = decoded.map((item) => ScanModel(
          id: item['id'] ?? '101',
          title: item['title'] ?? 'SebaNimono/sspillowy',
          status: item['status'] ?? 'OPEN',
          summary: item['summary'] ?? 'Análisis SAST completado.',
          createdAt: DateTime.parse(item['createdAt']),
        )).toList();
      } catch (_) {}
    } else {
      _localScans = [
        ScanModel(
          id: '101',
          title: 'SebaNimono/sspillowy',
          status: 'OPEN',
          summary: 'Análisis SAST completado en la rama "main". Se identificaron hallazgos de seguridad.',
          createdAt: DateTime.now(),
        )
      ];
      await _saveScansToPrefs();
    }

    _applySorting();
    widget.onScansUpdated(_localScans);
    if (mounted) setState(() {});
  }

  void _applySorting() {
    _localScans.sort((a, b) {
      final nameA = (a.title ?? '').toLowerCase();
      final nameB = (b.title ?? '').toLowerCase();
      return _sortAscending ? nameA.compareTo(nameB) : nameB.compareTo(nameA);
    });
  }

  void _deleteSingleScan(ScanModel scan) {
    setState(() {
      _localScans.removeWhere((s) => s.id == scan.id);
    });
    _saveScansToPrefs();
    widget.onScansUpdated(_localScans);

    widget.onAuditAdded({
      'id': scan.id,
      'type': 'DELETE',
      'title': 'Repositorio Eliminado',
      'subtitle': 'Se eliminó "${scan.title ?? scan.id}" de la bandeja.',
      'time': 'Ahora mismo',
    });
  }

  void _clearAllScans() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: const Text('Limpiar Bandeja', style: TextStyle(color: Colors.white)),
        content: const Text('¿Deseas vaciar todos los elementos de la bandeja de hallazgos?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () {
              Navigator.pop(context);
              setState(() {
                _localScans.clear();
              });
              _saveScansToPrefs();
              widget.onScansUpdated(_localScans);

              widget.onAuditAdded({
                'id': 'ALL',
                'type': 'DELETE',
                'title': 'Bandeja Vaciada',
                'subtitle': 'Se eliminaron todos los repositorios de la lista.',
                'time': 'Ahora mismo',
              });
            },
            child: const Text('Vaciar Todo', style: TextStyle(color: Colors.white)),
          ),
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

        final bool isAlreadyProcessed = scan.status == 'EXEMPTED' || scan.status == 'BLOCKED';

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
                      style: const TextStyle(fontSize: 13, color: Colors.white70),
                    ),
                  ),
                  const SizedBox(height: 20),
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
                        style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold),
                      ),
                    )
                  else
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.amber.shade800,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            icon: const Icon(Icons.shield_outlined, color: Colors.white),
                            label: const Text('Excepción', style: TextStyle(color: Colors.white)),
                            onPressed: () {
                              String? inlineError;
                              showDialog(
                                context: context,
                                builder: (dialogContext) => StatefulBuilder(
                                  builder: (context, setDialogState) {
                                    return AlertDialog(
                                      backgroundColor: const Color(0xFF161B22),
                                      title: const Text('Aprobar Excepción Temporizada',
                                          style: TextStyle(color: Colors.white)),
                                      content: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            '¿Autorizar el pase a producción con esta vulnerabilidad activa?',
                                            style: TextStyle(fontSize: 13, color: Colors.grey),
                                          ),
                                          const SizedBox(height: 12),
                                          DropdownButtonFormField<int>(
                                            initialValue: selectedHours,
                                            dropdownColor: const Color(0xFF161B22),
                                            decoration: const InputDecoration(
                                              labelText: 'Duración de la excepción',
                                              border: OutlineInputBorder(),
                                            ),
                                            items: const [
                                              DropdownMenuItem(value: 24, child: Text('24 Horas')),
                                              DropdownMenuItem(value: 72, child: Text('72 Horas')),
                                              DropdownMenuItem(value: 168, child: Text('168 Horas (1 Semana)')),
                                            ],
                                            onChanged: (val) => selectedHours = val ?? 24,
                                          ),
                                          const SizedBox(height: 12),
                                          TextField(
                                            controller: justificationController,
                                            maxLines: 2,
                                            decoration: InputDecoration(
                                              border: const OutlineInputBorder(),
                                              hintText: 'Justificación (mínimo 10 caracteres)',
                                              errorText: inlineError,
                                            ),
                                          ),
                                        ],
                                      ),
                                      actions: [
                                        TextButton(
                                            onPressed: () => Navigator.pop(dialogContext),
                                            child: const Text('Cancelar')),
                                        ElevatedButton(
                                          onPressed: () {
                                            if (justificationController.text.trim().length >= 10) {
                                              Navigator.pop(dialogContext);
                                              Navigator.pop(bottomSheetContext);

                                              setState(() {
                                                final idx = _localScans.indexWhere((s) => s.id == scan.id);
                                                if (idx != -1) {
                                                  _localScans[idx] = ScanModel(
                                                    id: scan.id,
                                                    title: scan.title,
                                                    status: 'EXEMPTED',
                                                    summary: scan.summary,
                                                    createdAt: scan.createdAt,
                                                  );
                                                  _saveScansToPrefs();
                                                }
                                              });

                                              widget.onAuditAdded({
                                                'id': scan.id,
                                                'type': 'EXEMPTION',
                                                'title': 'Excepción Lanzada',
                                                'subtitle': '${scan.title ?? 'Repo'} - "${justificationController.text.trim()}"',
                                                'time': 'Quedan $selectedHours h',
                                                'duration': '$selectedHours Horas',
                                              });
                                            } else {
                                              setDialogState(() {
                                                inlineError = 'La justificación debe tener al menos 10 caracteres.';
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
                              backgroundColor: Colors.red.shade700,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            icon: const Icon(Icons.block, color: Colors.white),
                            label: const Text('Bloquear', style: TextStyle(color: Colors.white)),
                            onPressed: () {
                              String? inlineError;
                              showDialog(
                                context: context,
                                builder: (dialogContext) => StatefulBuilder(
                                  builder: (context, setDialogState) {
                                    return AlertDialog(
                                      backgroundColor: const Color(0xFF161B22),
                                      title: const Text('Confirmar Bloqueo de Despliegue',
                                          style: TextStyle(color: Colors.white)),
                                      content: TextField(
                                        controller: reasonController,
                                        decoration: InputDecoration(
                                          border: const OutlineInputBorder(),
                                          hintText: 'Motivo del bloqueo (mínimo 3 caracteres)',
                                          errorText: inlineError,
                                        ),
                                      ),
                                      actions: [
                                        TextButton(
                                            onPressed: () => Navigator.pop(dialogContext),
                                            child: const Text('Cancelar')),
                                        ElevatedButton(
                                          style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                                          onPressed: () {
                                            if (reasonController.text.trim().length >= 3) {
                                              Navigator.pop(dialogContext);
                                              Navigator.pop(bottomSheetContext);

                                              setState(() {
                                                final idx = _localScans.indexWhere((s) => s.id == scan.id);
                                                if (idx != -1) {
                                                  _localScans[idx] = ScanModel(
                                                    id: scan.id,
                                                    title: scan.title,
                                                    status: 'BLOCKED',
                                                    summary: scan.summary,
                                                    createdAt: scan.createdAt,
                                                  );
                                                  _saveScansToPrefs();
                                                }
                                              });

                                              widget.onAuditAdded({
                                                'id': scan.id,
                                                'type': 'BLOCK',
                                                'title': 'Bloqueo de Despliegue',
                                                'subtitle': '${scan.title ?? 'Repo'} - "${reasonController.text.trim()}"',
                                                'time': 'Bloqueado',
                                                'duration': 'Permanente',
                                              });
                                            } else {
                                              setDialogState(() {
                                                inlineError = 'El motivo debe tener al menos 3 caracteres.';
                                              });
                                            }
                                          },
                                          child: const Text('Bloquear', style: TextStyle(color: Colors.white)),
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
      String targetStatus = 'OPEN';
      if (_selectedFilter == 'Crítico') targetStatus = 'CRITICAL';
      if (_selectedFilter == 'Alto') targetStatus = 'HIGH';
      if (_selectedFilter == 'Bloqueado') targetStatus = 'BLOCKED';
      if (_selectedFilter == 'Abierto') targetStatus = 'OPEN';

      scans = scans
          .where((s) => s.status.toUpperCase() == targetStatus)
          .toList();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bandeja de Hallazgos'),
        actions: [
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
          if (_localScans.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep_outlined, color: Colors.redAccent),
              tooltip: 'Vaciar Bandeja',
              onPressed: _clearAllScans,
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
                contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                filled: true,
                fillColor: const Color(0xFF161B22),
              ),
              onChanged: (val) => setState(() => _searchQuery = val.toLowerCase()),
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
            child: scans.isEmpty
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
                            style: TextStyle(color: Colors.grey, fontSize: 13),
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
                          title: Text(scan.title ?? 'Repositorio #${scan.id}',
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white)),
                          subtitle: Text(
                            'Estado: ${scan.status} - Fecha: ${_formatDate(scan.createdAt)}',
                            style: const TextStyle(color: Colors.grey, fontSize: 12),
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.delete_outline, color: Colors.grey, size: 20),
                                onPressed: () => _deleteSingleScan(scan),
                              ),
                              const Icon(Icons.chevron_right, color: Colors.grey),
                            ],
                          ),
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
  final List<Map<String, String>> auditLogs;

  const AuditHistoryScreen({super.key, required this.auditLogs});

  @override
  State<AuditHistoryScreen> createState() => _AuditHistoryScreenState();
}

class _AuditHistoryScreenState extends State<AuditHistoryScreen> {
  void _showLogDetail(BuildContext context, Map<String, String> log) {
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
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const Divider(color: Color(0xFF30363D)),
            const SizedBox(height: 8),
            Text('Detalle: ${log['subtitle']}', style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 8),
            Text('Estado: ${log['time']}', style: const TextStyle(color: Colors.amber)),
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
                              : Icons.delete_forever,
                      color: log['type'] == 'EXEMPTION'
                          ? Colors.amber
                          : log['type'] == 'BLOCK'
                              ? Colors.red
                              : Colors.grey,
                    ),
                    title: Text(log['title']!, style: const TextStyle(color: Colors.white)),
                    subtitle: Text(log['subtitle']!, style: const TextStyle(color: Colors.grey, fontSize: 12)),
                    trailing: Text(log['time']!, style: const TextStyle(fontSize: 11, color: Colors.amber)),
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
  String _displayName = 'dev';
  String _username = 'seba.tralma.dev';

  @override
  void initState() {
    super.initState();
    _loadProfileData();
  }

  Future<void> _loadProfileData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _displayName = prefs.getString('user_name') ?? 'dev';
      _username = (prefs.getString('user_email') ?? 'seba.tralma.dev@sspillowy.com').split('@').first;
    });
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
    return Scaffold(
      appBar: AppBar(title: const Text('Perfil & Configuración')),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const ClampingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            children: [
              const CircleAvatar(
                radius: 36,
                backgroundColor: Color(0xFF0284C7),
                child: Icon(Icons.person, size: 40, color: Colors.white),
              ),
              const SizedBox(height: 8),
              Text(_displayName,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
              Text('@$_username',
                  style: const TextStyle(fontSize: 13, color: Colors.grey)),
              const SizedBox(height: 16),
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
              const SizedBox(height: 8),
              Card(
                color: const Color(0xFF161B22),
                child: ListTile(
                  leading: const Icon(Icons.description_outlined, color: Color(0xFF38BDF8)),
                  title: const Text('Términos y Condiciones', style: TextStyle(color: Colors.white)),
                  onTap: () => _openWebUrl('https://sspillowy.com/terms'),
                ),
              ),
              const SizedBox(height: 8),
              Card(
                color: const Color(0xFF161B22),
                child: ListTile(
                  leading: const Icon(Icons.delete_forever, color: Colors.red),
                  title: const Text('Solicitud de eliminación de cuenta',
                      style: TextStyle(color: Colors.red)),
                  onTap: () => _openWebUrl('https://sspillowy.com/delete-account'),
                ),
              ),
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
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
