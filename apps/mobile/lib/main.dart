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
      _themeMode = _themeMode == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
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
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoginTab = true;
  bool _isLoadingSocial = false;

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

  void _handleForgotPassword() {
    final resetEmailController = TextEditingController(text: _emailController.text);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.lock_reset, color: Color(0xFF4A3E85)),
            SizedBox(width: 8),
            Text('Restablecer clave', style: TextStyle(fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Ingresa tu correo institucional para recibir instrucciones de recuperación:',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: resetEmailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Correo electrónico',
                prefixIcon: Icon(Icons.email_outlined),
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              final email = resetEmailController.text.trim();
              if (email.isNotEmpty && email.contains('@')) {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Se ha enviado un enlace de recuperación a: $email'),
                    backgroundColor: const Color(0xFF1E8E3E),
                  ),
                );
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Por favor ingresa un correo válido.'),
                    backgroundColor: Colors.red,
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF4A3E85),
              foregroundColor: Colors.white,
            ),
            child: const Text('Enviar enlace'),
          ),
        ],
      ),
    );
  }

  void _handleLogin() {
    if (_formKey.currentState?.validate() ?? false) {
      final email = _emailController.text.trim();
      final initialName = email.split('@').first;
      final capitalizedName = initialName.isNotEmpty
          ? '${initialName[0].toUpperCase()}${initialName.substring(1)}'
          : 'Pedro Rodriguez';

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => MainDashboardScreen(
            userName: capitalizedName.contains('Pedro') ? capitalizedName : 'Pedro Rodriguez',
            userNickname: initialName.toLowerCase(),
            userEmail: email,
            onToggleTheme: widget.onToggleTheme,
            currentMode: widget.currentMode,
          ),
        ),
      );
    }
  }

  void _handleSocialSSO(String provider) async {
    setState(() => _isLoadingSocial = true);
    await Future.delayed(const Duration(seconds: 1));
    if (!mounted) return;
    setState(() => _isLoadingSocial = false);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.security, color: Color(0xFF4A3E85)),
            const SizedBox(width: 8),
            Text('Autenticación $provider'),
          ],
        ),
        content: Text(
          'Se requiere vincular la cuenta corporativa de $provider para acceder a la consola DevSecOps.\n\n'
          'Ingresa tu correo en el formulario principal para continuar.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Entendido'),
          ),
        ],
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
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF1E293B) : Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: isDark ? Colors.white12 : Colors.grey.shade300),
                        ),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 18,
                              height: 18,
                              child: Image.asset(
                                _innerLogoAsset,
                                fit: BoxFit.contain,
                                errorBuilder: (_, __, ___) => const Icon(Icons.shield, size: 16, color: Color(0xFF4A3E85)),
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Text('SSPILLOWY Console', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: Icon(isDark ? Icons.light_mode : Icons.dark_mode_outlined),
                        onPressed: widget.onToggleTheme,
                        tooltip: 'Cambiar Modo',
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 24.0),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              margin: const EdgeInsets.only(bottom: 16.0),
                              constraints: const BoxConstraints(maxWidth: 280, maxHeight: 120),
                              child: AspectRatio(
                                aspectRatio: 2.2,
                                child: Image.asset(
                                  _mainLogoAsset,
                                  fit: BoxFit.contain,
                                  alignment: Alignment.center,
                                  errorBuilder: (context, error, stackTrace) {
                                    return Image.asset(_innerLogoAsset, fit: BoxFit.contain);
                                  },
                                ),
                              ),
                            ),
                            Text(
                              _isLoginTab ? 'Iniciar sesión en SSPILLOWY' : 'Crear tu cuenta en SSPILLOWY',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: isDark ? Colors.white70 : Colors.black87,
                              ),
                            ),
                            const SizedBox(height: 2),
                            const Text('Plataforma Integral de Gobernanza DevSecOps', style: TextStyle(color: Colors.grey, fontSize: 12)),
                            const SizedBox(height: 20),
                            Container(
                              constraints: const BoxConstraints(maxWidth: 420),
                              padding: const EdgeInsets.all(22),
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF1E293B) : Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
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
                                      color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
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
                                                color: _isLoginTab
                                                    ? (isDark ? const Color(0xFF334155) : Colors.white)
                                                    : Colors.transparent,
                                                borderRadius: BorderRadius.circular(8),
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
                                                color: !_isLoginTab
                                                    ? (isDark ? const Color(0xFF334155) : Colors.white)
                                                    : Colors.transparent,
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: const Center(
                                                child: Text('Crear Cuenta', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 18),
                                  const Text('Correo electrónico', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                                  const SizedBox(height: 6),
                                  TextFormField(
                                    controller: _emailController,
                                    keyboardType: TextInputType.emailAddress,
                                    validator: (value) {
                                      if (value == null || value.trim().isEmpty) {
                                        return 'Por favor ingresa tu correo';
                                      }
                                      if (!value.contains('@') || !value.contains('.')) {
                                        return 'Ingresa un correo válido (ej: usuario@empresa.com)';
                                      }
                                      return null;
                                    },
                                    decoration: InputDecoration(
                                      hintText: 'usuario@sspillowy.com',
                                      prefixIcon: const Icon(Icons.email_outlined, size: 18),
                                      contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                    ),
                                  ),
                                  const SizedBox(height: 14),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text('Contraseña', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                                      if (_isLoginTab)
                                        GestureDetector(
                                          onTap: _handleForgotPassword,
                                          child: const Text('¿Olvidaste tu clave?', style: TextStyle(color: Colors.blue, fontSize: 11, fontWeight: FontWeight.w600)),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  TextFormField(
                                    controller: _passwordController,
                                    obscureText: true,
                                    validator: (value) {
                                      if (value == null || value.trim().isEmpty) {
                                        return 'Por favor ingresa tu contraseña';
                                      }
                                      if (value.length < 4) {
                                        return 'La contraseña debe tener al menos 4 caracteres';
                                      }
                                      return null;
                                    },
                                    decoration: InputDecoration(
                                      hintText: '••••••••',
                                      prefixIcon: const Icon(Icons.lock_outline, size: 18),
                                      contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                    ),
                                  ),
                                  const SizedBox(height: 18),
                                  ElevatedButton(
                                    onPressed: _handleLogin,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF1E8E3E),
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                    ),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          _isLoginTab ? 'Ingresar a la Consola' : 'Registrar Cuenta',
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                        ),
                                        const SizedBox(width: 8),
                                        const Icon(Icons.arrow_forward, size: 16),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  Row(
                                    children: [
                                      Expanded(child: Divider(color: isDark ? Colors.white12 : Colors.grey.shade300)),
                                      Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 8.0),
                                        child: Text('O SSO PROVIDERS', style: TextStyle(color: Colors.grey.shade500, fontSize: 10, fontWeight: FontWeight.w500)),
                                      ),
                                      Expanded(child: Divider(color: isDark ? Colors.white12 : Colors.grey.shade300)),
                                    ],
                                  ),
                                  const SizedBox(height: 14),
                                  if (_isLoadingSocial)
                                    const Center(child: Padding(padding: EdgeInsets.all(8.0), child: CircularProgressIndicator()))
                                  else
                                    GridView.count(
                                      crossAxisCount: 2,
                                      shrinkWrap: true,
                                      physics: const NeverScrollableScrollPhysics(),
                                      childAspectRatio: 3.2,
                                      crossAxisSpacing: 8,
                                      mainAxisSpacing: 8,
                                      children: [
                                        _socialButton(context, 'Google', _googleAsset, Colors.red, Icons.g_mobiledata),
                                        _socialButton(context, 'GitHub', _githubAsset, isDark ? Colors.white : Colors.black, Icons.code),
                                        _socialButton(context, 'GitLab', _gitlabAsset, Colors.orange, Icons.alt_route),
                                        _socialButton(context, 'Microsoft', _microsoftAsset, Colors.blue, Icons.window),
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
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 12.0),
                  child: Text('SSPILLOWY Security Governance Platform • 2026', style: TextStyle(color: Colors.grey.shade500, fontSize: 11)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _socialButton(BuildContext context, String label, String assetPath, Color fallbackColor, IconData fallbackIcon) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return OutlinedButton(
      onPressed: () => _handleSocialSSO(label),
      style: OutlinedButton.styleFrom(
        backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
        side: BorderSide(color: isDark ? Colors.white12 : Colors.grey.shade300),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(horizontal: 6),
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
              errorBuilder: (_, __, ___) => Icon(fallbackIcon, size: 18, color: fallbackColor),
            ),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
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
      ..color = isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey.shade200
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
  int _selectedNavIndex = 0;

  late String userName;
  late String userNickname;
  String userRole = 'DevSecOps Lead';
  String userDept = 'Ingeniería & Ciberseguridad';
  String avatarUrl = '';
  int selectedPresetAvatar = 0;

  @override
  void initState() {
    super.initState();
    userName = widget.userName;
    userNickname = widget.userNickname;
  }

  void _editUserProfile() {
    final nameController = TextEditingController(text: userName);
    final nicknameController = TextEditingController(text: userNickname);
    final roleController = TextEditingController(text: userRole);
    final deptController = TextEditingController(text: userDept);
    final urlController = TextEditingController(text: avatarUrl);
    int tempPreset = selectedPresetAvatar;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).brightness == Brightness.dark
          ? const Color(0xFF1E293B)
          : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                top: 20,
                left: 20,
                right: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.manage_accounts, color: Color(0xFF4A3E85)),
                            SizedBox(width: 8),
                            Text('Personalizar Perfil y Avatar',
                                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                    const Divider(),
                    const SizedBox(height: 10),
                    const Text('Selecciona tu Avatar:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        _avatarOption(0, Icons.person, 'Inicial', tempPreset, (val) => setModalState(() => tempPreset = val)),
                        _avatarOption(1, Icons.shield, 'Escudo', tempPreset, (val) => setModalState(() => tempPreset = val)),
                        _avatarOption(2, Icons.code, 'Dev', tempPreset, (val) => setModalState(() => tempPreset = val)),
                        _avatarOption(3, Icons.terminal, 'Cli', tempPreset, (val) => setModalState(() => tempPreset = val)),
                        _avatarOption(4, Icons.security, 'Sec', tempPreset, (val) => setModalState(() => tempPreset = val)),
                      ],
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: urlController,
                      decoration: const InputDecoration(
                        labelText: 'O pega la URL de tu foto/avatar',
                        prefixIcon: Icon(Icons.link),
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: nameController,
                      decoration: const InputDecoration(
                        labelText: 'Nombre completo',
                        prefixIcon: Icon(Icons.person),
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: nicknameController,
                      decoration: const InputDecoration(
                        labelText: 'Nickname / User ID',
                        prefixIcon: Icon(Icons.alternate_email),
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: roleController,
                      decoration: const InputDecoration(
                        labelText: 'Cargo / Rol',
                        prefixIcon: Icon(Icons.badge_outlined),
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: deptController,
                      decoration: const InputDecoration(
                        labelText: 'Departamento / Área',
                        prefixIcon: Icon(Icons.business),
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          if (nameController.text.trim().isNotEmpty) {
                            setState(() {
                              userName = nameController.text.trim();
                              userNickname = nicknameController.text.trim();
                              userRole = roleController.text.trim();
                              userDept = deptController.text.trim();
                              avatarUrl = urlController.text.trim();
                              selectedPresetAvatar = tempPreset;
                            });
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('¡Perfil actualizado correctamente!'),
                                backgroundColor: Color(0xFF1E8E3E),
                              ),
                            );
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4A3E85),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: const Text('Guardar Cambios'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _avatarOption(int index, IconData icon, String label, int currentSelected, Function(int) onSelect) {
    final isSelected = currentSelected == index;
    return GestureDetector(
      onTap: () => onSelect(index),
      child: Column(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: isSelected ? const Color(0xFF4A3E85) : Colors.grey.shade300,
            child: Icon(icon, size: 20, color: isSelected ? Colors.white : Colors.black87),
          ),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(fontSize: 10, color: isSelected ? const Color(0xFF4A3E85) : Colors.grey)),
        ],
      ),
    );
  }

  Widget _buildAvatarWidget({double radius = 20, double fontSize = 16}) {
    if (avatarUrl.isNotEmpty) {
      return CircleAvatar(
        radius: radius,
        backgroundImage: NetworkImage(avatarUrl),
        backgroundColor: Colors.transparent,
      );
    }

    IconData icon = Icons.person;
    switch (selectedPresetAvatar) {
      case 1:
        icon = Icons.shield;
        break;
      case 2:
        icon = Icons.code;
        break;
      case 3:
        icon = Icons.terminal;
        break;
      case 4:
        icon = Icons.security;
        break;
      default:
        return CircleAvatar(
          radius: radius,
          backgroundColor: const Color(0xFF1E88E5),
          child: Text(
            userName.isNotEmpty ? userName[0].toUpperCase() : 'P',
            style: TextStyle(color: Colors.white, fontSize: fontSize, fontWeight: FontWeight.bold),
          ),
        );
    }

    return CircleAvatar(
      radius: radius,
      backgroundColor: const Color(0xFF1E88E5),
      child: Icon(icon, color: Colors.white, size: radius * 1.1),
    );
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

    final navItems = [
      {'icon': Icons.grid_view_rounded, 'title': 'Dashboard General'},
      {'icon': Icons.folder_open_rounded, 'title': 'Repositorios'},
      {'icon': Icons.gavel_rounded, 'title': 'Matriz de Hallazgos'},
      {'icon': Icons.radar_rounded, 'title': 'Escaneos'},
      {'icon': Icons.tune_rounded, 'title': 'Security Gates (CI/CD)'},
      {'icon': Icons.notifications_none_rounded, 'title': 'Notificaciones'},
      {'icon': Icons.description_outlined, 'title': 'Informes ISO 27001'},
    ];

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            SizedBox(
              width: 22,
              height: 22,
              child: Image.asset('assets/logo_2.png', fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Icon(Icons.shield, size: 20)),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                navItems[_selectedNavIndex]['title'] as String,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
          ],
        ),
        actions: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFE0F2FE),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Row(
              children: [
                Icon(Icons.show_chart, size: 14, color: Color(0xFF0284C7)),
                SizedBox(width: 4),
                Text('82/100', style: TextStyle(color: Color(0xFF0284C7), fontWeight: FontWeight.bold, fontSize: 11)),
              ],
            ),
          ),
          const SizedBox(width: 6),
          IconButton(
            icon: Icon(isDark ? Icons.light_mode : Icons.dark_mode_outlined, size: 20),
            onPressed: widget.onToggleTheme,
          ),
        ],
      ),
      drawer: Drawer(
        backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFF1E293B),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.only(top: 40, left: 16, right: 16, bottom: 16),
              color: isDark ? const Color(0xFF0F172A) : const Color(0xFF1E293B),
              child: Row(
                children: [
                  SizedBox(
                    width: 32,
                    height: 32,
                    child: Image.asset('assets/logo_2.png', fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Icon(Icons.shield, color: Colors.white)),
                  ),
                  const SizedBox(width: 10),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('SSPILLOWY', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                      Text('WEB HUB • DEVSECOPS', style: TextStyle(color: Colors.grey, fontSize: 9)),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(color: Colors.white12, height: 1),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: navItems.length,
                itemBuilder: (context, index) {
                  final isSelected = _selectedNavIndex == index;
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    child: ListTile(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      tileColor: isSelected ? const Color(0xFF334155) : Colors.transparent,
                      leading: Icon(
                        navItems[index]['icon'] as IconData,
                        color: isSelected ? Colors.white : Colors.grey.shade400,
                        size: 20,
                      ),
                      title: Text(
                        navItems[index]['title'] as String,
                        style: TextStyle(
                          color: isSelected ? Colors.white : Colors.grey.shade300,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          fontSize: 13,
                        ),
                      ),
                      onTap: () {
                        setState(() => _selectedNavIndex = index);
                        Navigator.pop(context);
                      },
                    ),
                  );
                },
              ),
            ),
            const Divider(color: Colors.white12, height: 1),
            ListTile(
              leading: _buildAvatarWidget(radius: 16, fontSize: 13),
              title: Text(userName, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
              subtitle: Text('@$userNickname', style: const TextStyle(color: Colors.grey, fontSize: 11)),
              trailing: IconButton(
                icon: const Icon(Icons.edit_outlined, color: Colors.grey, size: 18),
                onPressed: () {
                  Navigator.pop(context);
                  _editUserProfile();
                },
              ),
            ),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.redAccent, size: 20),
              title: const Text('Cerrar Sesión', style: TextStyle(color: Colors.redAccent, fontSize: 13)),
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
            const SizedBox(height: 12),
          ],
        ),
      ),
      body: _buildSelectedView(_selectedNavIndex, isDark),
      floatingActionButton: FloatingActionButton(
        onPressed: _openAIChat,
        backgroundColor: const Color(0xFF4A3E85),
        tooltip: 'Asistente IA',
        child: const Icon(Icons.auto_awesome, color: Colors.amber),
      ),
    );
  }

  Widget _buildSelectedView(int index, bool isDark) {
    switch (index) {
      case 0:
        return _buildDashboardView(isDark);
      case 1:
        return _buildReposView(isDark);
      case 2:
        return _buildFindingsView(isDark);
      case 3:
        return _buildScansView(isDark);
      case 4:
        return _buildGatesView(isDark);
      case 5:
        return _buildNotificationsView(isDark);
      case 6:
        return _buildIsoView(isDark);
      default:
        return _buildDashboardView(isDark);
    }
  }

  Widget _buildDashboardView(bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E293B) : const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              children: [
                Icon(Icons.circle, color: Colors.green, size: 10),
                SizedBox(width: 8),
                Text('LIVE  orquestación activa  |  tick #18  |  7 hallazgos abiertos',
                    style: TextStyle(color: Colors.white, fontSize: 11, fontFamily: 'monospace')),
              ],
            ),
          ),
          const SizedBox(height: 14),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.3,
            children: [
              _metricTile('REPOSITORIOS MONITOREADOS', '3', 'activos', Colors.blue, Icons.developer_board, isDark),
              _metricTile('VULNERABILIDADES CRÍTICAS', '3', 'abiertas', Colors.red, Icons.error_outline, isDark),
              _metricTile('SECRETOS PREVENIDOS', '14', 'bloqueados', Colors.green, Icons.key_outlined, isDark),
              _metricTile('ESCANEOS EJECUTADOS', '48', 'histórico', Colors.purple, Icons.verified_user_outlined, isDark),
            ],
          ),
          const SizedBox(height: 16),
          Card(
            elevation: 1,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Health Score General', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      Stack(
                        alignment: Alignment.center,
                        children: [
                          const SizedBox(
                            width: 80,
                            height: 80,
                            child: CircularProgressIndicator(value: 0.82, strokeWidth: 8, color: Colors.green),
                          ),
                          Column(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              Text('82', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                              Text('/100', style: TextStyle(fontSize: 10, color: Colors.grey)),
                            ],
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Row(children: [Icon(Icons.circle, color: Colors.red, size: 10), SizedBox(width: 6), Text('Críticas: 3', style: TextStyle(fontSize: 12))]),
                          SizedBox(height: 4),
                          Row(children: [Icon(Icons.circle, color: Colors.amber, size: 10), SizedBox(width: 6), Text('Altas: 3', style: TextStyle(fontSize: 12))]),
                          SizedBox(height: 4),
                          Row(children: [Icon(Icons.circle, color: Colors.blue, size: 10), SizedBox(width: 6), Text('Medias: 1', style: TextStyle(fontSize: 12))]),
                          SizedBox(height: 4),
                          Row(children: [Icon(Icons.circle, color: Colors.grey, size: 10), SizedBox(width: 6), Text('Bajas: 0', style: TextStyle(fontSize: 12))]),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReposView(bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Repositorios Monitoreados (3)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Nuevo', style: TextStyle(fontSize: 12)),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1E8E3E), foregroundColor: Colors.white),
            )
          ],
        ),
        const SizedBox(height: 12),
        _repoCard('sspillowy-backend-api', 'github.com/org/sspillowy-backend', 'main', '88%', '1 Críticas', Colors.green, isDark),
        _repoCard('payment-gateway-service', 'github.com/org/payment-gateway', 'develop', '62%', '3 Críticas', Colors.red, isDark),
        _repoCard('auth-identity-provider', 'github.com/org/auth-service', 'main', '95%', '0 Críticas', Colors.green, isDark),
      ],
    );
  }

  Widget _buildFindingsView(bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Vulnerabilidades & Secretos Detectados (7)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 12),
        _findingCard('Hardcoded AWS Secret Key detected in repository history', 'GITLEAKS', 'CRÍTICO', 'OPEN', 'apps/api/config/aws_client.py:42', '98%', isDark),
        _findingCard('Potential SQL Injection in dynamic query concatenation', 'SEMGREP', 'CRÍTICO', 'OPEN', 'src/services/user_search.py:115', '94%', isDark),
        _findingCard('CVE-2024-21626: container breakout vulnerability in runc', 'TRIVY', 'ALTO', 'OPEN', 'Dockerfile:1', '89%', isDark),
        _findingCard('Missing HTTP Strict-Transport-Security Header', 'OWASP_ZAP', 'MEDIO', 'IN_REVIEW', '/api/v1/auth/login', '91%', isDark),
      ],
    );
  }

  Widget _buildScansView(bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Historial de escaneos (4)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 12),
        _scanRow('scan-101', 'sspillowy-backend-api', 'COMPLETED', 'main', '1 Crítica', isDark),
        _scanRow('scan-102', 'payment-gateway-service', 'COMPLETED', 'develop', '3 Críticas', isDark),
        _scanRow('scan-103', 'auth-identity-provider', 'COMPLETED', 'main', '0 Críticas', isDark),
        _scanRow('scan-104', 'payment-gateway-service', 'RUNNING', 'develop', '0 Críticas', isDark),
      ],
    );
  }

  Widget _buildGatesView(bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Configuración de Política Activa', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 12),
        Card(
          elevation: 1,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Máximo de Vulnerabilidades Críticas Permitidas', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red)),
                const SizedBox(height: 6),
                const Text('Si un escaneo detecta un número mayor de fallos CRITICAL, el pipeline CI/CD se bloqueará.', style: TextStyle(fontSize: 11, color: Colors.grey)),
                const SizedBox(height: 10),
                TextFormField(initialValue: '0', decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        Card(
          elevation: 1,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Máximo de Vulnerabilidades Altas (HIGH) Permitidas', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.amber)),
                const SizedBox(height: 6),
                const Text('Umbral de advertencia severa antes de abortar la integración.', style: TextStyle(fontSize: 11, color: Colors.grey)),
                const SizedBox(height: 10),
                TextFormField(initialValue: '2', decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildNotificationsView(bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Notificaciones Recientes', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 12),
        _notifTile('Secreto AWS expuesto en sspillowy-backend-api', 'GitLeaks detectó clave activa en historial.', 'Hace 10 min', isDark),
        _notifTile('Security Gate bloqueó el pipeline de payment-gateway', 'Umbral de 0 críticas excedido.', 'Hace 30 min', isDark),
        _notifTile('Triaje IA listo: SQL Injection en user_search.py', 'Confianza 94%. Esperando validación humana.', 'Hace 2 horas', isDark),
      ],
    );
  }

  Widget _buildIsoView(bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Paquete de evidencia ISO 27001', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 12),
        _isoTile('A.8.8', 'Gestión de vulnerabilidades técnicas', 'Parcial', 'TRIVY', '1', isDark),
        _isoTile('A.8.9', 'Gestión de configuración', 'Parcial', 'OWASP_ZAP', '2', isDark),
        _isoTile('A.8.28', 'Codificación segura', 'Parcial', 'SEMGREP', '2', isDark),
        _isoTile('A.8.5', 'Autenticación segura', 'Brecha', 'GITLEAKS', '1', isDark),
      ],
    );
  }

  Widget _metricTile(String title, String val, String subtitle, Color color, IconData icon, bool isDark) {
    return Card(
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(child: Text(title, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey), overflow: TextOverflow.ellipsis)),
                Icon(icon, color: color, size: 16),
              ],
            ),
            const Spacer(),
            Text(val, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
            Text(subtitle, style: const TextStyle(fontSize: 10, color: Colors.grey)),
          ],
        ),
      ),
    );
  }

  Widget _repoCard(String name, String url, String branch, String score, String criticals, Color color, bool isDark) {
    return Card(
      elevation: 1,
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        subtitle: Text('$url • $branch\n$criticals', style: const TextStyle(fontSize: 11)),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: color.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(6)),
          child: Text(score, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12)),
        ),
      ),
    );
  }

  Widget _findingCard(String title, String engine, String severity, String status, String path, String conf, bool isDark) {
    return Card(
      elevation: 1,
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: severity == 'CRÍTICO' ? Colors.red.shade100 : Colors.amber.shade100, borderRadius: BorderRadius.circular(4)),
                  child: Text(severity, style: TextStyle(color: severity == 'CRÍTICO' ? Colors.red : Colors.amber.shade900, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 8),
                Text(engine, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey)),
                const Spacer(),
                Text('IA: $conf', style: const TextStyle(fontSize: 10, color: Colors.purple, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 6),
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 4),
            Text(path, style: const TextStyle(fontSize: 11, color: Colors.blue, fontFamily: 'monospace')),
          ],
        ),
      ),
    );
  }

  Widget _scanRow(String id, String repo, String status, String branch, String criticals, bool isDark) {
    final isRunning = status == 'RUNNING';
    return Card(
      elevation: 1,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(isRunning ? Icons.sync : Icons.check_circle_outline, color: isRunning ? Colors.blue : Colors.green, size: 20),
        title: Text(id, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        subtitle: Text('$repo ($branch)\n$criticals', style: const TextStyle(fontSize: 11)),
        trailing: Text(status, style: TextStyle(color: isRunning ? Colors.blue : Colors.green, fontSize: 11, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _notifTile(String title, String desc, String time, bool isDark) {
    return Card(
      elevation: 1,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const Icon(Icons.notifications, color: Color(0xFF4A3E85)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
        subtitle: Text(desc, style: const TextStyle(fontSize: 11)),
        trailing: Text(time, style: const TextStyle(fontSize: 9, color: Colors.grey)),
      ),
    );
  }

  Widget _isoTile(String control, String desc, String status, String engine, String findings, bool isDark) {
    return Card(
      elevation: 1,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Text(control, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blue)),
        title: Text(desc, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        subtitle: Text('Motor: $engine • Hallazgos: $findings', style: const TextStyle(fontSize: 10)),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(color: status == 'Brecha' ? Colors.red.shade100 : Colors.amber.shade100, borderRadius: BorderRadius.circular(4)),
          child: Text(status, style: TextStyle(color: status == 'Brecha' ? Colors.red : Colors.amber.shade900, fontSize: 10, fontWeight: FontWeight.bold)),
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
    {'sender': 'ai', 'text': '¡Hola! Soy el asistente IA de SSPILLOWY. ¿En qué te puedo ayudar hoy?'},
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
          'text': 'Análisis procesado. Recuerda mantener tus dependencias actualizadas en el repositorio.'
        });
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      height: MediaQuery.of(context).size.height * 0.70,
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
                const Text('SSPILLOWY AI Copilot', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
                  alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: isUser ? const Color(0xFF1E88E5) : (isDark ? const Color(0xFF334155) : Colors.grey.shade200),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      msg['text']!,
                      style: TextStyle(
                        fontSize: 13,
                        color: isUser ? Colors.white : (isDark ? Colors.white : Colors.black87),
                      ),
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
                      hintText: 'Escribe tu consulta...',
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
}