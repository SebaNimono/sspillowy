import 'package:flutter/material.dart';
import 'package:sspillowy_pulse/features/auth/presentation/login_view.dart';
import 'package:sspillowy_pulse/features/incidents/presentation/incidents_feed_view.dart';

void main() {
  runApp(const SSPillowyPulseApp());
}

class SSPillowyPulseApp extends StatefulWidget {
  const SSPillowyPulseApp({super.key});

  @override
  State<SSPillowyPulseApp> createState() => _SSPillowyPulseAppState();
}

class _SSPillowyPulseAppState extends State<SSPillowyPulseApp> {
  bool _isLoggedIn = false;

  void _onLoginSuccess() {
    setState(() {
      _isLoggedIn = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SSPILLOWY Pulse',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: _isLoggedIn
          ? const IncidentsFeedView()
          : LoginView(onLoginSuccess: _onLoginSuccess),
      routes: {
        '/login': (context) => LoginView(onLoginSuccess: _onLoginSuccess),
        '/incidents': (context) => const IncidentsFeedView(),
      },
    );
  }
}
