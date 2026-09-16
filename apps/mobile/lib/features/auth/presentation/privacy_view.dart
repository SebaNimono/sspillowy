import 'package:flutter/material.dart';

class PrivacyView extends StatelessWidget {
  const PrivacyView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Política de Privacidad')),
      body: const SingleChildScrollView(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Política de Privacidad y Tratamiento de Datos',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 12),
            Text(
              '1. Recopilación de Datos: Recopilamos únicamente su correo electrónico, alias de guardia y registros de actividad para la auditoría de excepciones de seguridad.\n\n'
              '2. Almacenamiento Seguro: Las credenciales de sesión (JWT) se almacenan de manera encriptada utilizando almacenamiento seguro local.\n\n'
              '3. Derechos de Supresión: El usuario puede solicitar la eliminación de su cuenta y alias directamente desde su perfil de usuario en la aplicación.',
              style: TextStyle(color: Colors.white70, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}
