(function() {
    'use strict';

    const LOADER_ID = 'digimun-global-loader';
    const MIN_DISPLAY_TIME = 300;
    let loaderElement = null;
    let showTimestamp = 0;
    let hideTimeout = null;
    let isInitialized = false;

    const LOADER_HTML = `
        <div class="digimun-loader-container">
            <div class="digimun-logo-wrapper">
                <svg class="digimun-d-logo" viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg">
                    <path class="digimun-d-outline" pathLength="1" d="
                        M 8 2
                        L 8 108
                        L 50 108
                        C 85 108, 98 85, 98 55
                        C 98 25, 85 2, 50 2
                        L 8 2
                        M 26 22
                        L 48 22
                        C 70 22, 80 35, 80 55
                        C 80 75, 70 88, 48 88
                        L 26 88
                        L 26 22
                    "/>
                    <path class="digimun-d-fill" d="
                        M 8 2
                        L 50 2
                        C 85 2, 98 25, 98 55
                        C 98 85, 85 108, 50 108
                        L 8 108
                        L 8 2
                        Z
                        M 26 22
                        L 26 88
                        L 48 88
                        C 70 88, 80 75, 80 55
                        C 80 35, 70 22, 48 22
                        L 26 22
                        Z
                    " fill-rule="evenodd"/>
                </svg>
            </div>
            <div class="digimun-loading-text">
                LOADING<span class="digimun-loading-dots"><span class="digimun-dot">.</span><span class="digimun-dot">.</span><span class="digimun-dot">.</span></span>
            </div>
        </div>
    `;

    function injectCSS() {
        if (document.getElementById('digimun-loader-styles')) return;
        
        const link = document.createElement('link');
        link.id = 'digimun-loader-styles';
        link.rel = 'stylesheet';
        link.href = 'global-loader.css';
        document.head.appendChild(link);
    }

    function createLoader() {
        if (document.getElementById(LOADER_ID)) {
            loaderElement = document.getElementById(LOADER_ID);
            return;
        }

        loaderElement = document.createElement('div');
        loaderElement.id = LOADER_ID;
        loaderElement.innerHTML = LOADER_HTML;
        document.body.appendChild(loaderElement);
    }

    function init() {
        if (isInitialized) return;
        
        injectCSS();
        
        if (document.body) {
            createLoader();
            isInitialized = true;
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                createLoader();
                isInitialized = true;
            });
        }
    }

    function showLoader() {
        if (!isInitialized) init();
        
        if (!loaderElement) {
            createLoader();
        }

        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        showTimestamp = Date.now();
        loaderElement.classList.add('visible');
    }

    function hideLoader() {
        if (!loaderElement) return;

        const elapsed = Date.now() - showTimestamp;
        const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

        if (remaining > 0) {
            hideTimeout = setTimeout(function() {
                loaderElement.classList.remove('visible');
                hideTimeout = null;
            }, remaining);
        } else {
            loaderElement.classList.remove('visible');
        }
    }

    function isLoaderVisible() {
        return loaderElement && loaderElement.classList.contains('visible');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.DigiLoader = {
        show: showLoader,
        hide: hideLoader,
        isVisible: isLoaderVisible,
        init: init
    };

    window.showLoader = showLoader;
    window.hideLoader = hideLoader;

})();
