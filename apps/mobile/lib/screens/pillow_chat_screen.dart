import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/scan_model.dart';
import '../services/api_client.dart';

typedef StringMap = Map<String, String>;

class PillowChatScreen extends StatefulWidget {
  final List<ScanModel> currentScans;
  final bool isOnDuty;

  const PillowChatScreen({
    super.key,
    required this.currentScans,
    required this.isOnDuty,
  });

  @override
  State<PillowChatScreen> createState() => _PillowChatScreenState();
}

class _PillowChatScreenState extends State<PillowChatScreen> {
  List<StringMap> _messages = [
    {
      'role': 'assistant',
      'text':
          '¡Hola! Soy tu asistente de seguridad Pillow IA para la aplicación móvil. ¿En qué te puedo ayudar sobre los hallazgos actuales de tus repositorios?'
    }
  ];
  final TextEditingController _chatController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isThinking = false;
  final ApiClient _apiClient = ApiClient();

  @override
  void initState() {
    super.initState();
    _loadChatHistory();
  }

  @override
  void dispose() {
    _chatController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadChatHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final savedHistoryJson = prefs.getString('persistent_chat_history');
    if (savedHistoryJson != null && savedHistoryJson.isNotEmpty) {
      try {
        final dynamic decoded = jsonDecode(savedHistoryJson);
        if (decoded is List) {
          setState(() {
            _messages =
                decoded.map((e) => Map<String, String>.from(e as Map)).toList();
          });
        }
      } catch (_) {}
    }
  }

  Future<void> _saveChatHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('persistent_chat_history', jsonEncode(_messages));
  }

  Future<void> _clearChatHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('persistent_chat_history');
    setState(() {
      _messages = [
        {
          'role': 'assistant',
          'text':
              '¡Hola! Soy tu asistente de seguridad Pillow IA para la aplicación móvil. ¿En qué te puedo ayudar sobre los hallazgos actuales de tus repositorios?'
        }
      ];
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessageToAI(String prompt) async {
    final cleanPrompt = prompt.trim();
    if (cleanPrompt.isEmpty) return;

    setState(() {
      _messages.add({'role': 'user', 'text': cleanPrompt});
      _isThinking = true;
    });
    await _saveChatHistory();
    _chatController.clear();
    _scrollToBottom();

    String? serverReply;

    try {
      final prefs = await SharedPreferences.getInstance();
      final userEmail = prefs.getString('user_email') ?? '';
      final token = prefs.getString('jwt_token');

      if (token != null && token.isNotEmpty) {
        _apiClient.setAuthToken(token);
      }

      final response = await _apiClient.post(
        '/pillow/chat',
        data: {
          'message': cleanPrompt,
          'user_key': userEmail,
          'context': 'mobile_app',
          'findings_count': widget.currentScans.length,
          'is_on_duty': widget.isOnDuty,
        },
      );

      if (kDebugMode) {
        debugPrint('--- PILLOW CHAT RESPUESTA BACKEND ---');
        debugPrint('Status: ${response.statusCode}');
        debugPrint('Data: ${response.data}');
      }

      if (response.statusCode == 200 && response.data != null) {
        if (response.data is Map) {
          serverReply = (response.data['reply'] ??
                  response.data['content'] ??
                  response.data['message'] ??
                  response.data['response'] ??
                  response.data['answer'] ??
                  response.data['result'])
              ?.toString();
        } else if (response.data is String) {
          serverReply = response.data.toString();
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('--- PILLOW CHAT ERROR API ---: $e');
      }
    }

    if (serverReply != null &&
        (serverReply.contains('Dashboard') || serverReply.contains('widgets'))) {
      serverReply = _generateContextualAIResponse(cleanPrompt);
    } else if (serverReply == null || serverReply.trim().isEmpty) {
      serverReply = _generateContextualAIResponse(cleanPrompt);
    }

    if (mounted) {
      setState(() {
        _messages.add({'role': 'assistant', 'text': serverReply!});
      });
      await _saveChatHistory();
      _scrollToBottom();
      setState(() => _isThinking = false);
    }
  }

  String _generateContextualAIResponse(String prompt) {
    final lower = prompt.toLowerCase();

    if (lower.contains('sql') || lower.contains('inyec')) {
      if (lower.contains('más') ||
          lower.contains('mas') ||
          lower.contains('detalle')) {
        return '''Para profundizar en SQL Injection en Node.js desde la app móvil:

1. **Sanitización manual no recomendada**: No uses `replace()` ni expresiones regulares para limpiar entradas.
2. **Parametrización con pg / mysql2**:
   `db.query("SELECT * FROM users WHERE id = \$1", [userId])`
3. **Uso de ORM**: Prisma o TypeORM escapan automáticamente los valores recibidos.
4. **Principio de menor privilegio**: Asegúrate de que el usuario de la BD no tenga permisos de SUPERUSER o DROP TABLE.''';
      }
      return 'Para resolver una vulnerabilidad de inyección SQL en Node.js, utiliza consultas preparadas (parameterized queries) u ORMs como Prisma/Sequelize en lugar de concatenar cadenas directamente en las queries SQL.';
    }

    if (lower.contains('hallazgo') ||
        lower.contains('repositorio') ||
        lower.contains('cuanto') ||
        lower.contains('bandeja') ||
        lower.contains('métrica') ||
        lower.contains('metrica')) {
      if (widget.currentScans.isEmpty) {
        return 'Actualmente no tienes hallazgos registrados en tu bandeja móvil. Una vez que tus repositorios ejecuten escaneos SAST/Secret Detection, los visualizarás aquí en tiempo real para aprobar excepciones o bloquear despliegues.';
      }
      return 'Actualmente dispones de ${widget.currentScans.length} hallazgo(s) registrado(s) en tu bandeja de monitoreo móvil. Te sugiero triajar de inmediato los marcados con estado CRITICAL.';
    }

    if (lower.contains('guardia') ||
        lower.contains('duty') ||
        lower.contains('estado')) {
      return 'Tu estado de guardia actual en la aplicación es: ${widget.isOnDuty ? "ACTIVO (On-Duty)" : "INACTIVO (Off-Duty)"}. ${widget.isOnDuty ? "Tienes permisos completos para aprobar excepciones y gestionar bloqueos." : "Estás en modo solo lectura."}';
    }

    if (lower.contains('hola') ||
        lower.contains('buenas') ||
        lower.contains('saludos')) {
      return '¡Hola! Estoy supervisando la seguridad de tus proyectos en esta app móvil. ¿En qué aspecto o vulnerabilidad específica deseas que profundicemos?';
    }

    return 'Entendido. Como asistente agéntico móvil de Pillow, continúo monitoreando tus repositorios y las reglas de seguridad directamente en tu dispositivo.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Asistente Pillow IA'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_comment_outlined),
            tooltip: 'Nuevo Chat / Limpiar Historial',
            onPressed: () {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  backgroundColor: const Color(0xFF161B22),
                  title: const Text('Iniciar Nuevo Chat',
                      style: TextStyle(color: Colors.white)),
                  content: const Text(
                      '¿Deseas reiniciar la conversación y limpiar el historial guardado?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cancelar'),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0284C7)),
                      onPressed: () {
                        Navigator.pop(context);
                        _clearChatHistory();
                      },
                      child: const Text('Limpiar Historial',
                          style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              );
            },
          )
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              itemBuilder: (context, i) {
                final msg = _messages[i];
                final isUser = msg['role'] == 'user';
                return Align(
                  alignment:
                      isUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 6),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isUser
                          ? const Color(0xFF0284C7)
                          : const Color(0xFF21262D),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      msg['text']!,
                      style: const TextStyle(fontSize: 14, color: Colors.white),
                    ),
                  ),
                );
              },
            ),
          ),
          if (_isThinking)
            const LinearProgressIndicator(color: Color(0xFF38BDF8)),
          Container(
            padding: const EdgeInsets.all(12),
            color: const Color(0xFF161B22),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _chatController,
                    style: const TextStyle(fontSize: 14, color: Colors.white),
                    decoration: const InputDecoration(
                      hintText: 'Escribe tu consulta a Pillow...',
                      border: OutlineInputBorder(),
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    onSubmitted: _sendMessageToAI,
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.send, color: Color(0xFF38BDF8)),
                  onPressed: () => _sendMessageToAI(_chatController.text),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
