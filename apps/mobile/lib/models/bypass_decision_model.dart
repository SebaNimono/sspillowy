class BypassDecisionRequest {
  final String status;
  final String? comment;

  BypassDecisionRequest({required this.status, this.comment});

  Map<String, dynamic> toJson() => {
    'status': status,
    'comment': comment,
  };
}
