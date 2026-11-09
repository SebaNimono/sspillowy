import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_client.dart';

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
    final token = prefs.getString('jwt_token');
    final savedEmail = prefs.getString('user_email') ?? '';
    final savedName = prefs.getString('user_name') ??
        (savedEmail.isNotEmpty ? savedEmail.split('@').first : 'Usuario');

    if (token != null && token.isNotEmpty) {
      _apiClient.setAuthToken(token);
    }

    List fetchedList = [];

    if (savedEmail.isNotEmpty) {
      fetchedList.add({
        'name': savedName,
        'email': savedEmail,
        'role': 'Cuenta Principal',
      });
    }

    try {
      dynamic resData;
      final endpoints = [
        '/profiles',
        '/auth/profiles',
        '/organization/profiles',
        '/user/profiles',
        '/users',
        '/auth/me',
        '/organization/users',
      ];

      for (String ep in endpoints) {
        try {
          var res = await _apiClient.get(ep);
          if (res.statusCode == 200 && res.data != null) {
            resData = res.data;
            break;
          }
        } catch (_) {}
      }

      if (resData != null) {
        List items = [];
        if (resData is List) {
          items = resData;
        } else if (resData is Map) {
          items = resData['profiles'] ??
              resData['accounts'] ??
              resData['users'] ??
              resData['members'] ??
              resData['data'] ??
              resData['organizations'] ??
              [];
          if (items.isEmpty && resData['email'] != null) {
            items = [resData];
          }
        }

        for (var item in items) {
          if (item is Map) {
            final email = (item['email'] ?? item['username'] ?? '').toString();
            final name = (item['name'] ??
                    item['display_name'] ??
                    item['title'] ??
                    (email.isNotEmpty ? email.split('@').first : 'Perfil'))
                .toString();
            final role = (item['role'] ??
                    item['type'] ??
                    item['position'] ??
                    'Perfil Vinculado')
                .toString();

            if (email.isNotEmpty && email != savedEmail) {
              bool alreadyAdded = fetchedList.any((p) => p['email'] == email);
              if (!alreadyAdded) {
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
    } catch (_) {}

    if (mounted) {
      setState(() {
        _availableProfiles = fetchedList;
        _activeUserEmail = savedEmail;
        _activeUserName = savedName;
        _isLoadingProfiles = false;
      });
    }
  }

  Future<void> _switchProfile(Map<String, String> profile) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_email', profile['email']!);
    await prefs.setString('user_name', profile['name']!);

    setState(() {
      _activeUserEmail = profile['email']!;
      _activeUserName = profile['name']!;
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              'Perfil cambiado a: ${profile['name']} (${profile['role']})'),
          backgroundColor: const Color(0xFF0284C7),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _handleDeleteAccountRequest() async {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: const Text('Solicitar eliminación de cuenta',
            style: TextStyle(color: Colors.white)),
        content: Text(
          '¿Estás seguro de que deseas solicitar la eliminación programada para $_activeUserEmail?\n\nRecibirás un período de gracia de 14 días. Puedes cancelar la eliminación simplemente volviendo a iniciar sesión.',
          style: const TextStyle(color: Colors.white70, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.pop(dialogContext);

              try {
                await _apiClient.post('/user/delete-request', data: {
                  'email': _activeUserEmail,
                  'status': 'PENDING_DELETION',
                });
              } catch (_) {}

              final prefs = await SharedPreferences.getInstance();
              await prefs.setBool('pending_account_deletion', true);

              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                      'Solicitud registrada. Revisa tu correo o vuelve a logearte para cancelar.'),
                  backgroundColor: Colors.amber,
                  duration: Duration(seconds: 4),
                ),
              );
              widget.onLogout();
            },
            child: const Text('Confirmar Solicitud',
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
                                profile['email'] == _activeUserEmail;
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
                                profile['name']!,
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
                  leading: const Icon(Icons.description_outlined,
                      color: Color(0xFF38BDF8)),
                  title: const Text('Términos y Condiciones',
                      style: TextStyle(color: Colors.white)),
                  onTap: () => _openWebUrl('https://sspillowy.com/terminos'),
                ),
              ),
              const SizedBox(height: 8),
              Card(
                color: const Color(0xFF161B22),
                child: ListTile(
                  leading: const Icon(Icons.delete_forever, color: Colors.red),
                  title: const Text('Solicitud de eliminación de cuenta',
                      style: TextStyle(color: Colors.red)),
                  onTap: _handleDeleteAccountRequest,
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
