import 'package:flutter/material.dart';
import 'features/auth/presentation/login_view.dart';
import 'features/auth/presentation/forgot_password_view.dart';
import 'features/auth/presentation/register_view.dart';
import 'features/incidents/presentation/incidents_feed_view.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  bool _isLoggedIn = false;

  void _handleLoginSuccess() {
    setState(() {
      _isLoggedIn = true;
    });
  }

  void _handleLogout() {
    setState(() {
      _isLoggedIn = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SSPillowy App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: _isLoggedIn
          ? IncidentsFeedView(onLogout: _handleLogout)
          : LoginView(onLoginSuccess: _handleLoginSuccess),
      routes: {
        '/login': (context) => LoginView(onLoginSuccess: _handleLoginSuccess),
        '/incidents': (context) => IncidentsFeedView(onLogout: _handleLogout),
        '/forgot-password': (context) => const ForgotPasswordView(),
        '/register': (context) => const RegisterView(),
      },
    );
  }
}