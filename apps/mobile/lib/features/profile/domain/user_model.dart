class UserModel {
  final String id;
  final String email;
  final String alias;
  final String? avatarUrl;
  final bool onDuty;

  UserModel({
    required this.id,
    required this.email,
    required this.alias,
    this.avatarUrl,
    required this.onDuty,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      alias: json['alias'] ?? '',
      avatarUrl: json['avatar_url'],
      onDuty: json['on_duty'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'alias': alias,
      'avatar_url': avatarUrl,
      'on_duty': onDuty,
    };
  }

  UserModel copyWith({
    String? alias,
    String? avatarUrl,
    bool? onDuty,
  }) {
    return UserModel(
      id: id,
      email: email,
      alias: alias ?? this.alias,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      onDuty: onDuty ?? this.onDuty,
    );
  }
}