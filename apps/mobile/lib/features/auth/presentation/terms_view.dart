import 'package:flutter/material.dart';

class TermsView extends StatelessWidget {
  const TermsView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Términos del Servicio')),
      body: const SingleChildScrollView(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Términos y Condiciones — SSPILLOWY Pulse',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 12),
            Text(
              '1. Uso On-Call: Esta aplicación está destinada exclusivamente a personal autorizado para la revisión y aprobación de excepciones de seguridad en incidentes (HITL).\n\n'
              '2. Responsabilidad de la Decisión: El resumen generado por Pillow es meramente contextual. La decisión de aprobar una excepción o confirmar un bloqueo es responsabilidad del usuario en turno.\n\n'
              '3. Auditoría: Todas las acciones ejecutadas en esta consola móvil quedan registradas en el log del sistema asociadas a su usuario o alias.',
              style: TextStyle(color: Colors.white70, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}
