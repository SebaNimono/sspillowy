import 'package:flutter/material.dart';

void main() {
  runApp(const SSPILLOWYApp());
}

class SSPILLOWYApp extends StatelessWidget {
  const SSPILLOWYApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SSPILLOWY Pulse',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        primaryColor: const Color(0xFF22C55E),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF22C55E),
          surface: Color(0xFF1E293B),
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
  bool isLoginTab = true;
  final TextEditingController _emailController = TextEditingController(text: 'usuario@sspillowy.com');
  final TextEditingController _passwordController = TextEditingController(text: '12345678');

  void _handleAuth() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (context) => const MainDashboardScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 420),
            padding: const EdgeInsets.all(28.0),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF334155)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircleAvatar(
                  radius: 32,
                  backgroundColor: Color(0xFF334155),
                  child: Icon(Icons.layers, size: 36, color: Color(0xFF22C55E)),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Iniciar sesión en SSPILLOWY',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                const Text(
                  'Plataforma Integral de Gobernanza DevSecOps',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),

                // Selector de Pestañas (Iniciar Sesión / Crear Cuenta)
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => isLoginTab = true),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: isLoginTab ? const Color(0xFF334155) : Colors.transparent,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text('Iniciar Sesión', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => isLoginTab = false),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: !isLoginTab ? const Color(0xFF334155) : Colors.transparent,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text('Crear Cuenta', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Formulario de Credenciales
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Correo electrónico', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _emailController,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.email_outlined, color: Colors.grey),
                    filled: true,
                    fillColor: const Color(0xFF0F172A),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 16),

                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Contraseña', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
                    TextButton(
                      onPressed: () {},
                      style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 0)),
                      child: const Text('¿Olvidaste tu clave?', style: TextStyle(fontSize: 12, color: Colors.blueAccent)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.lock_outline, color: Colors.grey),
                    filled: true,
                    fillColor: const Color(0xFF0F172A),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 24),

                // Botón de Ingreso Directo
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _handleAuth,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF22C55E),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('Ingresar a la Consola', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 16)),
                        SizedBox(width: 8),
                        Icon(Icons.arrow_forward, color: Colors.black, size: 20),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class MainDashboardScreen extends StatefulWidget {
  const MainDashboardScreen({super.key});

  @override
  State<MainDashboardScreen> createState() => _MainDashboardScreenState();
}

class _MainDashboardScreenState extends State<MainDashboardScreen> {
  int _selectedIndex = 0;
  bool isScanning = false;
  double scanProgress = 0.0;

  String userName = "Sebastián Tralma";
  String userEmail = "se.tralma@duocuc.cl";
  String userRole = "DevSecOps Lead";

  final List<String> _titles = const [
    'Dashboard General',
    'Repositorios',
    'Matriz de Hallazgos',
    'Escaneos',
    'Security Gates',
    'Notificaciones',
    'Informes ISO 27001',
  ];

  void _runScan() async {
    setState(() {
      isScanning = true;
      scanProgress = 0.0;
    });

    for (int i = 1; i <= 10; i++) {
      await Future.delayed(const Duration(milliseconds: 300));
      setState(() {
        scanProgress = i / 10;
      });
    }

    setState(() {
      isScanning = false;
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Escaneo DevSecOps finalizado con éxito.'),
          backgroundColor: Color(0xFF22C55E),
        ),
      );
    }
  }

  void _showProfileDialog() {
    TextEditingController nameCtrl = TextEditingController(text: userName);
    TextEditingController roleCtrl = TextEditingController(text: userRole);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Editar Perfil', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Nombre', labelStyle: TextStyle(color: Colors.grey)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: roleCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Cargo / Rol', labelStyle: TextStyle(color: Colors.grey)),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF22C55E)),
            onPressed: () {
              setState(() {
                userName = nameCtrl.text;
                userRole = roleCtrl.text;
              });
              Navigator.pop(context);
            },
            child: const Text('Guardar', style: TextStyle(color: Colors.black)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: Text(_titles[_selectedIndex]),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {},
          ),
        ],
      ),
      drawer: Drawer(
        backgroundColor: const Color(0xFF0F172A),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.only(top: 50, bottom: 20, left: 16, right: 16),
              color: const Color(0xFF1E293B),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: _showProfileDialog,
                    child: const CircleAvatar(
                      radius: 26,
                      backgroundColor: Color(0xFF22C55E),
                      child: Text('ST', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(userName, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 15)),
                        Text(userRole, style: const TextStyle(color: Color(0xFF22C55E), fontSize: 12, fontWeight: FontWeight.w600)),
                        Text(userEmail, style: const TextStyle(color: Colors.grey, fontSize: 11), overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.edit, size: 18, color: Colors.grey),
                    onPressed: _showProfileDialog,
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  _drawerItem(0, 'Dashboard General', Icons.dashboard_outlined),
                  _drawerItem(1, 'Repositorios', Icons.folder_outlined),
                  _drawerItem(2, 'Matriz de Hallazgos', Icons.bug_report_outlined),
                  _drawerItem(3, 'Escaneos', Icons.radar),
                  _drawerItem(4, 'Security Gates', Icons.security),
                  _drawerItem(5, 'Notificaciones', Icons.notifications_outlined),
                  _drawerItem(6, 'Informes ISO 27001', Icons.description_outlined),
                ],
              ),
            ),
            const Divider(color: Color(0xFF334155)),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.redAccent),
              title: const Text('Cerrar Sesión', style: TextStyle(color: Colors.redAccent)),
              onTap: () {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (context) => const LoginScreen()),
                );
              },
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.verified_user, color: Color(0xFF22C55E), size: 28),
                          SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Health Score: 94/100', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                              Text('LIVE Orquestación activa', style: TextStyle(fontSize: 12, color: Colors.grey)),
                            ],
                          ),
                        ],
                      ),
                      ElevatedButton.icon(
                        onPressed: isScanning ? null : _runScan,
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF22C55E)),
                        icon: const Icon(Icons.play_arrow, color: Colors.black, size: 18),
                        label: Text(isScanning ? 'Escaneando...' : 'Iniciar Escaneo', style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  if (isScanning) ...[
                    const SizedBox(height: 16),
                    LinearProgressIndicator(value: scanProgress, backgroundColor: const Color(0xFF0F172A), color: const Color(0xFF22C55E)),
                    const SizedBox(height: 6),
                    Text('Analizando SAST, SCA y Secretos... ${(scanProgress * 100).toInt()}%', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),

            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.5,
              children: [
                _metricCard('SAST Passed', '100%', Icons.check_circle, Colors.green),
                _metricCard('Vulnerabilidades', '3 Medias', Icons.warning_amber, Colors.orange),
                _metricCard('Secretos Expuestos', '0 Detectados', Icons.lock, Colors.blue),
                _metricCard('OWASP Top 10', 'Conforme', Icons.shield, Colors.purple),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _drawerItem(int index, String title, IconData icon) {
    final isSelected = _selectedIndex == index;
    return ListTile(
      leading: Icon(icon, color: isSelected ? const Color(0xFF22C55E) : Colors.grey),
      title: Text(title, style: TextStyle(color: isSelected ? Colors.white : Colors.grey, fontWeight: isSelected ? FontWeight.w900 : FontWeight.normal)),
      selected: isSelected,
      onTap: () {
        setState(() => _selectedIndex = index);
        Navigator.pop(context);
      },
    );
  }

  Widget _metricCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: color, size: 24),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
              Text(title, style: const TextStyle(fontSize: 11, color: Colors.grey)),
            ],
          ),
        ],
      ),
    );
  }
}