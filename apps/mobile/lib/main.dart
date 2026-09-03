import 'package:flutter/material.dart';

void main() {
  runApp(const SSPILLOWYApp());
}

// Modelo para el Perfil de Usuario
class UserProfile {
  String name;
  String nick;
  String avatarUrl;

  UserProfile({
    required this.name,
    required this.nick,
    required this.avatarUrl,
  });
}

class SSPILLOWYApp extends StatefulWidget {
  const SSPILLOWYApp({super.key});

  @override
  State<SSPILLOWYApp> createState() => _SSPILLOWYAppState();
}

class _SSPILLOWYAppState extends State<SSPILLOWYApp> {
  // Estado Global del Tema (true = Dark, false = Light)
  bool _isDarkMode = true;

  // Estado del Perfil de Usuario inicial
  final UserProfile _userProfile = UserProfile(
    name: "Usuario",
    nick: "usuario",
    avatarUrl: "",
  );

  void _toggleTheme() {
    setState(() {
      _isDarkMode = !_isDarkMode;
    });
  }

  void _updateProfile(String name, String nick, String avatarUrl) {
    setState(() {
      _userProfile.name = name;
      _userProfile.nick = nick;
      _userProfile.avatarUrl = avatarUrl;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SSPILLOWY Console',
      debugShowCheckedModeBanner: false,
      themeMode: _isDarkMode ? ThemeMode.dark : ThemeMode.light,
      
      // MODO CLARO
      theme: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        primaryColor: const Color(0xFF16A34A),
        cardColor: const Color(0xFFFFFFFF),
        colorScheme: const ColorScheme.light(
          surface: Color(0xFFFFFFFF),
          primary: Color(0xFF16A34A),
          secondary: Color(0xFF0284C7),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFFFFFFFF),
          elevation: 1,
          iconTheme: IconThemeData(color: Color(0xFF1E293B)),
          titleTextStyle: TextStyle(color: Color(0xFF1E293B), fontSize: 16, fontWeight: FontWeight.bold),
        ),
        drawerTheme: const DrawerThemeData(
          backgroundColor: Color(0xFFFFFFFF),
        ),
      ),

      // MODO OSCURO
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0B0F17),
        primaryColor: const Color(0xFF22C55E),
        cardColor: const Color(0xFF1E293B),
        colorScheme: const ColorScheme.dark(
          surface: Color(0xFF111827),
          primary: Color(0xFF22C55E),
          secondary: Color(0xFF3B82F6),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0B0F17),
          elevation: 0,
          iconTheme: IconThemeData(color: Colors.white),
          titleTextStyle: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        drawerTheme: const DrawerThemeData(
          backgroundColor: Color(0xFF0F172A),
        ),
      ),

      home: AuthScreen(
        isDarkMode: _isDarkMode,
        onToggleTheme: _toggleTheme,
        userProfile: _userProfile,
        onUpdateProfile: _updateProfile,
      ),
    );
  }
}

// ==========================================
// 1. PANTALLA DE AUTENTICACIÓN CON VALIDACIONES Y RECUPERACIÓN
// ==========================================
class AuthScreen extends StatefulWidget {
  final bool isDarkMode;
  final VoidCallback onToggleTheme;
  final UserProfile userProfile;
  final Function(String, String, String) onUpdateProfile;

  const AuthScreen({
    super.key,
    required this.isDarkMode,
    required this.onToggleTheme,
    required this.userProfile,
    required this.onUpdateProfile,
  });

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _isLoginTab = true;
  
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  // Mensajes de error para validaciones
  String? _emailError;
  String? _passwordError;

  // Expresión regular básica para validar estructura de un correo
  final RegExp _emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');

  bool _validateInputs() {
    setState(() {
      _emailError = null;
      _passwordError = null;
    });

    bool isValid = true;
    final emailText = _emailController.text.trim();
    final passwordText = _passwordController.text;

    // Validación del Correo
    if (emailText.isEmpty) {
      _emailError = 'El correo electrónico no puede estar vacío';
      isValid = false;
    } else if (!_emailRegex.hasMatch(emailText)) {
      _emailError = 'Ingresa un formato de correo válido';
      isValid = false;
    }

    // Validación de la Contraseña
    if (passwordText.isEmpty) {
      _passwordError = 'La contraseña no puede estar vacía';
      isValid = false;
    } else if (passwordText.length < 6) {
      _passwordError = 'La contraseña debe tener al menos 6 caracteres';
      isValid = false;
    }

    setState(() {});
    return isValid;
  }

  void _submit() {
    if (!_validateInputs()) return;

    final emailName = _emailController.text.trim().split('@').first;
    widget.onUpdateProfile(
      emailName,
      emailName,
      widget.userProfile.avatarUrl,
    );

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => MainAppShell(
          isDarkMode: widget.isDarkMode,
          onToggleTheme: widget.onToggleTheme,
          userProfile: widget.userProfile,
          onUpdateProfile: widget.onUpdateProfile,
        ),
      ),
    );
  }

  // Modal para recuperar contraseña
  void _showForgotPasswordDialog() {
    final resetEmailController = TextEditingController(text: _emailController.text.trim());
    String? resetError;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return AlertDialog(
            title: const Text('Recuperar contraseña', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Ingresa tu correo electrónico registrado y te enviaremos las instrucciones para restablecer tu contraseña.',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: resetEmailController,
                  decoration: InputDecoration(
                    labelText: 'Correo electrónico',
                    hintText: 'ejemplo@correo.com',
                    errorText: resetError,
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancelar'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A)),
                onPressed: () {
                  final email = resetEmailController.text.trim();
                  if (email.isEmpty || !_emailRegex.hasMatch(email)) {
                    setModalState(() {
                      resetError = 'Ingresa un correo válido';
                    });
                    return;
                  }
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Se ha enviado un enlace de recuperación a $email'),
                      backgroundColor: const Color(0xFF16A34A),
                    ),
                  );
                },
                child: const Text('Enviar enlace', style: TextStyle(color: Colors.white)),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDarkMode;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final cardBg = isDark ? const Color(0xFF1E293B).withAlpha(180) : Colors.white;
    final inputBg = isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9);
    final borderColor = isDark ? Colors.white12 : Colors.black12;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
              children: [
                // Header Top Badge & Theme Switcher
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: borderColor),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.shield_outlined, size: 14, color: Colors.purpleAccent),
                          const SizedBox(width: 6),
                          Text(
                            'SSPILLOWY Console',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: textColor),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(
                        isDark ? Icons.wb_sunny_outlined : Icons.nightlight_round,
                        size: 20,
                        color: isDark ? Colors.white70 : const Color(0xFF0F172A),
                      ),
                      onPressed: widget.onToggleTheme,
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Logo principal
                Image.asset(
                  'assets/logo_2.png',
                  height: 90,
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) {
                    return Image.asset('assets/logo_2.jpg', height: 90, fit: BoxFit.contain);
                  },
                ),
                const SizedBox(height: 12),
                const Text(
                  'SSPILLOWY',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED), letterSpacing: 1.5),
                ),
                const SizedBox(height: 16),

                // Título Dinámico
                Text(
                  _isLoginTab ? 'Iniciar sesión en SSPILLOWY' : 'Crear tu cuenta en SSPILLOWY',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: textColor),
                ),
                const SizedBox(height: 4),
                Text(
                  'Plataforma Integral de Gobernanza DevSecOps',
                  style: TextStyle(color: isDark ? Colors.grey : const Color(0xFF64748B), fontSize: 12),
                ),
                const SizedBox(height: 24),

                // Tarjeta Principal
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: cardBg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: borderColor),
                    boxShadow: isDark ? [] : [const BoxShadow(color: Colors.black12, blurRadius: 10)],
                  ),
                  child: Column(
                    children: [
                      // Toggle de Pestañas
                      Container(
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() {
                                  _isLoginTab = true;
                                  _emailError = null;
                                  _passwordError = null;
                                }),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  decoration: BoxDecoration(
                                    color: _isLoginTab
                                        ? (isDark ? const Color(0xFF334155) : Colors.white)
                                        : Colors.transparent,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    'Iniciar Sesión',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: textColor,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() {
                                  _isLoginTab = false;
                                  _emailError = null;
                                  _passwordError = null;
                                }),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  decoration: BoxDecoration(
                                    color: !_isLoginTab
                                        ? (isDark ? const Color(0xFF334155) : Colors.white)
                                        : Colors.transparent,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    'Crear Cuenta',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: textColor,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Input Correo
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Correo electrónico',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: textColor),
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _emailController,
                        style: TextStyle(fontSize: 13, color: textColor),
                        decoration: InputDecoration(
                          hintText: 'ejemplo@correo.com',
                          hintStyle: const TextStyle(color: Colors.grey, fontSize: 12),
                          prefixIcon: const Icon(Icons.email_outlined, size: 18, color: Colors.grey),
                          filled: true,
                          fillColor: inputBg,
                          errorText: _emailError,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: borderColor)),
                          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: borderColor)),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Input Contraseña
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Contraseña',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: textColor),
                          ),
                          if (_isLoginTab)
                            GestureDetector(
                              onTap: _showForgotPasswordDialog,
                              child: const Text('¿Olvidaste tu clave?', style: TextStyle(fontSize: 11, color: Colors.blueAccent)),
                            )
                        ],
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _passwordController,
                        obscureText: true,
                        style: TextStyle(fontSize: 13, color: textColor),
                        decoration: InputDecoration(
                          hintText: '••••••••',
                          hintStyle: const TextStyle(color: Colors.grey, fontSize: 12),
                          prefixIcon: const Icon(Icons.lock_outline, size: 18, color: Colors.grey),
                          filled: true,
                          fillColor: inputBg,
                          errorText: _passwordError,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: borderColor)),
                          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: borderColor)),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Botón Principal
                      SizedBox(
                        width: double.infinity,
                        height: 44,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF16A34A),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          onPressed: _submit,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                _isLoginTab ? 'Ingresar a la Consola' : 'Registrar Cuenta',
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                              const SizedBox(width: 8),
                              const Icon(Icons.arrow_forward, size: 16, color: Colors.white),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  'SSPILLOWY Security Governance Platform • 2026',
                  style: TextStyle(color: isDark ? Colors.grey : const Color(0xFF64748B), fontSize: 11),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ==========================================
// CONTENEDOR PRINCIPAL Y NAVEGACIÓN
// ==========================================
class MainAppShell extends StatefulWidget {
  final bool isDarkMode;
  final VoidCallback onToggleTheme;
  final UserProfile userProfile;
  final Function(String, String, String) onUpdateProfile;

  const MainAppShell({
    super.key,
    required this.isDarkMode,
    required this.onToggleTheme,
    required this.userProfile,
    required this.onUpdateProfile,
  });

  @override
  State<MainAppShell> createState() => _MainAppShellState();
}

class _MainAppShellState extends State<MainAppShell> {
  int _currentIndex = 0;

  void _logout() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => AuthScreen(
          isDarkMode: widget.isDarkMode,
          onToggleTheme: widget.onToggleTheme,
          userProfile: widget.userProfile,
          onUpdateProfile: widget.onUpdateProfile,
        ),
      ),
    );
  }

  void _showEditProfileDialog() {
    final nameController = TextEditingController(text: widget.userProfile.name);
    final nickController = TextEditingController(text: widget.userProfile.nick);
    final avatarController = TextEditingController(text: widget.userProfile.avatarUrl);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Editar Perfil de Usuario', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Nombre completo'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: nickController,
                decoration: const InputDecoration(labelText: 'Nombre de usuario / Nick'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: avatarController,
                decoration: const InputDecoration(labelText: 'URL de Foto / Avatar (Opcional)'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A)),
            onPressed: () {
              widget.onUpdateProfile(
                nameController.text.trim(),
                nickController.text.trim(),
                avatarController.text.trim(),
              );
              Navigator.pop(ctx);
            },
            child: const Text('Guardar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDarkMode;
    final titles = [
      "Dashboard General",
      "Repositorios",
      "Matriz de Hallazgos",
      "Escaneos",
      "Security Gates (CI/CD)",
      "Notificaciones",
      "Informes ISO 27001",
    ];

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            Image.asset(
              'assets/sspillowy_logo.png',
              height: 24,
              width: 24,
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) {
                return const Icon(Icons.shield, color: Colors.purpleAccent, size: 20);
              },
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                titles[_currentIndex],
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF0284C7).withAlpha(40),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF0284C7)),
            ),
            child: Row(
              children: const [
                Icon(Icons.show_chart, color: Color(0xFF38BDF8), size: 14),
                SizedBox(width: 4),
                Text("82/100", style: TextStyle(fontSize: 11, color: Color(0xFF38BDF8), fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          IconButton(
            icon: Icon(
              isDark ? Icons.wb_sunny_outlined : Icons.nightlight_round,
              size: 18,
              color: isDark ? Colors.white70 : const Color(0xFF0F172A),
            ),
            onPressed: widget.onToggleTheme,
          ),
          IconButton(
            icon: const Icon(Icons.logout, size: 18, color: Colors.redAccent),
            onPressed: _logout,
            tooltip: "Cerrar Sesión",
          ),
          const SizedBox(width: 4),
        ],
      ),
      drawer: _buildAppDrawer(),
      body: Stack(
        children: [
          IndexedStack(
            index: _currentIndex,
            children: [
              _buildDashboardView(),
              _buildRepositoriosView(),
              _buildHallazgosView(),
              _buildEscaneosView(),
              _buildSecurityGatesView(),
              _buildNotificacionesView(),
              _buildInformesView(),
            ],
          ),
          Positioned(
            bottom: 20,
            right: 16,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E293B) : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
                boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 10)],
              ),
              child: const Icon(Icons.auto_awesome, color: Color(0xFF38BDF8), size: 20),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildAppDrawer() {
    final isDark = widget.isDarkMode;
    final user = widget.userProfile;

    return Drawer(
      backgroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
      child: Column(
        children: [
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(color: Colors.purple.shade900, borderRadius: BorderRadius.circular(8)),
                        child: Image.asset(
                          'assets/sspillowy_logo.png',
                          height: 20,
                          width: 20,
                          fit: BoxFit.contain,
                          errorBuilder: (context, error, stackTrace) => const Icon(Icons.shield, size: 20, color: Colors.purpleAccent),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("SSPILLOWY", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: isDark ? Colors.white : Colors.black)),
                          Text("WEB HUB • DEVSECOPS", style: TextStyle(fontSize: 9, color: isDark ? Colors.grey : const Color(0xFF64748B))),
                        ],
                      )
                    ],
                  ),
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: isDark ? Colors.white10 : Colors.black12),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 16,
                          backgroundColor: Colors.blue,
                          backgroundImage: user.avatarUrl.isNotEmpty ? NetworkImage(user.avatarUrl) : null,
                          child: user.avatarUrl.isEmpty
                              ? Text(
                                  user.name.isNotEmpty ? user.name[0].toUpperCase() : "U",
                                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                                )
                              : null,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(user.name, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: isDark ? Colors.white : Colors.black87)),
                              Text("@${user.nick}", style: const TextStyle(color: Colors.blueAccent, fontSize: 10)),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.edit_outlined, size: 16, color: Colors.grey),
                          onPressed: _showEditProfileDialog,
                          tooltip: "Editar Perfil",
                        )
                      ],
                    ),
                  )
                ],
              ),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              children: [
                _drawerItem(0, "Dashboard General", Icons.grid_view_rounded),
                _drawerItem(1, "Repositorios", Icons.folder_outlined),
                _drawerItem(2, "Matriz de Hallazgos", Icons.shield_outlined),
                _drawerItem(3, "Escaneos", Icons.radar_outlined),
                _drawerItem(4, "Security Gates (CI/CD)", Icons.tune_outlined),
                _drawerItem(5, "Notificaciones", Icons.notifications_none_outlined),
                _drawerItem(6, "Informes ISO 27001", Icons.description_outlined),
              ],
            ),
          ),
          const SizedBox(height: 10)
        ],
      ),
    );
  }

  Widget _drawerItem(int index, String title, IconData icon) {
    final isSelected = _currentIndex == index;
    final isDark = widget.isDarkMode;

    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(
        color: isSelected ? (isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0)) : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
      ),
      child: ListTile(
        dense: true,
        leading: Icon(icon, color: isSelected ? const Color(0xFF38BDF8) : Colors.grey, size: 18),
        title: Text(
          title,
          style: TextStyle(
            color: isSelected ? (isDark ? Colors.white : Colors.black87) : (isDark ? Colors.grey.shade400 : const Color(0xFF64748B)),
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            fontSize: 13,
          ),
        ),
        onTap: () {
          setState(() => _currentIndex = index);
          Navigator.pop(context);
        },
      ),
    );
  }

  // ==========================================
  // VISTAS
  // ==========================================
  Widget _buildDashboardView() {
    final isDark = widget.isDarkMode;
    final cardBg = isDark ? const Color(0xFF1E293B).withAlpha(120) : Colors.white;
    final borderColor = isDark ? Colors.white10 : Colors.black12;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(color: cardBg, borderRadius: BorderRadius.circular(8), border: Border.all(color: borderColor)),
          child: Row(
            children: const [
              Icon(Icons.circle, color: Color(0xFF22C55E), size: 8),
              SizedBox(width: 8),
              Text("LIVE  orquestación activa   |   tick #18   |   7...", style: TextStyle(fontSize: 11, fontFamily: 'monospace', color: Colors.grey)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.3,
          children: [
            _dashboardCard("REPOSITORIOS MONITORE...", "3", "activos", Icons.developer_board, const Color(0xFF38BDF8)),
            _dashboardCard("VULNERABILIDADES CRÍTI...", "3", "abiertas", Icons.error_outline, const Color(0xFFEF4444)),
            _dashboardCard("SECRETOS PREVENIDOS", "14", "bloqueados", Icons.vpn_key_outlined, const Color(0xFF22C55E)),
            _dashboardCard("ESCANEOS EJECUTADOS", "48", "histórico", Icons.verified_user_outlined, const Color(0xFFA855F7)),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: cardBg, borderRadius: BorderRadius.circular(12), border: Border.all(color: borderColor)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Health Score General", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: isDark ? Colors.white : Colors.black87)),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      SizedBox(
                        width: 90,
                        height: 90,
                        child: CircularProgressIndicator(value: 0.82, strokeWidth: 8, color: const Color(0xFF22C55E), backgroundColor: isDark ? Colors.white10 : Colors.black12),
                      ),
                      Column(
                        children: [
                          Text("82", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                          const Text("/100", style: TextStyle(fontSize: 10, color: Colors.grey)),
                        ],
                      )
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _legendItem("Críticas: 3", const Color(0xFFEF4444)),
                      const SizedBox(height: 6),
                      _legendItem("Altas: 3", const Color(0xFFF59E0B)),
                      const SizedBox(height: 6),
                      _legendItem("Medias: 1", const Color(0xFF38BDF8)),
                      const SizedBox(height: 6),
                      _legendItem("Bajas: 0", Colors.grey),
                    ],
                  )
                ],
              )
            ],
          ),
        )
      ],
    );
  }

  Widget _dashboardCard(String title, String count, String sub, IconData icon, Color color) {
    final isDark = widget.isDarkMode;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B).withAlpha(120) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.white10 : Colors.black12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(child: Text(title, style: const TextStyle(fontSize: 8, color: Colors.grey, fontWeight: FontWeight.bold))),
              Icon(icon, size: 14, color: color),
            ],
          ),
          Text(count, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
          Text(sub, style: const TextStyle(fontSize: 10, color: Colors.grey)),
        ],
      ),
    );
  }

  Widget _legendItem(String text, Color color) {
    return Row(
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Text(text, style: TextStyle(fontSize: 12, color: widget.isDarkMode ? Colors.white : Colors.black87)),
      ],
    );
  }

  Widget _buildRepositoriosView() {
    final isDark = widget.isDarkMode;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text("Repositorios Monitoreados (3)", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: isDark ? Colors.white : Colors.black87)),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A), minimumSize: const Size(80, 32)),
              onPressed: () {},
              icon: const Icon(Icons.add, size: 14, color: Colors.white),
              label: const Text("Nuevo", style: TextStyle(fontSize: 11, color: Colors.white)),
            )
          ],
        ),
        const SizedBox(height: 12),
        _repoCard("sspillowy-backend-api", "Github.com/org/sspillowy-backend • main", "1 Críticas", "88%", const Color(0xFF16A34A)),
        _repoCard("payment-gateway-service", "Github.com/org/payment-gateway • develop", "3 Críticas", "62%", const Color(0xFFDC2626)),
        _repoCard("auth-identity-provider", "Github.com/org/auth-service • main", "0 Críticas", "95%", const Color(0xFF16A34A)),
      ],
    );
  }

  Widget _repoCard(String name, String sub, String crit, String score, Color scoreColor) {
    final isDark = widget.isDarkMode;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B).withAlpha(120) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.white10 : Colors.black12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: isDark ? Colors.white : Colors.black87)),
              const SizedBox(height: 4),
              Text(sub, style: const TextStyle(fontSize: 10, color: Colors.grey)),
              const SizedBox(height: 2),
              Text(crit, style: const TextStyle(fontSize: 10, color: Colors.grey)),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: scoreColor.withAlpha(40), borderRadius: BorderRadius.circular(6)),
            child: Text(score, style: TextStyle(color: scoreColor, fontWeight: FontWeight.bold, fontSize: 11)),
          )
        ],
      ),
    );
  }

  Widget _buildHallazgosView() {
    final isDark = widget.isDarkMode;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text("Vulnerabilidades & Secretos Detectados (7)", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: isDark ? Colors.white : Colors.black87)),
        const SizedBox(height: 12),
        _findingCard("CRÍTICO", "GITLEAKS", "IA: 98%", "Hardcoded AWS Secret Key detected in repository history", "apps/api/config/aws_client.py:42", const Color(0xFFFCA5A5), const Color(0xFF991B1B)),
        _findingCard("CRÍTICO", "SEMGREP", "IA: 94%", "Potential SQL Injection in dynamic query concatenation", "src/services/user_search.py:115", const Color(0xFFFCA5A5), const Color(0xFF991B1B)),
        _findingCard("ALTO", "TRIVY", "IA: 89%", "CVE-2024-21626: container breakout vulnerability in runc", "Dockerfile:1", const Color(0xFFFDE68A), const Color(0xFF92400E)),
        _findingCard("MEDIO", "OWASP_ZAP", "IA: 91%", "Missing HTTP Strict-Transport-Security Header", "/api/v1/auth/login", const Color(0xFFFDE68A), const Color(0xFF92400E)),
      ],
    );
  }

  Widget _findingCard(String tag, String engine, String ia, String title, String path, Color tagBg, Color tagTxt) {
    final isDark = widget.isDarkMode;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B).withAlpha(120) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.white10 : Colors.black12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: tagBg, borderRadius: BorderRadius.circular(4)),
                child: Text(tag, style: TextStyle(color: tagTxt, fontSize: 9, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 8),
              Text(engine, style: const TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold)),
              const Spacer(),
              Text(ia, style: const TextStyle(fontSize: 10, color: Colors.purpleAccent, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 8),
          Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 6),
          Text(path, style: const TextStyle(fontSize: 11, color: Color(0xFF38BDF8), fontFamily: 'monospace')),
        ],
      ),
    );
  }

  Widget _buildEscaneosView() {
    final isDark = widget.isDarkMode;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text("Historial de escaneos (4)", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: isDark ? Colors.white : Colors.black87)),
        const SizedBox(height: 12),
        _scanCard("scan-101", "sspillowy-backend-api (main)", "1 Crítica", "COMPLETED", const Color(0xFF22C55E), Icons.check_circle_outline),
        _scanCard("scan-102", "payment-gateway-service (develop)", "3 Críticas", "COMPLETED", const Color(0xFF22C55E), Icons.check_circle_outline),
        _scanCard("scan-103", "auth-identity-provider (main)", "0 Críticas", "COMPLETED", const Color(0xFF22C55E), Icons.check_circle_outline),
        _scanCard("scan-104", "payment-gateway-service (develop)", "0 Críticas", "RUNNING", const Color(0xFF38BDF8), Icons.sync),
      ],
    );
  }

  Widget _scanCard(String id, String repo, String sub, String status, Color color, IconData icon) {
    final isDark = widget.isDarkMode;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B).withAlpha(120) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.white10 : Colors.black12),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(id, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: isDark ? Colors.white : Colors.black87)),
                Text(repo, style: const TextStyle(fontSize: 10, color: Colors.grey)),
                Text(sub, style: const TextStyle(fontSize: 10, color: Colors.grey)),
              ],
            ),
          ),
          Text(status, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildSecurityGatesView() {
    final isDark = widget.isDarkMode;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text("Configuración de Política Activa", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: isDark ? Colors.white : Colors.black87)),
        const SizedBox(height: 12),
        _policyBox("Máximo de Vulnerabilidades Críticas Permitidas", "Si un escaneo detecta un número mayor de fallos CRITICAL, el pipeline CI/CD se bloqueará.", "0", Colors.redAccent),
        const SizedBox(height: 12),
        _policyBox("Máximo de Vulnerabilidades Altas (HIGH) Permitidas", "Umbral de advertencia severa antes de abortar la Integración.", "2", Colors.amber),
      ],
    );
  }

  Widget _policyBox(String title, String desc, String val, Color color) {
    final isDark = widget.isDarkMode;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B).withAlpha(120) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.white10 : Colors.black12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: color)),
          const SizedBox(height: 6),
          Text(desc, style: const TextStyle(fontSize: 10, color: Colors.grey)),
          const SizedBox(height: 12),
          TextField(
            controller: TextEditingController(text: val),
            style: TextStyle(color: isDark ? Colors.white : Colors.black87),
            decoration: InputDecoration(
              filled: true,
              fillColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: isDark ? Colors.white12 : Colors.black12)),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildNotificacionesView() {
    final isDark = widget.isDarkMode;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text("Notificaciones Recientes", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: isDark ? Colors.white : Colors.black87)),
        const SizedBox(height: 12),
        _notifCard("Secreto AWS expuesto en sspillowy-backend-api", "GitLeaks detectó clave activa en historial.", "Hace 10 min"),
        _notifCard("Security Gate bloqueó el pipeline de payment-gateway", "Umbral de 0 críticas excedido.", "Hace 30 min"),
        _notifCard("Triaje IA listo: SQL Injection en user_search.py", "Confianza 94%. Esperando validación humana.", "Hace 2 horas"),
      ],
    );
  }

  Widget _notifCard(String title, String desc, String time) {
    final isDark = widget.isDarkMode;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B).withAlpha(120) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.white10 : Colors.black12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.notifications, color: Color(0xFF38BDF8), size: 18),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: isDark ? Colors.white : Colors.black87)),
                const SizedBox(height: 4),
                Text(desc, style: const TextStyle(fontSize: 10, color: Colors.grey)),
              ],
            ),
          ),
          Text(time, style: const TextStyle(fontSize: 9, color: Colors.grey)),
        ],
      ),
    );
  }

  Widget _buildInformesView() {
    final isDark = widget.isDarkMode;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text("Paquete de evidencia ISO 27001", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: isDark ? Colors.white : Colors.black87)),
        const SizedBox(height: 12),
        _isoCard("A.8.8", "Gestión de vulnerabilidades técnicas", "Motor: TRIVY • Hallazgos: 1", "Parcial", const Color(0xFFFDE68A), const Color(0xFF92400E)),
        _isoCard("A.8.9", "Gestión de configuración", "Motor: OWASP_ZAP • Hallazgos: 2", "Parcial", const Color(0xFFFDE68A), const Color(0xFF92400E)),
        _isoCard("A.8.28", "Codificación segura", "Motor: SEMGREP • Hallazgos: 2", "Parcial", const Color(0xFFFDE68A), const Color(0xFF92400E)),
        _isoCard("A.8.5", "Autenticación segura", "Motor: GITLEAKS • Hallazgos: 1", "Brecha", const Color(0xFFFCA5A5), const Color(0xFF991B1B)),
      ],
    );
  }

  Widget _isoCard(String code, String title, String desc, String tag, Color tagBg, Color tagTxt) {
    final isDark = widget.isDarkMode;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B).withAlpha(120) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.white10 : Colors.black12),
      ),
      child: Row(
        children: [
          Text(code, style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 12)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: isDark ? Colors.white : Colors.black87)),
                const SizedBox(height: 2),
                Text(desc, style: const TextStyle(fontSize: 10, color: Colors.grey)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: tagBg, borderRadius: BorderRadius.circular(4)),
            child: Text(tag, style: TextStyle(color: tagTxt, fontSize: 10, fontWeight: FontWeight.bold)),
          )
        ],
      ),
    );
  }
}