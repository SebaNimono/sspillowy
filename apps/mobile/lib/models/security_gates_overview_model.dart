class RepositoryStatus {
  final String name;
  final String status;
  final String? lastCommit;

  RepositoryStatus({
    required this.name,
    required this.status,
    this.lastCommit,
  });

  factory RepositoryStatus.fromJson(Map<String, dynamic> json) {
    return RepositoryStatus(
      name: json['name'] ?? '',
      status: json['status'] ?? 'UNKNOWN',
      lastCommit: json['lastCommit'],
    );
  }
}

class SecurityGatesOverviewResponse {
  final bool isBlocked;
  final String? blockReason;
  final List<RepositoryStatus> repositories;

  SecurityGatesOverviewResponse({
    required this.isBlocked,
    this.blockReason,
    required this.repositories,
  });

  factory SecurityGatesOverviewResponse.fromJson(Map<String, dynamic> json) {
    return SecurityGatesOverviewResponse(
      isBlocked: json['isBlocked'] ?? false,
      blockReason: json['blockReason'],
      repositories: (json['repositories'] as List<dynamic>?)
              ?.map((e) => RepositoryStatus.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
