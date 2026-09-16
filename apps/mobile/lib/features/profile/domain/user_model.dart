class UserModel {
  final String id;
  final String email;
  final String alias;
  final String? avatarUrl;
  final String? avatarPath;
  final bool onDuty;
  final DateTime? lastAliasChangeDate;

  UserModel({
    required this.id,
    required this.email,
    required this.alias,
    this.avatarUrl,
    this.avatarPath,
    required this.onDuty,
    this.lastAliasChangeDate,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      alias: json['alias'] ?? '',
      avatarUrl: json['avatar_url'],
      avatarPath: json['avatar_path'],
      onDuty: json['on_duty'] ?? false,
      lastAliasChangeDate: json['last_alias_change_date'] != null
          ? DateTime.tryParse(json['last_alias_change_date'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'alias': alias,
      'avatar_url': avatarUrl,
      'avatar_path': avatarPath,
      'on_duty': onDuty,
      'last_alias_change_date': lastAliasChangeDate?.toIso8601String(),
    };
  }

  UserModel copyWith({
    String? id,
    String? email,
    String? alias,
    String? avatarUrl,
    String? avatarPath,
    bool? onDuty,
    DateTime? lastAliasChangeDate,
  }) {
    return UserModel(
      id: id ?? this.id,
      email: email ?? this.email,
      alias: alias ?? this.alias,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      avatarPath: avatarPath ?? this.avatarPath,
      onDuty: onDuty ?? this.onDuty,
      lastAliasChangeDate: lastAliasChangeDate ?? this.lastAliasChangeDate,
    );
  }
}