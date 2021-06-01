importScripts("https://www.gstatic.com/firebasejs/8.6.3/firebase-app.js");
importScripts(
    "https://www.gstatic.com/firebasejs/8.6.3/firebase-messaging.js",
);
// For an optimal experience using Cloud Messaging, also add the Firebase SDK for Analytics.
importScripts(
    "https://www.gstatic.com/firebasejs/8.6.3/firebase-analytics.js",
);

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
firebase.initializeApp({
    messagingSenderId: "146658723248",
                apiKey: "AIzaSyCVFrlFa7i7uLveSoQBuzdDWk-st6DB8Sg",
                projectId: "ihalilaltun-me",
                appId: "1:146658723248:web:bc203317dd908e75354275"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.setBackgroundMessageHandler(function(payload) {
    console.log(
        "[firebase-messaging-sw.js] Received background message ",
        payload,
    );
    // Customize notification here
    const notificationTitle = "Background Message Title";
    const notificationOptions = {
        body: "Background Message body.",
        icon: "/itwonders-web-logo.png",
    };

    return self.registration.showNotification(
        notificationTitle,
        notificationOptions,
    );
});
