import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

// Para pruebas en Chrome usa 'localhost'. Si pruebas en emulador Android usa '10.0.2.2'
const String baseUrl = 'http://localhost:8000/api';

void main() {
  runApp(const SSPillowyPulseApp());
}

class SSPillowyPulseApp extends StatelessWidget {
  const SSPillowyPulseApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SSPILLOWY Pulse',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF6366F1),
          surface: Color(0xFF1E293B),
        ),
      ),
      home: const DashboardScreen(),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<dynamic> scans = [];
  bool isLoading = true;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    fetchScans();
  }

  Future<void> fetchScans() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final response = await http.get(Uri.parse('$baseUrl/scans'));
      if (response.statusCode == 200) {
        setState(() {
          scans = jsonDecode(response.body);
          isLoading = false;
        });
      } else {
        throw Exception('Error al cargar datos del servidor');
      }
    } catch (e) {
      setState(() {
        errorMessage = 'No se pudo conectar con la API en FastAPI.\nAsegúrate de que el backend esté ejecutándose.';
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Row(
          children: [
            Icon(Icons.shield, color: Color(0xFF6366F1)),
            SizedBox(width: 8),
            Text('SSPILLOWY Pulse', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: fetchScans,
          ),
        ],
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
          : errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, color: Colors.redAccent, size: 48),
                        const SizedBox(height: 12),
                        Text(errorMessage!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: fetchScans,
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1)),
                          child: const Text('Reintentar'),
                        )
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: fetchScans,
                  child: ListView(
                    padding: const EdgeInsets.all(16.0),
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.white10),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Total Escaneos Registrados', style: TextStyle(color: Colors.grey, fontSize: 12)),
                                const SizedBox(height: 4),
                                Text('${scans.length}', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white)),
                              ],
                            ),
                            const Icon(Icons.storage, size: 36, color: Color(0xFF10B981)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text('Historial de Auditorías (PostgreSQL 16)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white70)),
                      const SizedBox(height: 10),
                      scans.isEmpty
                          ? const Padding(
                              padding: EdgeInsets.symmetric(vertical: 32),
                              child: Center(child: Text('No hay registros en la BD aún.')),
                            )
                          : ListView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: scans.length,
                              itemBuilder: (context, index) {
                                final scan = scans[index];
                                return Card(
                                  color: const Color(0xFF1E293B),
                                  margin: const EdgeInsets.only(bottom: 10),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  child: ListTile(
                                    leading: const CircleAvatar(
                                      backgroundColor: Color(0xFF10B981),
                                      child: Icon(Icons.check, color: Colors.white, size: 18),
                                    ),
                                    title: Text(
                                      'ID: ${scan['id'].toString().substring(0, 8)}...',
                                      style: const TextStyle(fontFamily: 'monospace', fontSize: 13, fontWeight: FontWeight.bold),
                                    ),
                                    subtitle: Text(
                                      'Estado: ${scan['status']} | Repo ID: ${scan['repository_id']}',
                                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                                    ),
                                  ),
                                );
                              },
                            ),
                    ],
                  ),
                ),
    );
  }
}