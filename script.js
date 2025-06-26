// Register custom A-Frame components
AFRAME.registerComponent('gesture-handler', {
    schema: {
        minScale: { type: 'number', default: 0.5 },
        maxScale: { type: 'number', default: 3 }
    },

    init: function() {
        this.scaleFactor = 1;
        this.initialDistance = 0;
        this.initialScale = this.el.object3D.scale.clone();
        
        // Touch event handlers for iOS
        this.el.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.el.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.el.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        this.touches = [];
        this.isDragging = false;
    },

    onTouchStart: function(evt) {
        evt.preventDefault();
        this.touches = Array.from(evt.touches);
        
        if (this.touches.length === 2) {
            // Pinch gesture
            const touch1 = this.touches[0];
            const touch2 = this.touches[1];
            this.initialDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            this.initialScale = this.el.object3D.scale.clone();
        } else if (this.touches.length === 1) {
            // Single touch for dragging
            this.isDragging = true;
            this.lastTouch = this.touches[0];
        }
    },

    onTouchMove: function(evt) {
        evt.preventDefault();
        this.touches = Array.from(evt.touches);
        
        if (this.touches.length === 2) {
            // Handle pinch scaling
            const touch1 = this.touches[0];
            const touch2 = this.touches[1];
            const currentDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            const scale = (currentDistance / this.initialDistance);
            const clampedScale = Math.max(this.data.minScale, 
                                        Math.min(this.data.maxScale, scale));
            
            this.el.object3D.scale.x = this.initialScale.x * clampedScale;
            this.el.object3D.scale.y = this.initialScale.y * clampedScale;
            this.el.object3D.scale.z = this.initialScale.z * clampedScale;
        } else if (this.touches.length === 1 && this.isDragging) {
            // Handle dragging
            const touch = this.touches[0];
            const deltaX = (touch.clientX - this.lastTouch.clientX) * 0.01;
            const deltaY = -(touch.clientY - this.lastTouch.clientY) * 0.01;
            
            this.el.object3D.position.x += deltaX;
            this.el.object3D.position.y += deltaY;
            
            this.lastTouch = touch;
        }
    },

    onTouchEnd: function(evt) {
        this.touches = Array.from(evt.touches);
        if (this.touches.length < 2) {
            this.isDragging = false;
        }
    }
});

// Main application logic
document.addEventListener('DOMContentLoaded', function() {
    const scene = document.querySelector('a-scene');
    const video = document.querySelector('#ar-video');
    const videoEntity = document.querySelector('#ar-video-entity');
    const loadingScreen = document.querySelector('#loading-screen');
    const playPauseBtn = document.querySelector('#play-pause-btn');
    const unmuteBtn = document.querySelector('#unmute-btn');
    const volumeControl = document.querySelector('#volume-control');
    const fullscreenBtn = document.querySelector('#fullscreen-btn');
    const exitBtn = document.querySelector('#exit-ar-btn');
    const instructions = document.querySelector('#instructions');
    const closeInstructions = document.querySelector('#close-instructions');
    const errorMessage = document.querySelector('#error-message');
    const errorText = document.querySelector('#error-text');
    const errorClose = document.querySelector('#error-close');

    let isVideoPlaying = false;
    let isVideoMuted = true;

    // iOS detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const iosVersion = isIOS ? parseFloat(navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/)?.[0]?.replace('OS ', '').replace(/_/g, '.') || '0') : 0;
    
    // Check AR support
    const checkARSupport = async () => {
        try {
            if (isIOS && iosVersion < 11.3) {
                return false;
            }
            
            if ('xr' in navigator) {
                try {
                    const supported = await navigator.xr.isSessionSupported('immersive-ar');
                    if (supported) return true;
                } catch (e) {
                    console.log('WebXR not supported, falling back to WebAR');
                }
            }
            
            // For iOS Safari, we rely on AR.js compatibility
            if (isIOS && iosVersion >= 11.3) {
                return true;
            }
            
            // For Android Chrome
            if (navigator.userAgent.includes('Chrome') && !isIOS) {
                return true;
            }
            
            return false;
        } catch (e) {
            console.error('AR support check failed:', e);
            return false;
        }
    };

    // Enhanced AR initialization with WebXR testing
    async function initAR() {
        try {
            // First check if WebXR is actually available
            if (isIOS && (!('xr' in navigator) || !navigator.xr)) {
                showError(`
                    WebXR not enabled. To use AR:
                    1. Open Settings → Safari → Advanced
                    2. Enable "Experimental Features"
                    3. Turn on "WebXR Device API" and "WebXR Augmented Reality Mode"
                    4. Restart Safari and reload this page
                    
                    <button id="reload-btn" style="margin-top:15px;padding:10px;background:#007AFF;color:white;border:none;border-radius:5px;">
                        Reload After Enabling
                    </button>
                `);
                document.getElementById('reload-btn').addEventListener('click', () => {
                    window.location.reload();
                });
                return;
            }

            // Then check AR support
            const supported = await checkARSupport();
            if (!supported) {
                let errorMsg = 'AR not supported. ';
                if (isIOS) {
                    errorMsg += `Detected iOS ${iosVersion}. `;
                    if (iosVersion < 11.3) {
                        errorMsg += 'Requires iOS 11.3+';
                    } else {
                        errorMsg += 'Try enabling WebXR in Safari Experimental Features';
                    }
                } else {
                    errorMsg += 'Requires Chrome 79+ on Android';
                }
                showError(errorMsg);
                return;
            }

            // Request camera permissions
            const cameraTimeout = setTimeout(() => {
                showError('Camera access taking too long. Please refresh and allow permissions.');
            }, 10000);

            try {
                await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    } 
                });
                
                clearTimeout(cameraTimeout);
                
                // iOS-specific scene configuration
                if (isIOS) {
                    scene.setAttribute('arjs', 'sourceType: webcam; debugUIEnabled: false; trackingMethod: best;');
                    scene.setAttribute('renderer', 'antialias: true; alpha: true; precision: medium;');
                }
                
                scene.addEventListener('loaded', hideLoadingScreen);
                
            } catch (err) {
                clearTimeout(cameraTimeout);
                showError(`Camera access required for AR: ${err.message}`);
                console.error('Camera error:', err);
            }
        } catch (err) {
            showError(`Error initializing AR: ${err.message}`);
        }
    }

    // Start AR initialization
    initAR();

    // Event listeners
    playPauseBtn.addEventListener('click', togglePlayPause);
    unmuteBtn.addEventListener('click', toggleMute);
    videoEntity.addEventListener('click', togglePlayPause);
    volumeControl.addEventListener('input', setVolume);
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    exitBtn.addEventListener('click', exitAR);
    closeInstructions.addEventListener('click', () => {
        instructions.style.display = 'none';
    });
    errorClose.addEventListener('click', () => {
        errorMessage.classList.add('hidden');
    });

    // Show instructions for first-time users
    if (!localStorage.getItem('instructionsShown')) {
        instructions.style.display = 'block';
        localStorage.setItem('instructionsShown', 'true');
    }

    // Functions
    function hideLoadingScreen() {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }

    function togglePlayPause() {
        if (!isVideoPlaying) {
            video.play().then(() => {
                isVideoPlaying = true;
                playPauseBtn.textContent = '⏸️';
            }).catch(err => {
                console.error('Video play error:', err);
                showError('Unable to play video. Try tapping the play button.');
            });
        } else {
            video.pause();
            isVideoPlaying = false;
            playPauseBtn.textContent = '▶️';
        }
    }

    function toggleMute() {
        if (isVideoMuted) {
            video.muted = false;
            isVideoMuted = false;
            unmuteBtn.textContent = '🔊';
        } else {
            video.muted = true;
            isVideoMuted = true;
            unmuteBtn.textContent = '🔇';
        }
    }

    function setVolume() {
        video.volume = volumeControl.value;
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('Fullscreen error:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    function exitAR() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        window.close();
    }

    function showError(message) {
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');
        loadingScreen.style.display = 'none';
    }

    // Handle video events
    video.addEventListener('loadedmetadata', () => {
        console.log('Video metadata loaded');
    });

    video.addEventListener('canplay', () => {
        console.log('Video can play');
    });

    video.addEventListener('error', (e) => {
        console.error('Video error:', e);
        showError('Video failed to load. Please check your video file.');
    });

    // Handle device orientation
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            if (Math.abs(window.orientation) === 90) {
                document.querySelector('#ui-controls').style.flexDirection = 'row';
            } else {
                document.querySelector('#ui-controls').style.flexDirection = 'column';
            }
        }, 100);
    });

    // Prevent default touch behaviors that interfere with AR
    document.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });
});
