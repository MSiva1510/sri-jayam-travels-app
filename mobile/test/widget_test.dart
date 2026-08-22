import 'package:flutter_test/flutter_test.dart';
import 'package:sri_jayam_travels_mobile/main.dart';

void main() {
  testWidgets('Sri Jayam Travels app starts', (WidgetTester tester) async {
    await tester.pumpWidget(const SriJayamApp());

    expect(find.text('Sri Jayam Travels'), findsOneWidget);
  });
}