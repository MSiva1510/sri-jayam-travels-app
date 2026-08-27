// ─────────────────────────────────────────────────────────────────────────────
// alert_service.dart — Alert Business Logic
// ─────────────────────────────────────────────────────────────────────────────

import '../repositories/alert_repository.dart';
import '../models/alert.dart';

class AlertService {
  AlertService(this._repository);

  final AlertRepository _repository;

  Future<List<Alert>> getActiveAlerts({int limit = 50}) => _repository.getActiveAlerts(limit: limit);

  Future<List<Alert>> getAllAlerts({int limit = 100}) => _repository.getAllAlerts(limit: limit);

  Future<Alert?> getAlertById(String id) => _repository.getAlertById(id);

  Future<void> acknowledgeAlert(String id, String userId) => _repository.acknowledgeAlert(id, userId);

  Future<void> resolveAlert(String id, String userId) => _repository.resolveAlert(id, userId);

  Stream<List<Alert>> watchActiveAlerts() => _repository.watchActiveAlerts();

  // Derived getters
  List<Alert> getCriticalAlerts(List<Alert> alerts) =>
      alerts.where((a) => a.priority == 'critical' && !a.isResolved).toList();

  List<Alert> getHighPriorityAlerts(List<Alert> alerts) =>
      alerts.where((a) => a.priority == 'high' && !a.isResolved).toList();

  List<Alert> getUnresolvedAlerts(List<Alert> alerts) =>
      alerts.where((a) => !a.isResolved).toList();

  List<Alert> getAlertsByCategory(List<Alert> alerts, String category) =>
      alerts.where((a) => a.category == category).toList();
}