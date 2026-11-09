import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../features/security_gate/presentation/screens/security_gate_bypasses_screen.dart';
import '../models/scan_model.dart';
import '../screens/audit_history_screen.dart';
import '../screens/pillow_chat_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/scan_list_screen.dart';

typedef StringMap = Map<String, String>;

class MainNavigationWrapper extends StatefulWidget {
  final VoidCallback onLogout;
  final bool isOnDuty;
  final ValueChanged<bool> onToggleOnDuty;

  const MainNavigationWrapper({
    super.key,
    required this.onLogout,
    required this.isOnDuty,
    required this.onToggleOnDuty,
  });

  @override
  State<MainNavigationWrapper> createState() => _MainNavigationWrapperState();
}

class _MainNavigationWrapperState extends State<MainNavigationWrapper> {
  int _currentIndex = 0;
  List<ScanModel> _currentActiveScans = [];
  List<StringMap> _globalAuditLogs = [];

  @override
  void initState() {
    super.initState();
    _loadPersistentAuditLogs();
  }

  Future<void> _loadPersistentAuditLogs() async {
    final prefs = await SharedPreferences.getInstance();
    final savedLogsJson = prefs.getString('persistent_audit_logs');
    if (savedLogsJson != null) {
      try {
        final List decoded = jsonDecode(savedLogsJson);
        setState(() {
          _globalAuditLogs = decoded.map((e) => StringMap.from(e)).toList();
        });
      } catch (_) {}
    }
  }

  Future<void> _savePersistentAuditLogs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        'persistent_audit_logs', jsonEncode(_globalAuditLogs));
  }

  void _updateActiveScans(List<ScanModel> scans) {
    setState(() {
      _currentActiveScans = scans;
    });
  }

  void _addAuditLog(StringMap log) {
    setState(() {
      _globalAuditLogs.insert(0, log);
    });
    _savePersistentAuditLogs();
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      ScanListScreen(
        onLogout: widget.onLogout,
        isOnDuty: widget.isOnDuty,
        onScansUpdated: _updateActiveScans,
        onAuditAdded: _addAuditLog,
      ),
      PillowChatScreen(
        currentScans: _currentActiveScans,
        isOnDuty: widget.isOnDuty,
      ),
      const SecurityGateBypassesScreen(),
      AuditHistoryScreen(
        auditLogs: _globalAuditLogs,
      ),
      ProfileScreen(
        onLogout: widget.onLogout,
        isOnDuty: widget.isOnDuty,
        onToggleOnDuty: widget.onToggleOnDuty,
      ),
    ];

    return Scaffold(
      body: pages[_currentIndex],
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          indicatorColor: const Color(0xFF0284C7).withValues(alpha: 0.3),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 12);
            }
            return const TextStyle(color: Colors.grey, fontSize: 12);
          }),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const IconThemeData(color: Color(0xFF38BDF8));
            }
            return const IconThemeData(color: Colors.grey);
          }),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          backgroundColor: const Color(0xFF161B22),
          onDestinationSelected: (index) =>
              setState(() => _currentIndex = index),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.security), label: 'Bandeja'),
            NavigationDestination(
                icon: Icon(Icons.smart_toy_outlined), label: 'Pillow IA'),
            NavigationDestination(icon: Icon(Icons.gavel), label: 'Bypasses'),
            NavigationDestination(
                icon: Icon(Icons.history), label: 'Historial'),
            NavigationDestination(icon: Icon(Icons.person), label: 'Perfil'),
          ],
        ),
      ),
    );
  }
}
