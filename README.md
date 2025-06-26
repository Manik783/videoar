# Web AR Video Experience

A web-based augmented reality video player that displays videos in 3D space when users scan a QR code.

## Features
- World-space AR video playback
- Gesture controls (scale, move, play/pause)
- Mobile-first responsive design
- Cross-platform support (iOS/Android)
- Camera permission handling
- Error management

## Setup Instructions

1. Clone this repository
2. Place your video file in `assets/video.mp4`
3. Open `index.html` in a web server (required for camera access)

### Local Development Server
```bash
# Python 3
python3 -m http.server 8000
```

Then open: http://localhost:8000

## QR Code Integration

1. Generate a QR code pointing to your hosted URL
2. Test with this sample QR code (points to localhost):

![Sample QR Code](https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=http://localhost:8000)

### URL Parameters
- `?video=URL` - Load different video content
- `?size=W,H` - Set custom video dimensions (in meters)

## Testing Checklist

### Device Compatibility
- [ ] iPhone (iOS 12+)
- [ ] Android (Chrome 67+)
- [ ] Tablet devices

### Functionality
- [ ] QR code scanning opens AR experience
- [ ] Camera permission requested
- [ ] Video plays automatically
- [ ] Gesture controls work (pinch, drag, tap)
- [ ] UI controls function (play/pause, volume, fullscreen)
- [ ] Error messages display properly

### Performance
- [ ] Video loads within 5 seconds on 4G
- [ ] AR tracking remains stable
- [ ] No significant battery drain

## Deployment

### GitHub Pages
1. Push to `gh-pages` branch
2. Enable GitHub Pages in repo settings

### Netlify
1. Drag and drop project folder
2. Set publish directory to project root

## Troubleshooting

### Common Issues
1. **Camera not working**:
   - Ensure you're using HTTPS
   - Check browser permissions
   - Try different browser

2. **Video not playing**:
   - Verify video is in MP4 format
   - Check CORS headers if hosted remotely
   - Ensure video codec is supported (H.264)

3. **AR not initializing**:
   - Check WebXR/WebAR support
   - Try on different device
   - Ensure good lighting conditions

## Analytics Implementation

To add analytics tracking, modify the `trackEvent` function in `script.js`:

```javascript
function trackEvent(category, action, label) {
    // Example: Google Analytics
    if (window.gtag) {
        gtag('event', action, {
            'event_category': category,
            'event_label': label
        });
    }
}