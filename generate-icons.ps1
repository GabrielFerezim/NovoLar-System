Add-Type -AssemblyName System.Drawing

# Create a 256x256 bitmap
$bmp = New-Object System.Drawing.Bitmap(256, 256)
$g = [System.Drawing.Graphics]::FromImage($bmp)

# Set high quality rendering options
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Clear background to transparent
$g.Clear([System.Drawing.Color]::Transparent)

# Draw rounded teal card background (#12798a)
$tealBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 18, 121, 138))
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 48 # radius for rounded corners
$rect = New-Object System.Drawing.Rectangle(12, 12, 232, 232)
$path.AddArc($rect.X, $rect.Y, $r*2, $r*2, 180, 90)
$path.AddArc($rect.Right - $r*2, $rect.Y, $r*2, $r*2, 270, 90)
$path.AddArc($rect.Right - $r*2, $rect.Bottom - $r*2, $r*2, $r*2, 0, 90)
$path.AddArc($rect.X, $rect.Bottom - $r*2, $r*2, $r*2, 90, 90)
$path.CloseFigure()
$g.FillPath($tealBrush, $path)

# Draw Roof (Telhado) - Red (#d82d33)
$redBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 216, 45, 51))
# Scaled roof coordinates: M 3 13 L 16 3 L 29 13 L 25 13 L 16 5.5 L 7 13 Z
# x*5 + 48, y*5 + 48
$roofPoints = @(
    (New-Object System.Drawing.PointF(63, 113)),
    (New-Object System.Drawing.PointF(128, 63)),
    (New-Object System.Drawing.PointF(193, 113)),
    (New-Object System.Drawing.PointF(173, 113)),
    (New-Object System.Drawing.PointF(128, 75.5)),
    (New-Object System.Drawing.PointF(83, 113))
)
$g.FillPolygon($redBrush, $roofPoints)

# Helper function to draw rounded rectangles for windows
function FillRoundedRect($graphics, $brush, $x, $y, $w, $h, $radius) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc($x, $y, $radius*2, $radius*2, 180, 90)
    $p.AddArc($x + $w - $radius*2, $y, $radius*2, $radius*2, 270, 90)
    $p.AddArc($x + $w - $radius*2, $y + $h - $radius*2, $radius*2, $radius*2, 0, 90)
    $p.AddArc($x, $y + $h - $radius*2, $radius*2, $radius*2, 90, 90)
    $p.CloseFigure()
    $graphics.FillPath($brush, $p)
}

# Draw Windows - Yellow (#f3b41d)
# Each window: w = 35, h = 35, rx = 7.5 (so radius = 7.5)
$yellowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 243, 180, 29))
$winRadius = 7.5

# Top-Left window (8, 14) -> (88, 118)
FillRoundedRect $g $yellowBrush 88 118 35 35 $winRadius

# Top-Right window (17, 14) -> (133, 118)
FillRoundedRect $g $yellowBrush 133 118 35 35 $winRadius

# Bottom-Left window (8, 22) -> (88, 158)
FillRoundedRect $g $yellowBrush 88 158 35 35 $winRadius

# Bottom-Right window (17, 22) -> (133, 158)
FillRoundedRect $g $yellowBrush 133 158 35 35 $winRadius

# Ensure the output directory exists
$outDir = "c:\Users\Gabriel\AppData\Local\Temp" # fallback, but we write to target
New-Item -ItemType Directory -Force -Path "c:\Users\Gabriel\.gemini\antigravity-ide\scratch\constru-control\public" | Out-Null

# Save the image
$bmp.Save("c:\Users\Gabriel\.gemini\antigravity-ide\scratch\constru-control\public\app-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Clean up resources
$tealBrush.Dispose()
$redBrush.Dispose()
$yellowBrush.Dispose()
$g.Dispose()
$bmp.Dispose()

Write-Host "Icon app-icon.png generated successfully!"
