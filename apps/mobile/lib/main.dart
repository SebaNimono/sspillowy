import 'package:flutter/material.dart';

void main() {
  runApp(const SSPILLOWYApp());
}

class SSPILLOWYApp extends StatelessWidget {
  const SSPILLOWYApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SSPILLOWY',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E88E5),
          primary: const Color(0xFF1E88E5),
        ),
      ),
      home: const LoginScreen(),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoginTab = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() {
    final email = _emailController.text.trim();
    final userEmail = email.isEmpty ? 'usuario@ejemplo.com' : email;
    final initialName = userEmail.split('@').first;

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (context) => MainDashboardScreen(
          userName: initialName,
          userNickname: initialName.toLowerCase(),
          userEmail: userEmail,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: CustomPaint(painter: GridPainter()),
          ),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Align(
                    alignment: Alignment.topLeft,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.shield_outlined, size: 18, color: Colors.indigo),
                          SizedBox(width: 6),
                          Text('SSPILLOWY', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        ],
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 70,
                            height: 70,
                            decoration: BoxDecoration(
                              color: const Color(0xFF4A3E85),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Center(
                              child: Text(
                                'S',
                                style: TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Iniciar sesión en SSPILLOWY',
                            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                          ),
                          const SizedBox(height: 4),
                          const Text('Plataforma Integral de Gobernanza DevSecOps', style: TextStyle(color: Colors.grey, fontSize: 13)),
                          const SizedBox(height: 24),
                          Container(
                            constraints: const BoxConstraints(maxWidth: 420),
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.05),
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
                                    color: const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: GestureDetector(
                                          onTap: () => setState(() => _isLoginTab = true),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(vertical: 10),
                                            decoration: BoxDecoration(
                                              color: _isLoginTab ? Colors.white : Colors.transparent,
                                              borderRadius: BorderRadius.circular(8),
                                              boxShadow: _isLoginTab ? [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4)] : [],
                                            ),
                                            child: const Center(
                                              child: Text('Iniciar Sesión', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                            ),
                                          ),
                                        ),
                                      ),
                                      Expanded(
                                        child: GestureDetector(
                                          onTap: () => setState(() => _isLoginTab = false),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(vertical: 10),
                                            decoration: BoxDecoration(
                                              color: !_isLoginTab ? Colors.white : Colors.transparent,
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: const Center(
                                              child: Text('Crear Cuenta', style: TextStyle(color: Colors.grey, fontSize: 13)),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 20),
                                const Text('Correo electrónico o Gmail', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                                const SizedBox(height: 6),
                                TextField(
                                  controller: _emailController,
                                  decoration: InputDecoration(
                                    hintText: 'usuario@ejemplo.com',
                                    hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                                    prefixIcon: const Icon(Icons.email_outlined, size: 20),
                                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
                                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
                                  ),
                                ),
                                const SizedBox(height: 16),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Contraseña', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                                    GestureDetector(
                                      onTap: () {},
                                      child: const Text('¿Olvidaste tu clave?', style: TextStyle(color: Colors.blue, fontSize: 12)),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                TextField(
                                  controller: _passwordController,
                                  obscureText: true,
                                  decoration: InputDecoration(
                                    hintText: '••••••••',
                                    hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                                    prefixIcon: const Icon(Icons.lock_outline, size: 20),
                                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
                                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
                                  ),
                                ),
                                const SizedBox(height: 20),
                                ElevatedButton(
                                  onPressed: _handleLogin,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF1E8E3E),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                    elevation: 0,
                                  ),
                                  child: const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text('Ingresar a la Consola', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                      SizedBox(width: 8),
                                      Icon(Icons.arrow_forward, size: 18),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 20),
                                Row(
                                  children: [
                                    Expanded(child: Divider(color: Colors.grey.shade300)),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 8.0),
                                      child: Text('O INGRESAR CON', style: TextStyle(color: Colors.grey.shade500, fontSize: 11, fontWeight: FontWeight.w500)),
                                    ),
                                    Expanded(child: Divider(color: Colors.grey.shade300)),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                GridView.count(
                                  crossAxisCount: 2,
                                  shrinkWrap: true,
                                  physics: const NeverScrollableScrollPhysics(),
                                  childAspectRatio: 3.2,
                                  crossAxisSpacing: 10,
                                  mainAxisSpacing: 10,
                                  children: [
                                    _socialButton(Icons.g_mobiledata, 'Google'),
                                    _socialButton(Icons.code, 'GitHub'),
                                    _socialButton(Icons.alt_route, 'GitLab'),
                                    _socialButton(Icons.window, 'Microsoft'),
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
                  padding: const EdgeInsets.only(bottom: 16.0),
                  child: Text('SSPILLOWY Security Governance Platform • 2026', style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _socialButton(IconData icon, String label) {
    return OutlinedButton.icon(
      onPressed: _handleLogin,
      icon: Icon(icon, size: 18, color: Colors.black87),
      label: Text(label, style: const TextStyle(color: Colors.black87, fontSize: 12, fontWeight: FontWeight.w600)),
      style: OutlinedButton.styleFrom(
        backgroundColor: const Color(0xFFF8FAFC),
        side: BorderSide(color: Colors.grey.shade300),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }
}

class GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.grey.shade200
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

  const MainDashboardScreen({
    super.key,
    required this.userName,
    required this.userNickname,
    required this.userEmail,
  });

  @override
  State<MainDashboardScreen> createState() => _MainDashboardScreenState();
}

class _MainDashboardScreenState extends State<MainDashboardScreen> {
  late String userName;
  late String userNickname;

  bool _isScanning = false;
  double _scanProgress = 0.0;
  String _scanStatusText = 'Sistema listo para auditoría';
  int _vulnSast = 14;
  int _vulnSca = 5;
  int _vulnDast = 2;

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
      _scanStatusText = 'Iniciando escaneo $type...';
    });

    for (int i = 1; i <= 10; i++) {
      await Future.delayed(const Duration(milliseconds: 300));
      if (!mounted) return;
      setState(() {
        _scanProgress = i / 10;
        _scanStatusText = 'Analizando código ($type) - ${(i * 10)}%';
      });
    }

    setState(() {
      _isScanning = false;
      _scanStatusText = '¡Escaneo $type completado exitosamente!';
      if (type == 'SAST') _vulnSast += 2;
      if (type == 'SCA') _vulnSca += 1;
      if (type == 'DAST') _vulnDast += 1;
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Análisis $type finalizado. Se han actualizado los indicadores.'),
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('SSPILLOWY Console', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 1,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(color: Color(0xFF4A3E85)),
              accountName: Text(userName, style: const TextStyle(fontWeight: FontWeight.bold)),
              accountEmail: Text('@$userNickname • ${widget.userEmail}'),
              currentAccountPicture: CircleAvatar(
                backgroundColor: Colors.white,
                child: Text(
                  userName.isNotEmpty ? userName[0].toUpperCase() : 'U',
                  style: const TextStyle(fontSize: 24, color: Color(0xFF4A3E85), fontWeight: FontWeight.bold),
                ),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.person_outline),
              title: const Text('Editar Perfil'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => EditProfileScreen(
                      currentName: userName,
                      currentNickname: userNickname,
                      onSave: (newName, newNick) {
                        setState(() {
                          userName = newName;
                          userNickname = newNick;
                        });
                      },
                    ),
                  ),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text('Cerrar Sesión', style: TextStyle(color: Colors.red)),
              onTap: () {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (context) => const LoginScreen()),
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
              color: Colors.white,
              elevation: 1,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: const Color(0xFF4A3E85),
                      child: Text(
                        userName.isNotEmpty ? userName[0].toUpperCase() : 'U',
                        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Bienvenido, $userName', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          Text('@$userNickname', style: const TextStyle(color: Colors.grey, fontSize: 13)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            Card(
              color: Colors.white,
              elevation: 1,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Ejecutar Escaneos DevSecOps', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                        if (_isScanning)
                          const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(_scanStatusText, style: TextStyle(color: Colors.grey.shade700, fontSize: 12)),
                    const SizedBox(height: 12),
                    LinearProgressIndicator(
                      value: _isScanning ? _scanProgress : 0.0,
                      backgroundColor: Colors.grey.shade200,
                      color: const Color(0xFF1E8E3E),
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        ElevatedButton.icon(
                          onPressed: _isScanning ? null : () => _runInteractiveScan('SAST'),
                          icon: const Icon(Icons.code, size: 16),
                          label: const Text('Escanear SAST'),
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF4A3E85), foregroundColor: Colors.white),
                        ),
                        ElevatedButton.icon(
                          onPressed: _isScanning ? null : () => _runInteractiveScan('SCA'),
                          icon: const Icon(Icons.inventory_2_outlined, size: 16),
                          label: const Text('Escanear SCA'),
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1E88E5), foregroundColor: Colors.white),
                        ),
                        ElevatedButton.icon(
                          onPressed: _isScanning ? null : () => _runInteractiveScan('DAST'),
                          icon: const Icon(Icons.bug_report_outlined, size: 16),
                          label: const Text('Escanear DAST'),
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE53935), foregroundColor: Colors.white),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Resumen de Vulnerabilidades', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.4,
              children: [
                _metricCard('SAST Findings', '$_vulnSast', Colors.deepPurple, Icons.security),
                _metricCard('SCA Dependencies', '$_vulnSca', Colors.blue, Icons.inventory_2),
                _metricCard('DAST Endpoints', '$_vulnDast', Colors.red, Icons.bug_report),
                _metricCard('Compliance', '94%', Colors.green, Icons.verified_user),
              ],
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openAIChat,
        backgroundColor: const Color(0xFF4A3E85),
        icon: const Icon(Icons.auto_awesome, color: Colors.amber),
        label: const Text('Asistente IA', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _metricCard(String title, String val, Color color, IconData icon) {
    return Card(
      color: Colors.white,
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
            Text(val, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
            Text(title, style: const TextStyle(fontSize: 11, color: Colors.grey)),
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
    {'sender': 'ai', 'text': '¡Hola! Soy la IA de SSPILLOWY. ¿En qué auditoría de seguridad te puedo ayudar?'},
  ];

  void _sendMessage(String text) {
    if (text.trim().isEmpty) return;

    setState(() {
      _messages.add({'sender': 'user', 'text': text});
    });

    _msgController.clear();

    Future.delayed(const Duration(milliseconds: 600), () {
      if (!mounted) return;
      setState(() {
        if (text.toLowerCase().contains('sast')) {
          _messages.add({
            'sender': 'ai',
            'text': 'El módulo SAST analizó el código. Se recomienda sanitizar entradas en la ruta /api/v1/login para prevenir SQL Injection.'
          });
        } else if (text.toLowerCase().contains('dast')) {
          _messages.add({
            'sender': 'ai',
            'text': 'El análisis dinámico DAST detectó cabeceras HTTP inseguras. Agrega X-Content-Type-Options: nosniff.'
          });
        } else {
          _messages.add({
            'sender': 'ai',
            'text': 'Análisis completado para "$text". Todo parece cumplir con los estándares de gobernanza ISO 27001.'
          });
        }
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
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
                const Text('SSPILLOWY AI Copilot', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                )
              ],
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.all(8.0),
            child: Row(
              children: [
                _chipPrompt('¿Cómo corregir SAST?'),
                _chipPrompt('Analizar reporte DAST'),
                _chipPrompt('Estado de cumplimiento'),
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
                  alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: isUser ? const Color(0xFF1E88E5) : Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      msg['text']!,
                      style: TextStyle(color: isUser ? Colors.white : Colors.black87, fontSize: 13),
                    ),
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
                      hintText: 'Escribe tu consulta a la IA...',
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
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

  Widget _chipPrompt(String label) {
    return ActionChip(
      label: Text(label, style: const TextStyle(fontSize: 11)),
      onPressed: () => _sendMessage(label),
      backgroundColor: const Color(0xFFF1F5F9),
    );
  }
}

class EditProfileScreen extends StatefulWidget {
  final String currentName;
  final String currentNickname;
  final Function(String, String) onSave;

  const EditProfileScreen({
    super.key,
    required this.currentName,
    required this.currentNickname,
    required this.onSave,
  });

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late TextEditingController _nameController;
  late TextEditingController _nicknameController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.currentName);
    _nicknameController = TextEditingController(text: widget.currentNickname);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _nicknameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Editar Perfil')),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Nombre Completo'),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _nicknameController,
              decoration: const InputDecoration(labelText: 'Nickname'),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  widget.onSave(_nameController.text.trim(), _nicknameController.text.trim());
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1E88E5), foregroundColor: Colors.white),
                child: const Text('Guardar Cambios'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}