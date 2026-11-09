import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'navigation/main_navigation_wrapper.dart';
import 'screens/login_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SSPillowyApp());
}

class SSPillowyApp extends StatefulWidget {
  const SSPillowyApp({super.key});

  @override
  State<SSPillowyApp> createState() => _SSPillowyAppState();
}

class _SSPillowyAppState extends State<SSPillowyApp> {
  bool _isLoggedIn = false;
  bool _isLoading = true;
  bool _isOnDuty = true;

  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
  }

  Future<void> _checkLoginStatus() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token =
          prefs.getString('jwt_token') ?? prefs.getString('session_id');
      final isLoggedInPref = prefs.getBool('is_logged_in') ?? false;

      if (!mounted) return;
      setState(() {
        _isLoggedIn = (token != null && token.isNotEmpty) && isLoggedInPref;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoggedIn = false;
        _isLoading = false;
      });
    }
  }

  Future<void> _handleLoginSuccess() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('is_logged_in', true);
    if (!mounted) return;
    setState(() {
      _isLoggedIn = true;
    });
  }

  Future<void> _handleLogout() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('jwt_token');
      await prefs.remove('session_id');
      await prefs.remove('user_email');
      await prefs.setBool('is_logged_in', false);
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _isLoggedIn = false;
    });
  }

  void _toggleOnDuty(bool? val) {
    setState(() {
      _isOnDuty = val ?? true;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          backgroundColor: Color(0xFF0D1117),
          body: Center(
              child: CircularProgressIndicator(color: Color(0xFF38BDF8))),
        ),
      );
    }

    return MaterialApp(
      title: 'SSPILLOWY',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: const Color(0xFF0D1117),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF0284C7),
          secondary: Color(0xFF38BDF8),
          surface: Color(0xFF161B22),
        ),
      ),
      home: !_isLoggedIn
          ? LoginScreenWithTerms(onLoginSuccess: _handleLoginSuccess)
          : MainNavigationWrapper(
              onLogout: _handleLogout,
              isOnDuty: _isOnDuty,
              onToggleOnDuty: (val) => _toggleOnDuty(val),
            ),
    );
  }
}
