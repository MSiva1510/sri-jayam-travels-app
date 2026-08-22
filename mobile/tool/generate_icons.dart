// ─────────────────────────────────────────────────────────────────────────────
// tool/generate_icons.dart
// Day 48 — generates the Sri Jayam Travels launcher icons from a single
// programmatic master design (brand blue gradient + white bus glyph).
//
// Run:  dart run tool/generate_icons.dart   (from mobile/)
//
// Outputs (android/app/src/main/res):
//   mipmap-mdpi/ic_launcher.png            48px   (legacy)
//   mipmap-hdpi/ic_launcher.png            72px
//   mipmap-xhdpi/ic_launcher.png           96px
//   mipmap-xxhdpi/ic_launcher.png         144px
//   mipmap-xxxhdpi/ic_launcher.png        192px
//   mipmap-mdpi/ic_launcher_foreground.png      108px   (adaptive layer)
//   mipmap-hdpi/ic_launcher_foreground.png      162px
//   mipmap-xhdpi/ic_launcher_foreground.png     216px
//   mipmap-xxhdpi/ic_launcher_foreground.png    324px
//   mipmap-xxxhdpi/ic_launcher_foreground.png   432px
// ─────────────────────────────────────────────────────────────────────────────

import 'dart:io';

import 'package:image/image.dart' as img;

const _resRoot = 'android/app/src/main/res';

// Brand palette (matches the app's colorSchemeSeed family)
final _gradTop    = img.ColorRgb8(30, 136, 229);  // #1E88E5
final _gradBottom = img.ColorRgb8(13, 71, 161);   // #0D47A1
final _white      = img.ColorRgb8(255, 255, 255);
final _windowBlue = img.ColorRgb8(21, 101, 192);  // #1565C0
final _navy       = img.ColorRgb8(11, 61, 110);   // wheel rubber
final _hubBlue    = img.ColorRgb8(144, 202, 249); // #90CAF9 hub

img.Color _lerp(img.ColorRgb8 a, img.ColorRgb8 b, double t) => img.ColorRgb8(
      (a.r + (b.r - a.r) * t).round(),
      (a.g + (b.g - a.g) * t).round(),
      (a.b + (b.b - a.b) * t).round(),
    );

/// White front-view bus glyph.
/// [size] = canvas size, [glyphScale] = fraction of canvas the bus occupies,
/// [cy] = vertical center of the bus body as a fraction of canvas.
void _drawBus(img.Image image, double glyphScale, double cy) {
  final s = image.width.toDouble();
  final w = s * glyphScale; // bus width

  // Body: x centered on canvas, height ≈ 0.72 × width
  final bx1 = (s / 2 - w / 2).round();
  final bx2 = (s / 2 + w / 2).round();
  final byH = w * 0.36;
  final by1 = (s * cy - byH / 2).round();
  final by2 = (s * cy + byH / 2).round();

  img.fillRect(image,
      x1: bx1, y1: by1, x2: bx2, y2: by2, color: _white);

  // Soften body corners with small circles (same white)
  final r = (by2 - by1) * 0.18;
  for (final c in [
    (bx1 + r.toInt(), by1 + r.toInt()),
    (bx2 - r.toInt(), by1 + r.toInt()),
  ]) {
    img.fillCircle(image, x: c.$1, y: c.$2, radius: r.round(), color: _white);
  }

  // Window band (brand blue) inset inside the body
  final wx1 = bx1 + (w * 0.06).round();
  final wx2 = bx2 - (w * 0.06).round();
  final wy1 = by1 + (byH * 0.16).round();
  final wy2 = by1 + (byH * 0.58).round();
  img.fillRect(image, x1: wx1, y1: wy1, x2: wx2, y2: wy2, color: _windowBlue);

  // Window dividers (white) → three panes
  final dw = (w * 0.02).round();
  final dx1 = wx1 + ((wx2 - wx1) / 3).round() - dw ~/ 2;
  final dx2 = wx1 + ((wx2 - wx1) * 2 / 3).round() - dw ~/ 2;
  img.fillRect(image, x1: dx1, y1: wy1, x2: dx1 + dw, y2: wy2, color: _white);
  img.fillRect(image, x1: dx2, y1: wy1, x2: dx2 + dw, y2: wy2, color: _white);

  // Headlights (blue squares near the bottom corners of the body)
  final hlS = (w * 0.07).round();
  img.fillRect(
    image,
    x1: bx1 + (w * 0.07).round(),
    y1: by2 - (byH * 0.30).round(),
    x2: bx1 + (w * 0.07).round() + hlS,
    y2: by2 - (byH * 0.30).round() + hlS,
    color: _windowBlue,
  );
  img.fillRect(
    image,
    x1: bx2 - (w * 0.07).round() - hlS,
    y1: by2 - (byH * 0.30).round(),
    x2: bx2 - (w * 0.07).round(),
    y2: by2 - (byH * 0.30).round() + hlS,
    color: _windowBlue,
  );

  // Wheels (navy discs + light hubs) peeking under the body
  final wr = (w * 0.115).round();
  final wheelY = by2 + (wr * 0.35).round();
  for (final wx in [bx1 + (w * 0.20).round(), bx2 - (w * 0.20).round()]) {
    img.fillCircle(image, x: wx, y: wheelY, radius: wr, color: _navy);
    img.fillCircle(image, x: wx, y: wheelY, radius: (wr * 0.38).round(), color: _hubBlue);
  }
}

img.Image _legacyIcon(int size) {
  final image = img.Image(width: size, height: size);

  // Vertical gradient background
  for (var y = 0; y < size; y++) {
    img.fillRect(image,
        x1: 0, y1: y, x2: size - 1, y2: y,
        color: _lerp(_gradTop, _gradBottom, y / (size - 1)));
  }

  _drawBus(image, 0.60, 0.47);
  return image;
}

/// Adaptive-icon foreground: transparent canvas, glyph inside the safe zone
/// (~62% so launcher masks never clip it).
img.Image _adaptiveForeground(int size) {
  final image = img.Image(width: size, height: size); // transparent by default
  _drawBus(image, 0.40, 0.50);
  return image;
}

void main() {
  const densities = {
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192,
  };

  var written = 0;
  densities.forEach((dpi, px) {
    final dir = Directory('$_resRoot/mipmap-$dpi');
    if (!dir.existsSync()) dir.createSync(recursive: true);

    void save(img.Image im, String name) {
      final f = File('${dir.path}/$name');
      f.writeAsBytesSync(img.encodePng(im));
      written++;
      stdout.writeln('✓ ${f.path} (${im.width}×${im.height})');
    }

    save(img.copyResize(_legacyIcon(px), width: px, height: px,
            interpolation: img.Interpolation.average),
        'ic_launcher.png');

    // Adaptive foreground runs on a 108dp grid → density × 108/48
    final fgPx = (px * 108 / 48).round();
    save(
      img.copyResize(_adaptiveForeground(fgPx),
          width: fgPx, height: fgPx, interpolation: img.Interpolation.average),
      'ic_launcher_foreground.png',
    );
  });

  stdout.writeln('Done — $written files written.');
}
