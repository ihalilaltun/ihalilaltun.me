// We’ll start with some wrapper code, which will contain our whole library.
// It’s your typical immediately invoked function expression (IIFE).
var frizbit = frizbit || {};
(function (frizbit) {
 
    // private properties
    var settings = {
        appkey: "28cbd76d-df79-4244-a4a8-b245e1df8f9a",
        host_url: "https://api.frizbit.com",
        is_dev: false,
        client_version: 171205,
        api_version: 1,
        service_worker_path: "/FrizbitServiceWorker.js", // FrizbitServiceWorker.js
        service_updater_path: "/FrizbitUpdateWorker.js", // FrizbitUpdateWorker.js
        safari_web_push_id: "web.com.frizbit.auto3c12ac5f",
        initialization_options: null,
        isPushNotificationsSupported: false,
        isStorageSupported: false,
        autoRegister: true,
        subdomain: null,
        httpEnabled: false,
        notifyEnabled: false,
        sessionIframeAdded: false,
        notifyDelay: 7,
        debug: false,
        notifyAfterVisit: 1,
        path: null,
        isIncognito: false,
        setup: false,
        welcomeNotification: false
    }

    var user = {
        alias: [],
        segments: [],
        tags: {},
        user_id: null,
        deviceToken: null,
        subscriptionEndpoint: null,
        p256dh: null,
        auth: null,
        subscriptionStatus: "undefined",
        language: navigator.language,
        timezone: new Date().getTimezoneOffset(), // time difference between UTC time and local time, in minutes.
     }
 
    // public methods and properties
    frizbit.initalized = false;

    frizbit.sendSegment = function(value) {
        log("INFO: sendSegment function called");
        var segmentsArray = new Array(value);
        frizbit.sendSegments(segmentsArray);
    }

    frizbit.sendSegments = function(segmentsArray) {
        log("INFO: sendSegments function called");
        Array.prototype.push.apply(user.segments, segmentsArray);
        log("INFO: currentSegments:" + user.segments);
        frizbit.isPushNotificationsAllowed(function(result){
            if (result){
                sendSegmentsToFrizbit('PUT');
            } else {
                //TODO: segments to sends
            }
        });
    }

    frizbit.sendTag = function(key, value) {
        log("INFO: sendTag function called");
        user.tags[key] = value;
        frizbit.sendTags(user.tags);
    }

    frizbit.sendTags = function(tagsPair) {
        log("INFO: sendTags function called");
        for (var key in tagsPair){
            user.tags[key] = tagsPair[key];
        }
        log("INFO: currentTags:" + JSON.stringify(user.tags));
        frizbit.isPushNotificationsAllowed(function(result){
            if (result){
                sendTagsToFrizbit('PUT');
            } else {
                //TODO: tags to sends
            }
        });
    }

    frizbit.sendNotification = function() {
        log("INFO: sendNotification function called");

        var requestUrl = "https://frizbit.com/pusher.php?token="+user.user_id+"&api_key="+settings.appKey;

        var contents = {
            method: "GET"
            //mode: 'no-cors', //TODO no-cors is disabled for non-serviceworker.
            //credentials: 'include'
        };

        fetch(requestUrl, contents).then(function status (response) {
            console.log("INFO: response:" + response);
            if (response.status >= 200 && response.status < 300) {
                return Promise.resolve(response);
            } else {
                return Promise.reject(new Error(response.statusText));
            }
        });
    }

    frizbit.init = function(options) {
        log("INFO: init function called");

        if (typeof(options) !== "undefined" && options !== null) {
        //Store intialization options for later use
        settings.initialization_options = options;

        //parse initialization options
            if (typeof(options.autoRegister) !== "undefined" && options.autoRegister !== null){
                settings.autoRegister = options.autoRegister;
                log("INFO: set autoRegister:" + settings.autoRegister);
            }

            if (typeof(options.is_dev) !== "undefined" && options.is_dev !== null){
                settings.is_dev = options.is_dev;
                log("INFO: set Development mode:" + settings.is_dev);
            }

            if (typeof(options.safari_web_push_id) !== "undefined" && options.safari_web_push_id !== null){
                settings.safari_web_push_id = options.safari_web_push_id;
                log("INFO: set safari push id:" + settings.safari_web_push_id);
            }

            if (typeof(options.subdomain) !== "undefined" && options.subdomain !== null){
                settings.subdomain = options.subdomain;
                log("INFO: subdomain:" + settings.subdomain);
            }

            if (typeof(options.notifyBox) !== "undefined" && options.notifyBox !== null){
                settings.notifyEnabled = options.notifyBox.enabled;
                log("INFO: notifyEnabled:" + settings.notifyEnabled);
            }

            if (typeof(options.debug) !== "undefined" && options.debug !== null){
                settings.debug = options.debug;
                log("INFO: set debug:" + settings.debug);
            }

            if (typeof(options.path) !== "undefined" && options.path !== null){
                settings.path = options.path;
                log("INFO: set path:" + settings.path);
            }
        }

        //Check Push notification support for current user agent
        settings.isPushNotificationsSupported = checkPushNotificationsSupport();

        //Check local and session storage support
        settings.isStorageSupported = checkStorageSupport();

        //Get user_id if available for later use
        getStorageValue('localStorage','userId', function(val) {
            user.user_id = val;
        });

        log("INFO: user_id :" + user.user_id);

        //Get&increment visit counts
        var visitCount = getStorageValue('sessionStorage','visitCount');
        if (visitCount) {
            visitCount++;
            setStorageValue('sessionStorage','visitCount',visitCount);
        } else {
            setStorageValue('sessionStorage','visitCount', 1);
        }

        //If notification not support return immediately
        if (!settings.isPushNotificationsSupported[0]) {
            log("WARN: Push notifications are not supported.");
            frizbit.initalized = true;
            return;
        }

        //Set development or production endpoints
        if (settings.is_dev) {
            settings.host_url = "https://test.frizbit.com";
        }

        if (!checkSupportedSafari() && (!supportsDirectPermission() || (settings.subdomain !== null || settings.path !== null ))) {
            settings.httpEnabled = true;
            addSessionIframe();
        }

        log("INFO: http enabled:" + settings.httpEnabled);

        // If Safari - add 'fetch' pollyfill if it isn't already added.
        if (settings.isPushNotificationsSupported[1] === "Safari" && typeof window.fetch == "undefined") {
            var s = document.createElement('script');
            s.setAttribute('src', "https://cdnjs.cloudflare.com/ajax/libs/fetch/0.9.0/fetch.js");
            document.head.appendChild(s);
        }

        if (settings.httpEnabled == false) {
            //If document fully loaded start setup
            if (document.readyState === "interactive" || document.readyState === "complete") {
                preSetupCheck();
            } else {
                if (document.addEventListener) {
                    window.addEventListener("load", preSetupCheck);
                } else {
                    document.attachEvent("onload", preSetupCheck)
                }
            }
        }
    }

    /**
    * Http init function
    */
    frizbit._initHttp = function (options) {
        log("INFO: _initHttp function called");

        if (typeof(options) !== "undefined" && options !== null) {
            //Store intialization options for later use
            settings.initialization_options = options;
            settings.httpEnabled = true;
            settings.initialization_options.origin = document.referrer;
        }

        //Parent iframe'ın parentı
        //Opener popup acan parent
        var isIframe = (parent != null && parent != window);
        var creator = opener || parent;

        //Check local and session storage support
        settings.isStorageSupported = checkStorageSupport();

        if (!creator) {
            log("ERROR:_initHttp: No opener or parent found!");
            return;
        }

        var messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = function (event) { 
            log("INFO: _initHttp.messageChannel.port1.onmessage", event);
        };


        //Get user_id if available for later use
        getStorageValue('localStorage','userId', function(val) {
            user.user_id = val;
        });

        log("INFO: user_id :" + user.user_id);

        if (!user.user_id) {
            log("INFO: no user_id found");
            if (!isIframe) {
                log("INFO: not an iframe");
                registerForW3CPushAPI();
                log("INFO: after registration");
            }
            safePostMessage(creator, {noInformation: true}, settings.initialization_options.origin, [messageChannel.port2]);
        } else {
            log("INFO: user_id found");
            safePostMessage(creator, {userInformation: user}, settings.initialization_options.origin, [messageChannel.port2]);
        }
    }

    /**
    * Proper way to calling public methods
    */
    frizbit.push = function (argument) {
        log("INFO: push function called");
        if (typeof(argument) == "function") {
            argument();
        } else {
            var functionName = argument.shift();
            
            function sleepBeforeInit(functionName, argument) {
                function sleep() { // consider this to be start of fizz
                    setTimeout(finished, 5000); // start wait
                } // code split here for timeout break
                function finished() { // after wait
                    frizbit[functionName].apply(null, argument);
                } // end of fizz
                if(functionName != 'init') {
                    sleep(); // start it
                } else {
                    frizbit[functionName].apply(null, argument);
                }
                
            }
            sleepBeforeInit(functionName, argument);
        }
    }

    /**
    * Check whether if current user allowed to receive notificaitons
    */
    frizbit.isPushNotificationsAllowed =  function (callback) {
        log("INFO: isPushNotificationsAllowed function called");
        // If notification is supported by current user agent and user doesn't choose any permission
        if (settings.isPushNotificationsSupported[0]) {
            if (settings.isPushNotificationsSupported[1] === "Safari" && 'safari' in window && 'pushNotification' in window.safari) {

                var permissionData = window.safari.pushNotification.permission(settings.safari_web_push_id);
                user.deviceToken = permissionData.deviceToken;
                if (user.user_id && user.deviceToken && Notification.permission === "granted") {
                    log("INFO: Already subscribed");
                    setStorageValue('sessionStorage','FRIZBIT_SESSION',true);
                    callback(true);
                } else {
                    callback(false);
                }
            } else if ((settings.isPushNotificationsSupported[1] ===  "Chrome" || settings.isPushNotificationsSupported[1] === "Firefox") && 'serviceWorker' in navigator) {
                
                if (settings.httpEnabled == true) {
                    if (settings.sessionIframeAdded == true) {
                        if (user.user_id !== null)
                            callback(true);
                        else
                            callback(false);
                    } else { //sessionIframe eklenmemis
                        callback(false);
                    }

                } else if (Notification.permission !== "denied") {

                    navigator.serviceWorker.getRegistrations().then(function(serviceWorkerRegistrations) {

                        var isServiceWorkerActive  = false;

                        serviceWorkerRegistrations.forEach(function(serviceWorkerRegistration) {
                            if (serviceWorkerRegistration.active &&
                                serviceWorkerRegistration.active.state === 'activated' &&
                                ((serviceWorkerRegistration.active.scriptURL.indexOf('FrizbitServiceWorker') > -1) || (serviceWorkerRegistration.active.scriptURL.indexOf('FrizbitUpdateWorker') > -1))) {
                                    isServiceWorkerActive = true;
                            }
                        });

                        if (isServiceWorkerActive) {
                            navigator.serviceWorker.getRegistration().then(function (registration) {
                                registration.pushManager.getSubscription().then(function(subscription) {
                                    if (subscription) {
                                        log("got subscription id: ", subscription.endpoint);
                                        user.deviceToken = subscription.endpoint.replace(new RegExp("^(https://android.googleapis.com/gcm/send/|https://updates.push.services.mozilla.com/wpush/v1/)"), "");
                                        if (user.user_id && user.deviceToken && Notification.permission === "granted" && isServiceWorkerActive) {
                                            log("INFO: Already subscribed");
                                            log("INFO: user.deviceToken:" + user.deviceToken);
                                            setStorageValue('sessionStorage','FRIZBIT_SESSION',true);
                                            updateServiceWorker();
                                            callback(true);
                                        } else {
                                            callback(false);
                                        }  
                                    } else {
                                        callback(false);
                                    }
                                });
                            }).catch(function (error) {
                                log("ERROR: Getting registration error: " + error);
                                callback(false);
                            });
        
                        } else {
                            callback(false);
                        }   
                    });
                }
            } else {
                log("WARN: Unsupported Browser"); 
                callback(false);
            }
        }
    }

    /**
    * Check push notification support for current browser
    */
    frizbit.isPushNotificationsSupported = function () {
        log("INFO: isPushNotificationsSupported function called");
        return checkPushNotificationsSupport();
    }

    /**
    * Don't autoregister, use for manual registration
    */
    frizbit.registerForPushNotifications = function (options) {
        log("INFO: registerForPushNotifications function called");
        settings.fromRegisterFor = true;
        setup();
    }
 
    // private methods

    /**
    * Console log wrapper for development enviroment
    */
    function log(message, args) {
        //if we are in development mode
        if (settings.is_dev || settings.debug) {
            if (typeof args !== "undefined") {
                console.log(message, args);
            } else {
                console.log(message);
            }
        }
    };

    /**
    * Check local&session storage is supported and available
    */
    function checkStorageSupport(){
        log("INFO: checkStorageSupport function called");
        try {
            var localStorage = window['localStorage'],
            x = '__storage_test__';
            localStorage.setItem(x, x);
            localStorage.removeItem(x);

            var sessionStorage = window['sessionStorage'];
            sessionStorage.setItem(x, x);
            sessionStorage.removeItem(x);

            return true;
        }
        catch(e) {
            return false;
        }
    }

    /**
    * Get value from local or session storage
    */
    function getStorageValue(storageType, key, callback){
        log("INFO: getStorageValue function called");
        if (!settings.isStorageSupported)
            return false;
        var storage = window[storageType];
        var result = storage.getItem(key)
        if (result != null){
            if (callback)
                callback(result);
            else
                return result;
        } else {
            return false;
        }
            
    }

    /**
    * Set value to local or session storage
    */
    function setStorageValue(storageType, key, value, callback){
        log("INFO: setStorageValue function called");
        if (!settings.isStorageSupported)
            return false;
        var storage = window[storageType];
        storage.setItem(key, value);
        if (callback != null) {
            callback(true);
        }
    }

    /**
    * Remove a key from local or session storage
    */
    function removeStorageValue(storageType, key, callback){
        log("INFO: removeStorageValue function called");
        if (!settings.isStorageSupported)
            return false;
        var storage = window[storageType];
        storage.removeItem(key);
        if (callback != null) {
            callback(true);
        }
    }

    /**
    * Destroy local or session storage
    */
    function destroyStorage(storageType, callback){
        log("INFO: destroyStorage function called");
        if (!settings.isStorageSupported)
            return false;
        var storage = window[storageType];
        storage.clear();
        if (callback != null) {
            callback(true);
        }
    }

    /**
    * Returns api endpoint for frizbit backend
    */
    function getApiUrl () {
        log("INFO: getApiUrl function called");
        return settings.host_url + '/push/api/v' + settings.api_version;
    }

    /**
    * Returns browser name in string
    */
    function getBrowserName () {
        log("INFO: getBrowserName function called");
        if (navigator.appVersion.match(/Chrome\/(.*?) /)) {
            return "Chrome";
        } else if (navigator.appVersion.match("Version/(.*) (Safari)")) {
            return "Safari";
        } else if (navigator.userAgent.match(/Firefox\/([0-9]{2,}\.[0-9]{1,})/)) {
            return "Firefox";
        }

        return "undefined";
    };

    /**
    * Check push notifications support for safari browser
    */
    function checkSupportedSafari() {
        log("INFO: checkSupportedSafari function called");
        // Get Safari browser version
        var version = navigator.appVersion.match("Version/([0-9]+2?).* Safari");
        // Return false if it is not safari
        if (version == null) return false;
        //Return false if it is iOS device
        if(iOSSafari(navigator.userAgent)) return false;
        // Return true if it is a supported version
        return (parseInt(version[1]) > 6);
    };

    /**
    * Check safari mobile browser
    */
    function iOSSafari(userAgent){
        log("INFO: iOSSafari function called");
        return /iP(ad|od|hone)/i.test(userAgent) && /WebKit/i.test(userAgent) && !(/(CriOS|FxiOS|OPiOS|mercury)/i.test(userAgent));
    };

    /**
    * Check push notifications support for chrome browser
    */
    function checkSupportedChrome() {
        log("INFO: checkSupportedChrome function called");
        // Get Chrome browser version
        var version = navigator.appVersion.match(/Chrome\/(.*?) /);
        // Return false if it is not chrome
        if (version == null) return false;
        // Check for incognito mode
        var fs = window.RequestFileSystem || window.webkitRequestFileSystem;
        if (!fs) return false;
        fs(window.TEMPORARY, 100, function(fs) {}, function(err) {
            // Incognito mode
            settings.isIncognito = true;
        });
        // Return true if it is a supported version
        return (parseInt(version[1].substring(0, 2)) > 41);
    };

    /**
    * Check push notifications support for firefox browser
    */
    function checkSupportedFirefox() {
        log("INFO: checkSupportedFirefox function called");
        // Get Firefox browser version
        var version = navigator.userAgent.match(/(Firefox\/)([0-9]{2,}\.[0-9]{1,})/);
        // Return false if it is not firefox
        if (version == null) return false;
        // Return true if it is a supported version
        return (parseInt(version[2].substring(0, 2)) > 43);
    };

    /**
    * Check push notifications support for current user agent
    */
    function checkPushNotificationsSupport() {
        log("INFO: checkPushNotificationsSupport function called");
        if (checkSupportedSafari()) {
            log("INFO: Supported Safari Browser"); 
            return [true, "Safari"];
        }
        if (checkSupportedChrome()) {
            log("INFO: Supported Chrome Browser"); 
            return [true, "Chrome"];
        }
        if (checkSupportedFirefox()) {
            log("INFO: Supported Firefox Browser"); 
            return [true, "Firefox"];
        }

        log("WARN: Unsupported Browser"); 
        return [false, "Unsupported"];
    };

    /**
    * Check https support for browser 
    */
    function supportsDirectPermission() {
        return checkSupportedSafari() || location.protocol == 'https:'
           || location.host.indexOf("localhost") == 0
           || location.host.indexOf("127.0.0.1") == 0;
    }

    /**
    * Pre setup check for registering
    */
    function preSetupCheck () {
        log("INFO: preSetupCheck function called");
        var lastNotifyDate = getStorageValue('localStorage','lastNotify');
        if(lastNotifyDate && (new Date(lastNotifyDate).getTime() > new Date(Date.now()).getTime())){
            return;
        }

        var visitCount = getStorageValue('sessionStorage','visitCount');
        if(visitCount < settings.notifyAfterVisit){
            return;
        }

        var notifyBoxPermission = getStorageValue('localStorage','notifyPermission');
        var isIframe = (parent != null && parent != window);
        // If user is already in a session don't re-register
        // Or auto register is not enabled
        // OR notifications are already denied by user then don't register(bunu yalnızca chrome için)
        if (getStorageValue('sessionStorage','FRIZBIT_SESSION') || (settings.autoRegister == false && settings.notifyEnabled == false) || (settings.httpEnabled == true && user.user_id !== null))
            return;
        else if (settings.notifyEnabled == true && !notifyBoxPermission && !settings.isIncognito && !isIframe)
            askPermission();
        else
            setup();
    }

    /**
    * Handle notify box permission
    */
    frizbit._closePopup = function(permission) {
        log("INFO: _closePopup function called");
        document.getElementById('frizbit-prompter').setAttribute("style", "display:none");

        if (permission == true) {
            settings.fromRegisterFor = true;
            setStorageValue('localStorage','notifyPermission',true);
            setup();
        } else {
            log("INFO: user not permitted");
            setStorageValue('sessionStorage','FRIZBIT_SESSION',true);
            setStorageValue('localStorage','lastNotify',new Date(new Date().getTime()+(settings.notifyDelay*24*60*60*1000)));
        }
    }

    /**
    * Ask user permission before browser's popup
    */
    function askPermission() {
        log("INFO: askPermission function called");
        var node = document.createElement('div');
        //TODO teknosa ve vivense için customize edilecek
        node.innerHTML = '<style>.frizbit-prompt { width: 400px; padding: 0; border: 1px solid #bababa; border-radius: 3px; box-shadow: 0 4px 4px -2px #888; background-color: #fbfbfb; font-family: Helvetica Neue, Arial; position: fixed; top: 0; left: 50%; margin-left: -211px; z-index: 9999999999999; -webkit-animation: expand 1s;} @-webkit-keyframes expand{ 0%{top: -144px} 100%{top:0} }.frizbit-inner-container { margin: 0; padding: 0 20px 10px 20px; }.frizbit-image-container { float: left; margin: 13px 15px 0px 0px; }.frizbit-image-container img { width: 65px; height: 65px; }.frizbit-text-container { position: relative !important; padding: 10px 0 0 0 !important; color: #000 !important; text-align: left !important; margin: 0 !important; line-height: 1.4em !important; }.frizbit-title { margin-bottom: 5px; text-align: left; font-size: 14px; font-weight: 700; line-height: 1.4em; color: #000; word-break: break-word; overflow: hidden; }.frizbit-description { font-size: 12px; line-height: 1.4em; margin: 10px 0; padding: 0; text-align: left; word-break: break-word; overflow: hidden; }.frizbit-button-container { float: right !important; }.frizbit-button { width: 90px; height: 18px; line-height: 18px; margin-left: 3px; padding: 5px; background: #f9f9f9; border: 1px solid #bababa; border-radius: 1px; display: inline-block; font-size: 14px; text-align: center; cursor: pointer; box-sizing: content-box !important;}.frizbit-brand { float: left !important; font-size:10px; margin: 10px 0;}.frizbit-allow-button { background: #3AC60C; color: #FFFFFF; border-color: #bababa; }.frizbit-disallow-button { background: #f9f9f9; color: #000; border-color: #bababa; }@media all and (max-width: 400px) { .frizbit-prompt { width: 100%; left:0; margin: 0; border-radius: 0; border-left: 0; border-right: 0; border-top: 0; } }</style><div class="frizbit-prompt" id="frizbit-prompter"> <div class="frizbit-inner-container"> <div class="frizbit-image-container"> <img src="https://frizbit-dashboard-uploads.s3.amazonaws.com/uploads/media/1525337121/1717/large_1525337121.png" class="frizbit-image"> </div> <div class="frizbit-text-container"> <div class="frizbit-title">Click "Allow" to Get Notified</div> <div class="frizbit-description">We will send you occasional personalised messages when we have something great to share!</div> </div> <div style="clear: both;"> <div class="frizbit-button-container"> <div class="frizbit-button frizbit-disallow-button" id="disallow-button" onclick="frizbit._closePopup(false)" >Ask me later</div> <div class="frizbit-button frizbit-allow-button" id="allow-button" onclick="frizbit._closePopup(true)" >Allow</div> </div> <div class="frizbit-brand"><a href="https://try.frizbit.com/?utm_source=https://ihalilaltun.me&utm_campaign=branded-notify-box&utm_medium=referral" target="_blank" style="text-decoration:None; color:#000;">Powered by <b>Frizbit</b></a></div><img src="https://cdn.frizbit.com/logos/frisbee.svg" width=24 height=24 style="margin:4px 0px;" /> <div style="clear: both;"></div> </div> </div> </div>';
        document.body.appendChild(node);
    }

    /**
    * Setup for frizbit app
    * TODO: Setting up appId, userId and subscription options in local storage
    * TODO: Start session for frizbit sdk
    * TODO: If AppId changed delete userid and continue
    */
    function setup() {
        log("INFO: setup function called");
        settings.setup = true;
        // If notification is supported by current user agent and user doesn't choose any permission
        if (settings.isPushNotificationsSupported[0]) {
            if (settings.isPushNotificationsSupported[1] === "Safari" && 'safari' in window && 'pushNotification' in window.safari) {

                var permissionData = window.safari.pushNotification.permission(settings.safari_web_push_id);
                user.deviceToken = permissionData.deviceToken;
                if (user.user_id && user.deviceToken && Notification.permission === "granted") {
                    log("INFO: Already subscribed");
                    setStorageValue('sessionStorage','FRIZBIT_SESSION',true);
                } else {
                    //Call registration for safari
                    registerForSafari();
                }
            } else if ((settings.isPushNotificationsSupported[1] ===  "Chrome" || settings.isPushNotificationsSupported[1] === "Firefox") && 'serviceWorker' in navigator) {
                

                if (settings.httpEnabled) {
                    if (settings.fromRegisterFor) {

                        if (settings.path) {
                            var popupUrl = "https://"+ location.host +"/" + settings.path + "/index.html"
                        } else if (settings.subdomain) {
                            var popupUrl = "https://"+ settings.subdomain +".frizbit.com/" + settings.subdomain + "/popup/subscribe.html"
                        }

                        var subdomainPopup = openSubdomainPopup(popupUrl);

                        if (subdomainPopup) {
                            subdomainPopup.focus();
                        }  
                    } else if (settings.sessionIframeAdded != true) {
                        addSessionIframe();
                    }

                } else if (Notification.permission !== "denied") {
                    navigator.serviceWorker.getRegistrations().then(function(serviceWorkerRegistrations) {

                        var isServiceWorkerActive  = false;

                        serviceWorkerRegistrations.forEach(function(serviceWorkerRegistration) {
                            if (serviceWorkerRegistration.active &&
                                serviceWorkerRegistration.active.state === 'activated' &&
                                ((serviceWorkerRegistration.active.scriptURL.indexOf('FrizbitServiceWorker') > -1) || (serviceWorkerRegistration.active.scriptURL.indexOf('FrizbitUpdateWorker') > -1))) {
                                    isServiceWorkerActive = true;
                            }
                        });

                        if (isServiceWorkerActive) {
                            navigator.serviceWorker.getRegistration().then(function (registration) {
                                registration.pushManager.getSubscription().then(function(subscription) {
                                    if (subscription) {
                                        log("got subscription id: ", subscription.endpoint);
                                        user.deviceToken = subscription.endpoint.replace(new RegExp("^(https://android.googleapis.com/gcm/send/|https://updates.push.services.mozilla.com/wpush/v1/)"), "");
                                        if (user.user_id && user.deviceToken && Notification.permission === "granted" && isServiceWorkerActive) {
                                            log("INFO: Already subscribed");
                                            setStorageValue('sessionStorage','FRIZBIT_SESSION',true);
                                            //TODO update service worker
                                            updateServiceWorker();
                                        } else {
                                            //Call registration for chrome or firefox
                                            registerForW3CPushAPI();
                                        }  
                                    } else {
                                        //Call registration for chrome or firefox
                                        registerForW3CPushAPI();
                                    }
                                });
                            }).catch(function (error) {
                                log("ERROR: Getting registration error: " + error);
                                //Call registration for chrome or firefox
                                registerForW3CPushAPI();
                            });
        
                        } else {
                            //Call registration for chrome or firefox
                            registerForW3CPushAPI();
                        }   
                    });
                }
            } else {
                log("WARN: Unsupported Browser"); 
            }
        }

    };

    /**
    * Open popup window
    */
    function openSubdomainPopup(url) {
        log("INFO: openSubdomainPopup function called");
        var dualScreenLeft = window.screenLeft != undefined ? window.screenLeft : screen.left;
        var dualScreenTop = window.screenTop != undefined ? window.screenTop : screen.top;
        var thisWidth = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
        var thisHeight = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;
        var childWidth = 600;
        var childHeight = 550;
        var left = ((thisWidth / 2) - (childWidth / 2)) + dualScreenLeft;
        var top = ((thisHeight / 2) - (childHeight / 2)) + dualScreenTop;
        return window.open(url, "_blank", 'scrollbars=yes, width=' + childWidth + ', height=' + childHeight + ', top=' + top + ', left=' + left);
    }

    /**
    * Add session iframe for http setup
    */
    function addSessionIframe(){
        log("INFO: addSessionIframe function called");
        var node = document.createElement("iframe");
        node.style.display = "none";

        if (settings.path) {
            var iframeSrc = "https://"+ location.host +"/" + settings.path + "/iframe.html"
        } else if (settings.subdomain) {
            var iframeSrc = "https://"+ settings.subdomain +".frizbit.com/" + settings.subdomain + "/popup/iframe.html"
        }

        node.src = iframeSrc;

        document.body.appendChild(node);
    
        settings.sessionIframeAdded = true;

    }

    /**
    * Send messages to MessageChannel
    */
    function safePostMessage(creator, data, targetOrigin, receiver) {
        log("INFO: safePostMessage function called");
        if (targetOrigin) {
            var tOrigin = targetOrigin.toLowerCase();

            if (receiver) {
                creator.postMessage(data, tOrigin, receiver);
            } else {
                creator.postMessage(data, tOrigin);
            }
        }
    }

    /**
    * Message listener
    */
    function receiveMessage(event) {
        log("INFO: receiveMessage function called: ", event);

        if (event.data.userInformation) {
            var eventData = event.data.userInformation;
            log("MESSAGE: userInformation:" + eventData);
            user.user_id = eventData.user_id;
            log("user object:" + user.user_id);
            if (user.user_id !== null) {
                setStorageValue('sessionStorage','FRIZBIT_SESSION',true);
            } else {
                preSetupCheck();
            }

        } else if (event.data.noInformation) {
            var eventData = event.data.noInformation;
            log("MESSAGE: noInformation:" + eventData);
            if (!settings.setup) {
                preSetupCheck();
            }
            
        } else if (event.data.welcomeNotification) {
            var eventData = event.data.welcomeNotification;
            log("MESSAGE: welcomeNotification:" + eventData);
            user.user_id = eventData.user_id;
            if (user.user_id !== null) {
                frizbit.sendNotification();
            }
            
        }

    }

    /**
    * Updating previous service worker
    */
    function updateServiceWorker() {
       log("INFO: updateServiceWorker function called");
        if (!navigator.serviceWorker || getStorageValue('sessionStorage','UPDATE_SW_COMPLETED')) {
            log("INFO: Skip updating sw.");
            return;
        }

        try {
            sessionStorage.setItem('UPDATE_SW_COMPLETED', true);
        } catch (e) {
            log("ERROR:" + e);
        }

        navigator.serviceWorker.getRegistration().then(function (serviceWorkerRegistration) {

            if (serviceWorkerRegistration && serviceWorkerRegistration.active) {

                var previousWorkerUrl = serviceWorkerRegistration.active.scriptURL;
                if ((previousWorkerUrl.indexOf('FrizbitServiceWorker') > -1)) {
                    log("INFO: main service worker is active");

                    var currentVersion = getStorageValue('localStorage','FRIZBIT_SW1_VERSION');
                    if (currentVersion) {
                        log("INFO: main service worker version:" + version);
                        if (version != settings.client_version) {
                            log("INFO: new service worker existed, version: " + version);
                            log("INFO: updating from " + settings.client_version +" version to " + version);
                            return navigator.serviceWorker.register(settings.service_updater_path);
                        } else {
                            log("INFO: Same service worker version.");
                            return null;
                        }
                    } else {
                        log("INFO: No service worker version found. Reinstalling service worker.");
                        return navigator.serviceWorker.register(settings.service_updater_path);
                    }
                } else if ((previousWorkerUrl.indexOf('FrizbitUpdateWorker') > -1)){
                    log("INFO: update service worker is active");
                    var currentVersion = getStorageValue('localStorage','FRIZBIT_SW2_VERSION');
                    if (currentVersion) {
                        log("INFO: main service worker version:" + version);
                        if (version != settings.client_version) {
                            log("INFO: new service worker existed, version: " + version);
                            log("INFO: updating from " + settings.client_version +" version to " + version);
                            return navigator.serviceWorker.register(settings.service_worker_path);
                        } else {
                            log("INFO: Same service worker version.");
                            return null;
                        }
                    } else {
                        log("INFO: No service worker version found. Reinstalling service worker.");
                        return navigator.serviceWorker.register(settings.service_worker_path);
                    }
                } else {
                    log("WARN: Some other woerker was installed.");
                } 
            } 
        }).catch(function (e) {
            log("ERROR: Updateworker: " + e);
        });
    }

    /**
    * Safari push notification permission request
    */
    function registerForSafari() {
        log("INFO: registerForSafari function called");
        log("INFO: WebServiceURL: " + getApiUrl() + '/register/' + settings.appkey);
        var userData = {segments: user.segments, alias: user.alias};
        log("INFO: User Data: " + JSON.stringify(userData));
        
        var permissionData = window.safari.pushNotification.permission(settings.safari_web_push_id);    
        log("INFO: Current Permission Data: " + permissionData.permission);

        window.safari.pushNotification.requestPermission(
            getApiUrl() + '/register/' + settings.appkey, // The web service URL.
            settings.safari_web_push_id,     // The Website Push ID.
            { data: "'"+JSON.stringify(userData)+"'"}, // Data that you choose to send to your server to help you identify the user.
            function (permissionData) {
                log("INFO: Permission Data: " + permissionData.permission);
                if (permissionData.permission === "granted") {
                    log("INFO: Granted for safari push notification");
                    user.deviceToken = permissionData.deviceToken;
                    log("INFO: Device Token:" + user.deviceToken);
                    user.subscriptionStatus = "granted";
                    //Call register at frizbit and get userid
                    //Safari always calls register service with PUT
                    registerToFrizbit(settings.isPushNotificationsSupported[1], 'PUT');
                } else if (permissionData.permission === "denied") {
                    log("INFO: Denied for safari push notification");
                    user.subscriptionStatus = "denied";
                    //TODO call for denied
                    //registerToFrizbit(settings.isPushNotificationsSupported[1]);
                    setStorageValue('sessionStorage','FRIZBIT_SESSION',true);
                } else if (permissionData.permission === "default") {
                    log("INFO: Default for safari push notification");
                    user.subscriptionStatus = "undefined";
                    setStorageValue('sessionStorage','FRIZBIT_SESSION',true);
                } else {
                    log("INFO: Undefined for safari push notification");
                    user.subscriptionStatus = "undefined";
                    setStorageValue('sessionStorage','FRIZBIT_SESSION',true);
                }
            }
        );
        
    };

    /**
    * W3C standart push notification permission request
    */
    function registerForW3CPushAPI () {
        log("INFO: registerForW3CPushAPI function called");

        navigator.serviceWorker.getRegistration().then(function (registration) {
            navigator.serviceWorker.register(settings.service_worker_path).then(enableNotifications, registrationError);
        }).catch(function (error) {
            log("ERROR: Getting registration error: " + error);
        });
    };

    /**
    * Successful callback for service worker registration
    */
    function enableNotifications (existingServiceWorkerRegistration) {
        log("INFO: enableNotifications function called");
        log("INFO: existingServiceWorkerRegistration: " + existingServiceWorkerRegistration);

        navigator.serviceWorker.ready.then(function (serviceWorkerRegistration) {
            log("INFO: Service Worker is ready: " + serviceWorkerRegistration);
            subscribeForW3CPush(serviceWorkerRegistration);
        });
    };

    /**
    * Failed callback for service worker registration
    */
    function registrationError (error) {
        log("INFO: registrationError function called");
        log("ERROR: " + error);
    };

    /**
    * Subscribe user W3C Push endpoint
    */
    function subscribeForW3CPush (serviceWorkerRegistration) {
        log("INFO: subscribeForW3CPush function called");

        serviceWorkerRegistration.pushManager.subscribe({userVisibleOnly: true}).then(function (pushSubscription) {
            //TODO change notification permission(user.subscriptionStatus)
            if (pushSubscription) {
                if (typeof pushSubscription.subscriptionId != "undefined") { // Chrome 42 & 43
                    user.deviceToken = pushSubscription.subscriptionId;
                } else { // W3C
                    log("INFO: User subscribed! Subscription Info: " + JSON.stringify(pushSubscription));
                    subscriptionObject = JSON.parse(JSON.stringify(pushSubscription));
                    user.p256dh = subscriptionObject['keys']['p256dh'];
                    user.auth = subscriptionObject['keys']['auth'];
                    user.subscriptionEndpoint = pushSubscription.endpoint;
                    user.deviceToken = pushSubscription.endpoint.replace(new RegExp("^(https://android.googleapis.com/gcm/send/|https://updates.push.services.mozilla.com/wpush/v1/)"), "");
                }
                log("INFO: User subscribed! Endpoint: " + user.deviceToken);
                //Call register at frizbit and get userid
                registerToFrizbit(settings.isPushNotificationsSupported[1], 'POST');
            } else {
                log("WARN: User couldn't subscribed for push notification");
            }
        }).catch(function (error) {
            log("ERROR: Error during subsciption: " + error);
        });
    };

    /**
    * Register the subscribed user to Frizbit backend 
    * Get user id
    * Send other fields for further analytics
    */
    function registerToFrizbit (browser_type, method) {
        log("INFO: registerToFrizbit function called");

        var data = {
            segments: user.segments,
            alias: user.alias,
            language: user.language,
            timezone: user.timezone,
            tags: user.tags,
            clientVersion: settings.client_version,
            browserType: getBrowserName().toUpperCase(),
            userId: user.user_id,
            subscriptionEndpoint: user.subscriptionEndpoint,
            deviceToken: user.deviceToken,
            credentialParams: {
                key: user.p256dh,
                auth: user.auth
            }
        };

        log("INFO: data: ", JSON.stringify(data));

        var requestUrl ='/register/' + settings.appkey + "/devices/";

        makeApiRequest(requestUrl, method, data, successCallback, errorCallback);
    };

    /**
    * Send tags to the frizbit backend
    */
    function sendTagsToFrizbit(method) {
        log("INFO: sendTagsToFrizbit function called");

        var data = {
            language: user.language,
            timezone: user.timezone,
            tags: user.tags,
            clientVersion: settings.client_version,
            userId: user.user_id,
            deviceToken: user.deviceToken
        };

        log("INFO: data: ", JSON.stringify(data));

        var requestUrl ='/register/' + settings.appkey + "/devices/";

        makeApiRequest(requestUrl, method, data, successCallback, errorCallback);
    }

    /**
    * Send segments to the frizbit backend
    */
    function sendSegmentsToFrizbit(method) {
        log("INFO: sendTagsToFrizbit function called");

        var data = {
            language: user.language,
            timezone: user.timezone,
            segments: user.segments,
            clientVersion: settings.client_version,
            userId: user.user_id,
            deviceToken: user.deviceToken
        };

        log("INFO: data: ", JSON.stringify(data));

        var requestUrl ='/register/' + settings.appkey + "/devices/";

        makeApiRequest(requestUrl, method, data, successCallback, errorCallback);
    }

    /**
    * Success callback for frizbit registration call
    */
    function successCallback (jsonResponse) {
        log("INFO: successCallback function called");
        setStorageValue('sessionStorage','FRIZBIT_SESSION',true);

        if (jsonResponse.userId) {
            setStorageValue('localStorage','userId',jsonResponse.userId);
            user.user_id = jsonResponse.userId;
            // TODO send unset alias and tags etc.

            if (settings.httpEnabled) {
              log("Sending user_id back to host page");
              //alert("Sending user_id back to host page");
              log(settings.initialization_options);
              var creator = opener || parent;
              safePostMessage(creator, {userInformation: user}, settings.initialization_options.origin, null);
              var welcome = getStorageValue('localStorage','frzbt.welcome');
              if (!welcome && settings.welcomeNotification) {
                setStorageValue('localStorage','frzbt.welcome', true);
                safePostMessage(creator, {welcomeNotification: user}, settings.initialization_options.origin, null);
              }

              if (opener && settings.initialization_options.origin)
                window.close();
            } 
        }
    };

    /**
    * Failed callback for frizbit registration call
    */
    function errorCallback (jsonResponse) {
        log("INFO: errorCallback function called");
        if (settings.httpEnabled) {
            //TODO: send error to parent page
            var creator = opener || parent;
            if (opener && settings.initialization_options.origin)
                window.close();
        }
    };

    /**
    * Send a api call to Frizbit backend
    * Return result to success or failed callback
    */
    function makeApiRequest (requestUrl, action, data, success, failed) {
        log("INFO: makeApiRequest function called");

        var contents = {
            method: action
            //mode: 'no-cors', //TODO no-cors is disabled for non-serviceworker.
            //credentials: 'include'
        };

        // GET & HEAD request don't have body
        if (data) {
            contents.headers = {"Content-type": "application/json;charset=UTF-8"};
            contents.body = JSON.stringify(data);
        };

        fetch(getApiUrl() + requestUrl, contents).then(function status (response) {
            log("INFO: response:" + response);
            if (response.status >= 200 && response.status < 300) {
                return Promise.resolve(response);
            } else {
                return Promise.reject(new Error(response.statusText));
            }
        }).then(function status (response) {
            return response.json();
        }).then(function (jsonResponse) {
            log("INFO: jsonResponse:" + jsonResponse);
            if (success != null && jsonResponse.response.code == 0) {
                success(jsonResponse);
            } else if (jsonResponse.response.code != 0) {
                if (failed != null) {
                    failed(jsonResponse.response.message);
                } else {
                    log("ERROR: Api response error! ", jsonResponse.response.message);
                }
            }
        }).catch(function (error) {
            log("ERROR: Api request failed!", error);
            if (failed != null) {
                failed(error);
            }
        });
    };

    /**
    * Handle the received notification either from chrome or firefox
    * Prompt to the user.
    */
    function handleNotification(serviceWorker, event) {
        log("INFO: handleNotification function called");
        //Chrome 50'den sonra data dolu gelecek
        // TODO: Chrome 50 ve Firefox için burası güncellenecek
        if (event.data && event.data.text()[0] == '{') {
            log('INFO: Received data.text: ', event.data.text());
            log('INFO: Received data.json: ', event.data.json());
            fireNotification(event.data.json(), event);
        } else {
            event.waitUntil(new Promise(
                function (resolve, reject) {
                    retrieveLastNotifications(function(response) {
                        var notificationData = {
                            id: response.notification.id,
                            title: response.notification.title,
                            message: response.notification.message,
                            launchURL: response.notification.url,
                            sent_at: response.notification.date,
                            icon: response.icon,
                            actions: response.actions,
                            image: response.image,
                            requireInteraction: response.requireInteraction
                        };

                        serviceWorker.registration.showNotification(notificationData.title, {
                            body: notificationData.message,
                            icon: notificationData.icon,
                            tag: JSON.stringify(notificationData),
                            actions: notificationData.actions,
                            image: notificationData.image,
                            requireInteraction: notificationData.requireInteraction
                        }).then(resolve);

                    }, resolve);
                }));
        }
    }

    function fireNotification(response, event) {
        var notificationData = {
            title: response.title,
            message: response.message,
            launchURL: response.link,
            sent_at: response.date,
            icon: response.icon,
            actions: response.actions,
            image: response.image,
            requireInteraction: response.requireInteraction
        };
   
        event.waitUntil(self.registration.showNotification(notificationData.title, {
            body: notificationData.message,  
            icon: notificationData.icon,  
            tag: JSON.stringify(notificationData),
            actions: notificationData.actions,
            image: notificationData.image,
            requireInteraction: notificationData.requireInteraction
        }));
    }

    /**
    * Retrieves latest notification for the current user.
    * https://frizbit.com/push/api/v1/notification/{apiKey}/devices/{deviceToken}  
    * https://frizbit.com/push/api/v1/logo/{apiKey}
    */
    function retrieveLastNotifications(itemCallback, completeCallback) {
        log("INFO: retrieveLastNotifications function called");
        registration.pushManager.getSubscription().then(function(subscription) {
            log("got subscription id: ", subscription.endpoint);
            user.deviceToken = subscription.endpoint.replace(new RegExp("^(https://android.googleapis.com/gcm/send/|https://updates.push.services.mozilla.com/wpush/v1/)"), "");
        
            log(user.deviceToken);
            var requestUrl ='/notification/' + settings.appkey + "/devices/" + user.deviceToken;

            makeApiRequest(requestUrl, 'GET', null, function (jsonResponse) {
                log("INFO: successCallback function called");
                itemCallback(jsonResponse);
            }, function () {
                log("WARN: errorCallback function called");
                completeCallback();
            });
        });
        
    };

    /**
    * Handling notification open state.
    */
    function handleNotificationClick(event) {
        log("INFO: handleNotificationClick function called");
        var notificationData = JSON.parse(event.notification.tag);
        event.notification.close();

        //TODO: we may want to send a PUT request for clicking the push notification

        event.waitUntil(
            clients.matchAll({
                type: "window"
            })
            .then(function(clientList) {
                var launchURL = registration.scope;
                if (notificationData.launchURL) {
                    launchURL = notificationData.launchURL;
                }

                if (notificationData.actions && notificationData.actions.length) {
                    for (var i = 0; i < notificationData.actions.length; i++) {
                        if (event.action === notificationData.actions[i].action
                            && notificationData.actions[i].url && notificationData.actions[i].url !== '') {
                            launchURL = notificationData.actions[i].url;
                        }
                    }
                }

                for (var i = 0; i < clientList.length; i++) {
                    var client = clientList[i];
                    if ('focus' in client && client.url == launchURL) {
                        client.focus();

                        client.postMessage(notificationData);
                        return;
                    }
                }

                clients.openWindow(launchURL).catch(function (error) {
                    // Buraya yalnızca Chrome 43'ten eskiler için external URL gidiyorsa girer.
                    clients.openWindow(registration.scope + "redirector.html?url=" + launchURL);
                });

            })
        );
    };


    /**
    * Handling service worker installiation.
    */
    function handleInstalliation(event) {
        log("INFO: handleInstalliation function called");
        log("INFO: Intalling worker: " + self.location.pathname);
        //TODO: bunu aktif ettiğimizde sw update olacak ancak chrome androidde hata var.
        event.waitUntil(self.skipWaiting());

    }

    /**
    * Handling service worker activation.
    */
    function handleActivation(event) {
        log("INFO: handleActivation function called");
        log("INFO: Activated worker: " + self.location.pathname);
    }


    log("INFO: Started", self);
    if (typeof window !== "undefined") {
        window.addEventListener("message", receiveMessage, false);
    } else {
        //After registering the service worker
        //We need to handle push requests and clicks
        self.addEventListener('push', function (event) {
            log("INFO: Notification received", event);
            handleNotification(self, event);
        });

        //Handle clicks
        self.addEventListener('notificationclick', function (event) {
            log("INFO: Notification clicked", event);
            handleNotificationClick(event);
        });

        //Handle service worker installiation
        self.addEventListener('install', function (event) {
            log("INFO: Service worker installed", event);
            handleInstalliation(event);
        });

        //Handle worker activation
        self.addEventListener('activate', function(event) {
            log("INFO: Service worker activated", event);
            handleActivation(event);
        });
    }


    // check to evaluate whether "namespace" exists in the
    // global namespace - if not, assign window.namespace an
    // object literal
})(frizbit);
