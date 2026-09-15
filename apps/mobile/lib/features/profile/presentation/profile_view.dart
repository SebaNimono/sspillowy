import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../domain/user_model.dart';

class ProfileView extends StatefulWidget {
  const ProfileView({super.key});

  @override
  State<ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<ProfileView> {
  late UserModel _currentUser;

  @override
  void initState() {
    super.initState();
    _currentUser = UserModel(
      id: 'usr_123',
      email: 'operador@sspillowy.com',
      alias: 'Operador HITL Alpha',
      onDuty: true,
    );
  }

  void _showEditAliasDialog() {
    final controller = TextEditingController(text: _currentUser.alias);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Editar Alias'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Nuevo Alias (para auditoría)',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              if (controller.text.trim().isNotEmpty) {
                setState(() {
                  _currentUser = _currentUser.copyWith(alias: controller.text.trim());
                });
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Alias actualizado correctamente')),
                );
              }
            },
            child: const Text('Guardar'),
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
              title: const Text(
                'Eliminar cuenta',
                style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.bold),
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Esta acción es irreversible. Para confirmar, escribe la palabra "ELIMINAR" a continuación:',
                    style: TextStyle(fontSize: 14),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: confirmController,
                    autofocus: true,
                    decoration: const InputDecoration(
                      hintText: 'ELIMINAR',
                      border: OutlineInputBorder(),
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
                  child: const Text('Cancelar'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.danger,
                  ),
                  onPressed: canDelete
                      ? () {
                          Navigator.pop(dialogContext);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Cuenta eliminada. Cerrando sesión...'),
                              backgroundColor: AppColors.danger,
                            ),
                          );
                        }
                      : null,
                  child: const Text('Eliminar definitivamente'),
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
      appBar: AppBar(
        title: const Text('Perfil de Usuario'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 40,
                    backgroundColor: AppColors.primary,
                    child: Text(
                      _currentUser.alias.isNotEmpty ? _currentUser.alias[0].toUpperCase() : 'U',
                      style: const TextStyle(fontSize: 32, color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _currentUser.alias,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    _currentUser.email,
                    style: const TextStyle(color: Colors.grey, fontSize: 14),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.badge_outlined, color: AppColors.primary),
                    title: const Text('Alias de guardia'),
                    subtitle: Text(_currentUser.alias),
                    trailing: const Icon(Icons.edit_outlined),
                    onTap: _showEditAliasDialog,
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    secondary: const Icon(Icons.shield_outlined, color: AppColors.primary),
                    title: const Text('Estado de Guardia (On-Call)'),
                    subtitle: Text(_currentUser.onDuty ? 'Activo (Puede aprobar/bloquear)' : 'Inactivo (Modo solo lectura)'),
                    value: _currentUser.onDuty,
                    activeThumbColor: AppColors.primary,
                    onChanged: (val) {
                      setState(() {
                        _currentUser = _currentUser.copyWith(onDuty: val);
                      });
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.lock_reset_outlined, color: AppColors.primary),
                    title: const Text('Cambiar contraseña'),
                    subtitle: const Text('Envía correo de verificación para restablecer'),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Se ha enviado un correo de verificación para cambiar tu contraseña.'),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Card(
              color: Colors.red.shade50,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: BorderSide(color: AppColors.danger.withValues(alpha: 0.5)),
              ),
              child: ListTile(
                leading: const Icon(Icons.delete_forever, color: AppColors.danger),
                title: const Text(
                  'Eliminar cuenta',
                  style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.bold),
                ),
                subtitle: const Text('Borra tu usuario y revoca todos los accesos'),
                onTap: _showDeleteAccountDialog,
              ),
            ),
          ],
        ),
      ),
    );
  }
}