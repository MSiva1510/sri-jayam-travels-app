import re

with open('lib/core/theme/app_theme.dart', 'r') as f:
    content = f.read()

# Light theme replacements (first ~500 lines)
# These use AppLightColors
light_replacements = {
    'AppTypography.headlineSmall.copyWith(': 'AppTypography.headlineSmallStatic(AppLightColors.onSurface).copyWith(',
    'AppTypography.labelMedium.copyWith(': 'AppTypography.labelMediumStatic(AppLightColors.onPrimary).copyWith(',
    'AppTypography.bodyMedium.copyWith(': 'AppTypography.bodyMediumStatic(AppLightColors.onSurface).copyWith(',
    'AppTypography.caption.copyWith(': 'AppTypography.captionStatic(AppLightColors.onSurface).copyWith(',
    'AppTypography.labelSmall.copyWith(': 'AppTypography.labelSmallStatic(AppLightColors.onSurface).copyWith(',
    'AppTypography.bodyMedium,': 'AppTypography.bodyMediumStatic(AppLightColors.onSurface),',
    'AppTypography.bodyMediumBold,': 'AppTypography.bodyMediumBoldStatic(AppLightColors.onSurface),',
    'AppTypography.bodyMediumBold.copyWith(': 'AppTypography.bodyMediumBoldStatic(AppLightColors.onSurface).copyWith(',
    'AppTypography.caption,': 'AppTypography.captionStatic(AppLightColors.onSurface),',
    'AppTypography.labelMedium,': 'AppTypography.labelMediumStatic(AppLightColors.onPrimary),',
    'AppTypography.labelSmall.copyWith(': 'AppTypography.labelSmallStatic(AppLightColors.onSurface).copyWith(',
    'AppTypography.labelSmall,': 'AppTypography.labelSmallStatic(AppLightColors.onSurface),',
    'AppTypography.caption,': 'AppTypography.captionStatic(AppLightColors.onSurface),',
}

# Dark theme replacements (after line ~500)
dark_replacements = {
    'AppTypography.headlineSmallStatic(AppLightColors.onSurface).copyWith(': 'AppTypography.headlineSmallStatic(AppDarkColors.onSurface).copyWith(',
    'AppTypography.labelMediumStatic(AppLightColors.onPrimary).copyWith(': 'AppTypography.labelMediumStatic(AppDarkColors.onPrimary).copyWith(',
    'AppTypography.bodyMediumStatic(AppLightColors.onSurface).copyWith(': 'AppTypography.bodyMediumStatic(AppDarkColors.onSurface).copyWith(',
    'AppTypography.captionStatic(AppLightColors.onSurface).copyWith(': 'AppTypography.captionStatic(AppDarkColors.onSurface).copyWith(',
    'AppTypography.labelSmallStatic(AppLightColors.onSurface).copyWith(': 'AppTypography.labelSmallStatic(AppDarkColors.onSurface).copyWith(',
    'AppTypography.bodyMediumStatic(AppLightColors.onSurface),': 'AppTypography.bodyMediumStatic(AppDarkColors.onSurface),',
    'AppTypography.bodyMediumBoldStatic(AppLightColors.onSurface),': 'AppTypography.bodyMediumBoldStatic(AppDarkColors.onSurface),',
    'AppTypography.bodyMediumBoldStatic(AppLightColors.onSurface).copyWith(': 'AppTypography.bodyMediumBoldStatic(AppDarkColors.onSurface).copyWith(',
    'AppTypography.captionStatic(AppLightColors.onSurface),': 'AppTypography.captionStatic(AppDarkColors.onSurface),',
    'AppTypography.labelMediumStatic(AppLightColors.onPrimary),': 'AppTypography.labelMediumStatic(AppDarkColors.onPrimary),',
    'AppTypography.labelSmallStatic(AppLightColors.onSurface).copyWith(': 'AppTypography.labelSmallStatic(AppDarkColors.onSurface).copyWith(',
    'AppTypography.labelSmallStatic(AppLightColors.onSurface),': 'AppTypography.labelSmallStatic(AppDarkColors.onSurface),',
    'AppTypography.captionStatic(AppLightColors.onSurface),': 'AppTypography.captionStatic(AppDarkColors.onSurface),',
    'AppTypography.labelMediumStatic(AppLightColors.onPrimary),': 'AppTypography.labelMediumStatic(AppDarkColors.onPrimary),',
}

# First pass: replace all with light theme versions
for old, new in light_replacements.items():
    content = content.replace(old, new)

# Second pass: replace dark theme section (after line 500)
lines = content.split('\n')
in_dark = False
for i, line in enumerate(lines):
    if 'static ThemeData get dark' in line:
        in_dark = True
    if in_dark:
        for old, new in dark_replacements.items():
            line = line.replace(old, new)
        lines[i] = line

content = '\n'.join(lines)

with open('lib/core/theme/app_theme.dart', 'w') as f:
    f.write(content)

print("Done fixing theme")