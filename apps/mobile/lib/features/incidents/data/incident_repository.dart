import '../domain/incident_model.dart';

class IncidentRepository {
  Future<List<IncidentModel>> getIncidents() async {
    await Future.delayed(const Duration(milliseconds: 500));
    return IncidentModel.mockList;
  }

  Future<IncidentModel?> getIncidentById(String id) async {
    await Future.delayed(const Duration(milliseconds: 300));
    try {
      return IncidentModel.mockList.firstWhere((element) => element.id == id);
    } catch (_) {
      return null;
    }
  }
}
