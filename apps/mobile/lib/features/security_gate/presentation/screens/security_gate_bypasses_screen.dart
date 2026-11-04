import 'package:flutter/material.dart';

class SecurityGateBypassesScreen extends StatelessWidget {
  const SecurityGateBypassesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bypasses & Excepciones'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Gobernanza de Security Gates',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Aquí se resumen las excepciones autorizadas por el Tech Lead y los bloqueos permanentes de despliegue en el pipeline de CI/CD.',
              style: TextStyle(color: Colors.grey, fontSize: 13),
            ),
            const SizedBox(height: 20),
            Expanded(
              child: ListView(
                children: const [
                  Card(
                    color: Color(0xFF161B22),
                    child: ListTile(
                      leading: Icon(Icons.shield_outlined, color: Colors.amber),
                      title: Text('Excepciones Temporizadas (HITL)',
                          style: TextStyle(color: Colors.white)),
                      subtitle: Text(
                          'Permiten la continuidad de los pipelines durante 24h a 168h.',
                          style: TextStyle(color: Colors.grey, fontSize: 12)),
                    ),
                  ),
                  SizedBox(height: 8),
                  Card(
                    color: Color(0xFF161B22),
                    child: ListTile(
                      leading: Icon(Icons.block, color: Colors.redAccent),
                      title: Text('Bloqueos de Despliegue',
                          style: TextStyle(color: Colors.white)),
                      subtitle: Text(
                          'Detienen el pase a producción ante fallos o fugas críticas.',
                          style: TextStyle(color: Colors.grey, fontSize: 12)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
