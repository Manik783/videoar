// Register iOS video fix component
AFRAME.registerComponent('ios-video-fix', {
    init: function() {
        const el = this.el;
        const video = document.querySelector('#ar-video');
        
        if (video) {
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.muted = true;
            video.loop = false;
            
            video.addEventListener('loadeddata', () => {
                if (el.components.material && el.components.material.material.map) {
                    el.components.material.material.map.needsUpdate = true;
                }
            });
            
            video.addEventListener('canplay', () => {
                if (el.components.material && el.components.material.material.map) {
                    el.components.material.material.map.needsUpdate = true;
                }
            });
        }
    }
});

// Register gesture handler component
AFRAME.registerComponent('gesture-handler', {
    schema: {
        minScale: { type: 'number', default: 0.5 },
        maxScale: { type: 'number', default: 3 }
    },

    init: function() {
        this.scaleFactor = 1;
        this.initialDistance = 0;
        this.initialScale = this.el.object3D.scale.clone();
        
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
            const touch1 = this.touches[0];
            const touch2 = this.touches[1];
            this.initialDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            this.initialScale = this.el.object3D.scale.clone();
        } else if (this.touches.length === 1) {
            this.isDragging = true;
            this.lastTouch = this.touches[0];
        }
    },

    onTouchMove: function(evt) {
        evt.preventDefault();
        this.touches = Array.from(evt.touches);
        
        if (this.touches.length === 2) {
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

// Main application
document.addEventListener('DOMContentLoaded', function() {
    const scene = document.querySelector('#ar-scene');
    const video = document.querySelector('#ar-video');
    const videoEntity = document.querySelector('#ar-video-entity');
    const loadingScreen = document.querySelector('#loading-screen');
    const loadingStatus = document.querySelector('#loading-status');
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
    const retryBtn = document.querySelector('#retry-btn');

    let isVideoPlaying = false;
    let isVideoMuted = true;
    let userInteracted = false;
    let loadingTimeout;
    let retryCount = 0;
    const maxRetries = 3;

    // iOS detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const iosVersion = isIOS ? parseFloat(navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/)?.[0]?.replace('OS ', '').replace(/_/g, '.') || '0') : 0;
    
    console.log('Device detected:', isIOS ? `iOS ${iosVersion}` : 'Non-iOS');

    // Loading timeout handler
    function handleLoadingTimeout() {
        loadingTimeout = setTimeout(() => {
            if (loadingScreen.style.display !== 'none') {
                retryCount++;
                console.log(`Loading timeout, retry ${retryCount}/${maxRetries}`);
                
                if (retryCount < maxRetries) {
                    updateLoadingStatus('Retrying AR initialization...');
                    setTimeout(() => {
                        location.reload();
                    }, 2000);
                } else {
                    showError('AR failed to load after multiple attempts. Please check your camera permissions and refresh the page.');
                }
            }
        }, 15000);
    }

    function updateLoadingStatus(message) {
        if (loadingStatus) {
            loadingStatus.textContent = message;
        }
    }

    // Check AR support
    const checkARSupport = async () => {
        try {
            if (isIOS) {
                if (iosVersion < 11.3) {
                    return false;
                }
                return true;
            }
            
            if (navigator.userAgent.includes('Chrome') && !isIOS) {
                return true;
            }
            
            return false;
        } catch (e) {
            console.error('AR support check failed:', e);
            return false;
        }
    };

    // iOS specific camera setup
    async function initIOSCamera() {
        if (isIOS) {
            try {
                updateLoadingStatus('Requesting camera access...');
                
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 640, max: 1280 },
                        height: { ideal: 480, max: 720 },
                        frameRate: { ideal: 30, max: 60 }
                    }
                });
                
                updateLoadingStatus('Camera access granted, initializing AR...');
                
                // Stop the stream - we just needed permission
                stream.getTracks().forEach(track => track.stop());
                
                // Small delay before AR initialization
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                return true;
            } catch (err) {
                console.error('iOS camera initialization failed:', err);
                throw err;
            }
        }
        return true;
    }

    // Scene ready detection
    function waitForSceneReady() {
        updateLoadingStatus('Loading AR scene...');
        
        // Multiple event listeners for better compatibility
        scene.addEventListener('loaded', onSceneLoaded);
        scene.addEventListener('renderstart', onSceneLoaded);
        
        // Check if already loaded
        if (scene.hasLoaded) {
            onSceneLoaded();
            return;
        }
        
        // Fallback check
        let fallbackChecks = 0;
        const fallbackInterval = setInterval(() => {
            fallbackChecks++;
            
            if (scene.is('ar-mode') || scene.systems.arjs || fallbackChecks > 10) {
                clearInterval(fallbackInterval);
                if (fallbackChecks <= 10) {
                    onSceneLoaded();
                } else {
                    console.warn('Scene loading fallback timeout');
                    // Try to proceed anyway
                    onSceneLoaded();
                }
            }
        }, 1000);
    }

    function onSceneLoaded() {
        console.log('AR Scene loaded successfully');
        clearTimeout(loadingTimeout);
        hideLoadingScreen();
        
        // Setup video for iOS
        if (isIOS && video) {
            video.muted = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
        }
        
        // Show instructions for first-time users
        setTimeout(() => {
            if (!localStorage.getItem('instructionsShown')) {
                instructions.style.display = 'block';
                localStorage.setItem('instructionsShown', 'true');
            } else {
                instructions.style.display = 'none';
            }
        }, 1000);
    }

    // Initialize AR
    async function initAR() {
        try {
            updateLoadingStatus('Checking device compatibility...');
            
            const supported = await checkARSupport();
            if (!supported) {
                let errorMsg = 'AR not supported on this device. ';
                if (isIOS) {
                    errorMsg += `Detected iOS ${iosVersion}. Requires iOS 11.3+ with Safari.`;
                } else {
                    errorMsg += 'Requires Chrome 79+ on Android or Safari on iOS 11.3+';
                }
                showError(errorMsg);
                return;
            }

            // Start loading timeout
            handleLoadingTimeout();

            // iOS specific initialization
            if (isIOS) {
                await initIOSCamera();
            } else {
                updateLoadingStatus('Requesting camera access...');
                await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    } 
                });
                updateLoadingStatus('Camera access granted, initializing AR...');
            }

            // Wait for scene to be ready
            waitForSceneReady();
            
        } catch (err) {
            clearTimeout(loadingTimeout);
            console.error('AR initialization error:', err);
            
            let errorMsg = 'Error initializing AR: ';
            if (err.name === 'NotAllowedError') {
                errorMsg += 'Camera access denied. Please allow camera permissions and refresh.';
            } else if (err.name === 'NotFoundError') {
                errorMsg += 'No camera found on device.';
            } else {
                errorMsg += err.message;
            }
            
            showError(errorMsg);
        }
    }

    // Event listeners
    playPauseBtn.addEventListener('click', togglePlayPause);
    unmuteBtn.addEventListener('click', toggleMute);
    volumeControl.addEventListener('input', setVolume);
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    exitBtn.addEventListener('click', exitAR);
    
    closeInstructions.addEventListener('click', () => {
        instructions.style.display = 'none';
    });
    
    errorClose.addEventListener('click', () => {
        errorMessage.classList.add('hidden');
    });

    retryBtn.addEventListener('click', () => {
        errorMessage.classList.add('hidden');
        loadingScreen.style.display = 'flex';
        retryCount = 0;
        initAR();
    });

    // Video tap to play/pause
    if (videoEntity) {
        videoEntity.addEventListener('click', togglePlayPause);
    }

    // Functions
    function hideLoadingScreen() {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }

    function togglePlayPause() {
        userInteracted = true;
        
        if (!isVideoPlaying) {
            video.play().then(() => {
                isVideoPlaying = true;
                playPauseBtn.textContent = '⏸️';
                console.log('Video playing');
                
                // Update texture for iOS
                if (isIOS && videoEntity.components.material && videoEntity.components.material.material.map) {
                    videoEntity.components.material.material.map.needsUpdate = true;
                }
            }).catch(err => {
                console.error('Video play error:', err);
                showError('Unable to play video. Try tapping the play button again.');
            });
        } else {
            video.pause();
            isVideoPlaying = false;
            playPauseBtn.textContent = '▶️';
        }
    }

    function toggleMute() {
        if (!userInteracted) {
            showError('Please play the video first, then unmute.');
            return;
        }
        
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
        if (video) {
            video.volume = volumeControl.value;
        }
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

    // Video event handlers
    if (video) {
        video.addEventListener('loadedmetadata', () => {
            console.log('Video metadata loaded');
        });

        video.addEventListener('canplay', () => {
            console.log('Video can play');
            if (isIOS && videoEntity.components.material && videoEntity.components.material.material.map) {
                videoEntity.components.material.material.map.needsUpdate = true;
            }
        });

        video.addEventListener('error', (e) => {
            console.error('Video error:', e);
            showError('Video failed to load. Please check your video file.');
        });

        video.addEventListener('ended', () => {
            isVideoPlaying = false;
            playPauseBtn.textContent = '▶️';
        });
    }

    // Prevent default touch behaviors
    document.addEventListener('touchmove', (e) => {
        if (e.target.closest('a-scene')) {
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1 && e.target.closest('a-scene')) {
            e.preventDefault();
        }
    }, { passive: false });

    // Start AR initialization
    console.log('Starting AR initialization...');
    initAR();
});
