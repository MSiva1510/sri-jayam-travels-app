import re

with open('lib/services/trip_service.dart', 'r') as f:
    content = f.read()

# Replace the first getTripById method with the new version
pattern1 = r'(Future<TripModel\?> getTripById\([\s\S]*?\n  \}\n\n  Future<int> getTodayTripCount\(DriverProfile\? driver\) async \{)'

replacement1 = '''Future<TripModel?> getTripById(
    String tripId, [
    DriverProfile? driver,
  ]) async {
    if (driver != null) {
      _requireDriver(driver);
    }
    try {
      final trip = await _repo.getTripById(tripId);
      if (trip == null) {
        throw const TripServiceException(
          message: 'Trip not found.',
          code: TripErrorCode.notFound,
        );
      }
      // Defence-in-depth: verify driver matches even if RLS passed
      if (driver != null) {
        final driverIdMatch   = trip.driverId != null && trip.driverId == driver.id;
        final driverNameMatch = trip.driverName != null &&
            trip.driverName!.toLowerCase() == driver.name.toLowerCase();

        if (!driverIdMatch && !driverNameMatch) {
          throw const TripServiceException(
            message: 'You do not have access to this trip.',
            code: TripErrorCode.unauthorized,
          );
        }
      }
      return trip;
    } catch (e) {
      if (e is TripServiceException) rethrow;
      throw _mapError(e);
    }
  }

  Future<int> getTodayTripCount(DriverProfile? driver) async {'''

new_content = re.sub(pattern1, replacement1, content, flags=re.DOTALL)

# Remove the getTripByIdForManager method
pattern2 = r'\n  Future<TripModel\?> getTripByIdForManager\(String tripId\) async \{[\s\S]*?\n  \}\n\n  Future<TripModel> assignDriver'
replacement2 = r'\n\n  Future<TripModel> assignDriver'
new_content = re.sub(pattern2, replacement2, new_content, flags=re.DOTALL)

with open('lib/services/trip_service.dart', 'w') as f:
    f.write(new_content)

print('Done!')