import 'package:flutter/material.dart';

void main() {
  runApp(const SSPILLOWYApp());
}

class SSPILLOWYApp extends StatefulWidget {
  const SSPILLOWYApp({super.key});

  @override
  State<SSPILLOWYApp> createState() => _SSPILLOWYAppState();
}

class _SSPILLOWYAppState extends State<SSPILLOWYApp> {
  ThemeMode _themeMode = ThemeMode.light;

  void _toggleTheme() {
    setState(() {
      _themeMode =
          _themeMode == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SSPILLOWY',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF4A3E85),
          brightness: Brightness.light,
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6366F1),
          brightness: Brightness.dark,
        ),
      ),
      home: LoginScreen(onToggleTheme: _toggleTheme, currentMode: _themeMode),
    );
  }
}

class LoginScreen extends StatefulWidget {
  final VoidCallback onToggleTheme;
  final ThemeMode currentMode;

  const LoginScreen({
    super.key,
    required this.onToggleTheme,
    required this.currentMode,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoginTab = true;

  // Rutas locales de los assets con sus nombres de archivo exactos
  static const String _mainLogoAsset = 'assets/sspillowy_logo.png';
  static const String _innerLogoAsset = 'assets/logo_2.png';
  static const String _googleAsset = 'assets/Google.png';
  static const String _githubAsset = 'assets/GitHub.png';
  static const String _gitlabAsset = 'assets/GitLab.png';
  static const String _microsoftAsset = 'assets/Microsoft.png';

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() {
    final email = _emailController.text.trim();
    final userEmail = email.isEmpty ? 'usuario@sspillowy.com' : email;
    final initialName = userEmail.split('@').first;

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (context) => MainDashboardScreen(
          userName: initialName,
          userNickname: initialName.toLowerCase(),
          userEmail: userEmail,
          onToggleTheme: widget.onToggleTheme,
          currentMode: widget.currentMode,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: CustomPaint(painter: GridPainter(isDark: isDark)),
          ),
          SafeArea(
            child: Column(
              children: [
                // Barra superior
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16.0, vertical: 8.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color:
                              isDark ? const Color(0xFF1E293B) : Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: isDark
                                  ? Colors.white12
                                  : Colors.grey.shade300),
                        ),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 18,
                              height: 18,
                              child: Image.asset(_innerLogoAsset,
                                  fit: BoxFit.contain),
                            ),
                            const SizedBox(width: 8),
                            const Text('SSPILLOWY Console',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold, fontSize: 12)),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: Icon(isDark
                            ? Icons.light_mode
                            : Icons.dark_mode_outlined),
                        onPressed: widget.onToggleTheme,
                        tooltip: 'Cambiar Modo Oscuro/Claro',
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          // Logo Principal
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8.0),
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(
                                maxHeight: 110,
                                maxWidth: 280,
                              ),
                              child: AspectRatio(
                                aspectRatio: 16 / 9,
                                child: Image.asset(
                                  _mainLogoAsset,
                                  fit: BoxFit.contain,
                                  errorBuilder: (context, error, stackTrace) =>
                                      Image.asset(_innerLogoAsset,
                                          fit: BoxFit.contain),
                                ),
                              ),
                            ),
                          ),
                          Text(
                            _isLoginTab
                                ? 'Iniciar sesión en SSPILLOWY'
                                : 'Crear tu cuenta en SSPILLOWY',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white70 : Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                              'Plataforma Integral de Gobernanza DevSecOps',
                              style:
                                  TextStyle(color: Colors.grey, fontSize: 12)),
                          const SizedBox(height: 20),

                          // Card Principal
                          Container(
                            constraints: const BoxConstraints(maxWidth: 420),
                            padding: const EdgeInsets.all(22),
                            decoration: BoxDecoration(
                              color: isDark
                                  ? const Color(0xFF1E293B)
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black
                                      .withValues(alpha: isDark ? 0.3 : 0.05),
                                  blurRadius: 20,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Container(
                                  decoration: BoxDecoration(
                                    color: isDark
                                        ? const Color(0xFF0F172A)
                                        : const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: GestureDetector(
                                          onTap: () => setState(
                                              () => _isLoginTab = true),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(
                                                vertical: 10),
                                            decoration: BoxDecoration(
                                              color: _isLoginTab
                                                  ? (isDark
                                                      ? const Color(0xFF334155)
                                                      : Colors.white)
                                                  : Colors.transparent,
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                            ),
                                            child: const Center(
                                              child: Text('Iniciar Sesión',
                                                  style: TextStyle(
                                                      fontWeight:
                                                          FontWeight.w600,
                                                      fontSize: 13)),
                                            ),
                                          ),
                                        ),
                                      ),
                                      Expanded(
                                        child: GestureDetector(
                                          onTap: () => setState(
                                              () => _isLoginTab = false),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(
                                                vertical: 10),
                                            decoration: BoxDecoration(
                                              color: !_isLoginTab
                                                  ? (isDark
                                                      ? const Color(0xFF334155)
                                                      : Colors.white)
                                                  : Colors.transparent,
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                            ),
                                            child: const Center(
                                              child: Text('Crear Cuenta',
                                                  style: TextStyle(
                                                      fontWeight:
                                                          FontWeight.w600,
                                                      fontSize: 13)),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 18),
                                const Text('Correo electrónico o Gmail',
                                    style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w500)),
                                const SizedBox(height: 6),
                                TextField(
                                  controller: _emailController,
                                  decoration: InputDecoration(
                                    hintText: 'usuario@ejemplo.com',
                                    prefixIcon: const Icon(Icons.email_outlined,
                                        size: 18),
                                    contentPadding: const EdgeInsets.symmetric(
                                        vertical: 10),
                                    border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(8)),
                                  ),
                                ),
                                const SizedBox(height: 14),
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Contraseña',
                                        style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500)),
                                    if (_isLoginTab)
                                      GestureDetector(
                                        onTap: () {},
                                        child: const Text(
                                            '¿Olvidaste tu clave?',
                                            style: TextStyle(
                                                color: Colors.blue,
                                                fontSize: 11)),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                TextField(
                                  controller: _passwordController,
                                  obscureText: true,
                                  decoration: InputDecoration(
                                    hintText: '••••••••',
                                    prefixIcon: const Icon(Icons.lock_outline,
                                        size: 18),
                                    contentPadding: const EdgeInsets.symmetric(
                                        vertical: 10),
                                    border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(8)),
                                  ),
                                ),
                                const SizedBox(height: 18),
                                ElevatedButton(
                                  onPressed: _handleLogin,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF1E8E3E),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(
                                        vertical: 12),
                                    shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(8)),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        _isLoginTab
                                            ? 'Ingresar a la Consola'
                                            : 'Registrar Cuenta',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 14),
                                      ),
                                      const SizedBox(width: 8),
                                      const Icon(Icons.arrow_forward, size: 16),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 16),
                                Row(
                                  children: [
                                    Expanded(
                                        child: Divider(
                                            color: isDark
                                                ? Colors.white12
                                                : Colors.grey.shade300)),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8.0),
                                      child: Text('O INGRESAR CON',
                                          style: TextStyle(
                                              color: Colors.grey.shade500,
                                              fontSize: 10,
                                              fontWeight: FontWeight.w500)),
                                    ),
                                    Expanded(
                                        child: Divider(
                                            color: isDark
                                                ? Colors.white12
                                                : Colors.grey.shade300)),
                                  ],
                                ),
                                const SizedBox(height: 14),

                                // Botones con assets locales
                                GridView.count(
                                  crossAxisCount: 2,
                                  shrinkWrap: true,
                                  physics: const NeverScrollableScrollPhysics(),
                                  childAspectRatio: 3.2,
                                  crossAxisSpacing: 8,
                                  mainAxisSpacing: 8,
                                  children: [
                                    _socialNetworkButton(
                                        context, 'Google', _googleAsset),
                                    _socialNetworkButton(
                                        context, 'GitHub', _githubAsset),
                                    _socialNetworkButton(
                                        context, 'GitLab', _gitlabAsset),
                                    _socialNetworkButton(
                                        context, 'Microsoft', _microsoftAsset),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 12.0),
                  child: Text('SSPILLOWY Security Governance Platform • 2026',
                      style:
                          TextStyle(color: Colors.grey.shade500, fontSize: 11)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _socialNetworkButton(
      BuildContext context, String label, String assetPath) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return OutlinedButton(
      onPressed: _handleLogin,
      style: OutlinedButton.styleFrom(
        backgroundColor:
            isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
        side: BorderSide(color: isDark ? Colors.white12 : Colors.grey.shade300),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(horizontal: 8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 18,
            height: 18,
            child: Image.asset(
              assetPath,
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) =>
                  const Icon(Icons.link, size: 16),
            ),
          ),
          const SizedBox(width: 8),
          Text(label,
              style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 12,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class GridPainter extends CustomPainter {
  final bool isDark;
  GridPainter({required this.isDark});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color =
          isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey.shade200
      ..strokeWidth = 1.0;

    const double step = 24.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class MainDashboardScreen extends StatefulWidget {
  final String userName;
  final String userNickname;
  final String userEmail;
  final VoidCallback onToggleTheme;
  final ThemeMode currentMode;

  const MainDashboardScreen({
    super.key,
    required this.userName,
    required this.userNickname,
    required this.userEmail,
    required this.onToggleTheme,
    required this.currentMode,
  });

  @override
  State<MainDashboardScreen> createState() => _MainDashboardScreenState();
}

class _MainDashboardScreenState extends State<MainDashboardScreen> {
  late String userName;
  late String userNickname;

  bool _isScanning = false;
  double _scanProgress = 0.0;
  String _scanStatusText = 'Presiona un botón para realizar un escaneo.';

  int _vulnSast = 0;
  int _vulnSca = 0;
  int _vulnDast = 0;
  int _compliance = 100;

  @override
  void initState() {
    super.initState();
    userName = widget.userName;
    userNickname = widget.userNickname;
  }

  void _runInteractiveScan(String type) async {
    if (_isScanning) return;

    setState(() {
      _isScanning = true;
      _scanProgress = 0.1;
      _scanStatusText = 'Analizando infraestructura ($type)...';
    });

    for (int i = 1; i <= 10; i++) {
      await Future.delayed(const Duration(milliseconds: 250));
      if (!mounted) return;
      setState(() {
        _scanProgress = i / 10;
        _scanStatusText = 'Escaneando repositorio ($type) - ${(i * 10)}%';
      });
    }

    setState(() {
      _isScanning = false;
      _scanStatusText =
          '¡Escaneo $type completado! Se han actualizado los hallazgos.';

      if (type == 'SAST') {
        _vulnSast += 3;
        _compliance -= 2;
      }
      if (type == 'SCA') {
        _vulnSca += 2;
        _compliance -= 1;
      }
      if (type == 'DAST') {
        _vulnDast += 1;
        _compliance -= 2;
      }
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              'Auditoría $type finalizada. Vulnerabilidades detectadas agregadas al tablero.'),
          backgroundColor: const Color(0xFF1E8E3E),
        ),
      );
    }
  }

  void _openAIChat() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const IAChatModal(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            SizedBox(
              width: 28,
              height: 28,
              child: Image.asset('assets/logo_2.png', fit: BoxFit.contain),
            ),
            const SizedBox(width: 8),
            const Text('SSPILLOWY Console',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(isDark ? Icons.light_mode : Icons.dark_mode_outlined),
            onPressed: widget.onToggleTheme,
          ),
        ],
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(color: Color(0xFF4A3E85)),
              accountName: Text(userName,
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              accountEmail: Text('@$userNickname • ${widget.userEmail}'),
              currentAccountPicture: CircleAvatar(
                backgroundColor: Colors.white,
                child: Text(
                  userName.isNotEmpty ? userName[0].toUpperCase() : 'U',
                  style: const TextStyle(
                      fontSize: 24,
                      color: Color(0xFF4A3E85),
                      fontWeight: FontWeight.bold),
                ),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text('Cerrar Sesión',
                  style: TextStyle(color: Colors.red)),
              onTap: () {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(
                    builder: (context) => LoginScreen(
                      onToggleTheme: widget.onToggleTheme,
                      currentMode: widget.currentMode,
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              elevation: 1,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: const Color(0xFF4A3E85),
                      child: Text(
                        userName.isNotEmpty ? userName[0].toUpperCase() : 'U',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Bienvenido, $userName',
                              style: const TextStyle(
                                  fontSize: 16, fontWeight: FontWeight.bold)),
                          Text('@$userNickname',
                              style: const TextStyle(
                                  color: Colors.grey, fontSize: 13)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 18),
            Card(
              elevation: 1,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Ejecutar Escaneos DevSecOps',
                            style: TextStyle(
                                fontSize: 15, fontWeight: FontWeight.bold)),
                        if (_isScanning)
                          const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(_scanStatusText,
                        style: TextStyle(
                            color:
                                isDark ? Colors.white60 : Colors.grey.shade700,
                            fontSize: 12)),
                    const SizedBox(height: 12),
                    LinearProgressIndicator(
                      value: _isScanning ? _scanProgress : 0.0,
                      color: const Color(0xFF1E8E3E),
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        ElevatedButton.icon(
                          onPressed: _isScanning
                              ? null
                              : () => _runInteractiveScan('SAST'),
                          icon: const Icon(Icons.code, size: 16),
                          label: const Text('Escanear SAST'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF4A3E85),
                              foregroundColor: Colors.white),
                        ),
                        ElevatedButton.icon(
                          onPressed: _isScanning
                              ? null
                              : () => _runInteractiveScan('SCA'),
                          icon:
                              const Icon(Icons.inventory_2_outlined, size: 16),
                          label: const Text('Escanear SCA'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF1E88E5),
                              foregroundColor: Colors.white),
                        ),
                        ElevatedButton.icon(
                          onPressed: _isScanning
                              ? null
                              : () => _runInteractiveScan('DAST'),
                          icon: const Icon(Icons.bug_report_outlined, size: 16),
                          label: const Text('Escanear DAST'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFE53935),
                              foregroundColor: Colors.white),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Resumen de Vulnerabilidades',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.4,
              children: [
                _metricCard('SAST Findings', '$_vulnSast', Colors.deepPurple,
                    Icons.security),
                _metricCard('SCA Dependencies', '$_vulnSca', Colors.blue,
                    Icons.inventory_2),
                _metricCard('DAST Endpoints', '$_vulnDast', Colors.red,
                    Icons.bug_report),
                _metricCard('Compliance', '$_compliance%', Colors.green,
                    Icons.verified_user),
              ],
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openAIChat,
        backgroundColor: const Color(0xFF4A3E85),
        icon: const Icon(Icons.auto_awesome, color: Colors.amber),
        label: const Text('Asistente IA',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _metricCard(String title, String val, Color color, IconData icon) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 6),
            Text(val,
                style: TextStyle(
                    fontSize: 22, fontWeight: FontWeight.bold, color: color)),
            Text(title,
                style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}

class IAChatModal extends StatefulWidget {
  const IAChatModal({super.key});

  @override
  State<IAChatModal> createState() => _IAChatModalState();
}

class _IAChatModalState extends State<IAChatModal> {
  final TextEditingController _msgController = TextEditingController();
  final List<Map<String, String>> _messages = [
    {
      'sender': 'ai',
      'text':
          '¡Hola! Soy el asistente IA de SSPILLOWY. Haz un escaneo para analizar tus vulnerabilidades.'
    },
  ];

  void _sendMessage(String text) {
    if (text.trim().isEmpty) return;

    setState(() {
      _messages.add({'sender': 'user', 'text': text});
    });

    _msgController.clear();

    Future.delayed(const Duration(milliseconds: 500), () {
      if (!mounted) return;
      setState(() {
        _messages.add({
          'sender': 'ai',
          'text':
              'Análisis procesado. Se sugiere aplicar parches de seguridad en dependencias críticas de tu proyecto.'
        });
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              color: Color(0xFF4A3E85),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Row(
              children: [
                const Icon(Icons.auto_awesome, color: Colors.amber, size: 20),
                const SizedBox(width: 8),
                const Text('SSPILLOWY AI Copilot',
                    style: TextStyle(
                        color: Colors.white, fontWeight: FontWeight.bold)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                )
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final msg = _messages[index];
                final isUser = msg['sender'] == 'user';
                return Align(
                  alignment:
                      isUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: isUser
                          ? const Color(0xFF1E88E5)
                          : (isDark
                              ? const Color(0xFF334155)
                              : Colors.grey.shade200),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(msg['text']!,
                        style: const TextStyle(fontSize: 13)),
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: EdgeInsets.only(
              left: 12,
              right: 12,
              bottom: MediaQuery.of(context).viewInsets.bottom + 12,
              top: 8,
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _msgController,
                    decoration: InputDecoration(
                      hintText: 'Escribe tu consulta...',
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.send, color: Color(0xFF4A3E85)),
                  onPressed: () => _sendMessage(_msgController.text),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
