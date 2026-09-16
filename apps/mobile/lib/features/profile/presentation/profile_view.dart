import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../domain/user_model.dart';

class ProfileView extends StatefulWidget {
  const ProfileView({super.key});

  @override
  State<ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<ProfileView> {
  late UserModel _currentUser;
  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _currentUser = UserModel(
      id: 'usr_123',
      email: 'operador@sspillowy.com',
      alias: 'Operador HITL Alpha',
      onDuty: true,
      avatarPath: null,
      lastAliasChangeDate: null, // Si es null, permite cambiarlo por primera vez
    );
  }

  // Método para seleccionar imagen de la galería
  Future<void> _pickImage() async {
    final XFile? image = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
    );

    if (image != null) {
      setState(() {
        _currentUser = _currentUser.copyWith(avatarPath: image.path);
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Foto de perfil actualizada'),
            backgroundColor: Color(0xFF238636),
          ),
        );
      }
    }
  }

  // Comprueba si han pasado 14 días desde el último cambio
  bool _canChangeAlias() {
    if (_currentUser.lastAliasChangeDate == null) return true;
    final daysDifference = DateTime.now().difference(_currentUser.lastAliasChangeDate!).inDays;
    return daysDifference >= 14;
  }

  // Devuelve los días restantes para poder volver a cambiar
  int _daysRemainingForAliasChange() {
    if (_currentUser.lastAliasChangeDate == null) return 0;
    final daysDifference = DateTime.now().difference(_currentUser.lastAliasChangeDate!).inDays;
    return 14 - daysDifference;
  }

  void _showEditAliasDialog() {
    if (!_canChangeAlias()) {
      final daysLeft = _daysRemainingForAliasChange();
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          backgroundColor: const Color(0xFF1F2328),
          title: const Text('Límite de cambio alcanzado', style: TextStyle(color: Colors.white)),
          content: Text(
            'Solo puedes cambiar tu alias una vez cada 2 semanas.\nDebes esperar $daysLeft día(s) más.',
            style: const TextStyle(color: Colors.white70),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Entendido', style: TextStyle(color: Color(0xFF0969DA))),
            ),
          ],
        ),
      );
      return;
    }

    final controller = TextEditingController(text: _currentUser.alias);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1F2328),
        title: const Text('Editar Alias', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: controller,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Nuevo Alias (para auditoría)',
                labelStyle: TextStyle(color: Colors.white70),
                enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.white24)),
                focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF0969DA))),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Nota: Solo se permite cambiar el alias 1 vez cada 14 días.',
              style: TextStyle(color: Colors.amber, fontSize: 12),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0969DA)),
            onPressed: () {
              if (controller.text.trim().isNotEmpty) {
                setState(() {
                  _currentUser = _currentUser.copyWith(
                    alias: controller.text.trim(),
                    lastAliasChangeDate: DateTime.now(), // Guarda la fecha actual del cambio
                  );
                });
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Alias actualizado correctamente'),
                    backgroundColor: Color(0xFF238636),
                  ),
                );
              }
            },
            child: const Text('Guardar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showDeleteAccountDialog() {
    final confirmController = TextEditingController();
    bool canDelete = false;

    showDialog(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1F2328),
              title: const Text(
                'Eliminar cuenta',
                style: TextStyle(color: Color(0xFFCF222E), fontWeight: FontWeight.bold),
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Esta acción es irreversible. Para confirmar, escribe la palabra "ELIMINAR" a continuación:',
                    style: TextStyle(fontSize: 14, color: Colors.white70),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: confirmController,
                    autofocus: true,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      hintText: 'ELIMINAR',
                      hintStyle: TextStyle(color: Colors.white38),
                      enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: Colors.white24)),
                      focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: Color(0xFFCF222E))),
                    ),
                    onChanged: (val) {
                      setDialogState(() {
                        canDelete = val.trim() == 'ELIMINAR';
                      });
                    },
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Cancelar', style: TextStyle(color: Colors.white54)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFCF222E),
                    disabledBackgroundColor: Colors.white12,
                  ),
                  onPressed: canDelete
                      ? () {
                          Navigator.pop(dialogContext);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Cuenta eliminada. Cerrando sesión...'),
                              backgroundColor: Color(0xFFCF222E),
                            ),
                          );
                          Navigator.pushReplacementNamed(context, '/login');
                        }
                      : null,
                  child: const Text('Eliminar definitivamente', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1117),
      appBar: AppBar(
        title: const Text('Perfil de Usuario', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFF1F2328),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Center(
              child: Column(
                children: [
                  // Avatar interactivo para cambiar la foto
                  Stack(
                    children: [
                      CircleAvatar(
                        radius: 45,
                        backgroundColor: const Color(0xFF0969DA),
                        backgroundImage: _currentUser.avatarPath != null
                            ? FileImage(File(_currentUser.avatarPath!))
                            : null,
                        child: _currentUser.avatarPath == null
                            ? Text(
                                _currentUser.alias.isNotEmpty ? _currentUser.alias[0].toUpperCase() : 'U',
                                style: const TextStyle(fontSize: 36, color: Colors.white, fontWeight: FontWeight.bold),
                              )
                            : null,
                      ),
                      Positioned(
                        bottom: 0,
                        right: 0,
                        child: GestureDetector(
                          onTap: _pickImage,
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: const BoxDecoration(
                              color: Color(0xFF238636),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.camera_alt,
                              color: Colors.white,
                              size: 18,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _currentUser.alias,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  Text(
                    _currentUser.email,
                    style: const TextStyle(color: Colors.white54, fontSize: 14),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Card(
              color: const Color(0xFF1F2328),
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.badge_outlined, color: Color(0xFF0969DA)),
                    title: const Text('Alias de guardia', style: TextStyle(color: Colors.white)),
                    subtitle: Text(
                      _currentUser.alias,
                      style: const TextStyle(color: Colors.white54),
                    ),
                    trailing: const Icon(Icons.edit_outlined, color: Colors.white70),
                    onTap: _showEditAliasDialog,
                  ),
                  const Divider(height: 1, color: Colors.white12),
                  SwitchListTile(
                    secondary: const Icon(Icons.shield_outlined, color: Color(0xFF0969DA)),
                    title: const Text('Estado de Guardia (On-Call)', style: TextStyle(color: Colors.white)),
                    subtitle: Text(
                      _currentUser.onDuty ? 'Activo (Puede aprobar/bloquear)' : 'Inactivo (Modo solo lectura)',
                      style: const TextStyle(color: Colors.white54),
                    ),
                    value: _currentUser.onDuty,
                    activeThumbColor: const Color(0xFF238636),
                    onChanged: (val) {
                      setState(() {
                        _currentUser = _currentUser.copyWith(onDuty: val);
                      });
                    },
                  ),
                  const Divider(height: 1, color: Colors.white12),
                  ListTile(
                    leading: const Icon(Icons.lock_reset_outlined, color: Color(0xFF0969DA)),
                    title: const Text('Cambiar contraseña', style: TextStyle(color: Colors.white)),
                    subtitle: const Text('Envía correo de verificación para restablecer', style: TextStyle(color: Colors.white54)),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Se ha enviado un correo de verificación para cambiar tu contraseña.'),
                          backgroundColor: Color(0xFF238636),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Card(
              color: const Color(0xFF210E14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: const BorderSide(color: Color(0xFFCF222E)),
              ),
              child: ListTile(
                leading: const Icon(Icons.delete_forever, color: Color(0xFFCF222E)),
                title: const Text(
                  'Eliminar cuenta',
                  style: TextStyle(color: Color(0xFFCF222E), fontWeight: FontWeight.bold),
                ),
                subtitle: const Text('Borra tu usuario y revoca todos los accesos', style: TextStyle(color: Colors.white54)),
                onTap: _showDeleteAccountDialog,
              ),
            ),
          ],
        ),
      ),
    );
  }
}