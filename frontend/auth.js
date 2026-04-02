import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDfqzhtRbh25ITYaTN9W0kA9VHfvj1rG5Y",
    authDomain: "sheetql-34504.firebaseapp.com",
    projectId: "sheetql-34504",
    storageBucket: "sheetql-34504.firebasestorage.app",
    messagingSenderId: "962271710487",
    appId: "1:962271710487:web:99f0ebb19537f16541bb52"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 🔴 GLOBAL USER (IMPORTANT)
let currentUser = null;

// 🔥 SIGN UP
window.signup = async function () {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const name = prompt("Enter your name:");

    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);

        await updateProfile(userCred.user, {
            displayName: name
        });

        alert("User created!");
    } catch (err) {
        if (err.code === "auth/account-exists-with-different-credential") {
            alert("This email is already registered using Google. Please use Google login.");
        } else {
            alert(err.message);
        }
    }
};

// 🔥 LOGIN
window.login = async function () {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        alert("Logged in!");
    } catch (err) {
        if (err.code === "auth/account-exists-with-different-credential") {
            alert("This email is already registered using Google. Please use Google login.");
        } else {
            alert(err.message);
        }
    }
};

window.useAnonymous = function () {

    const confirmMsg = confirm(
        "⚠ Anonymous mode: data may not be saved permanently. Continue?"
    );

    if (!confirmMsg) return;

    // 🔥 generate random ID
    const anonId = "anon_" + Math.random().toString(36).substring(2, 10);

    localStorage.setItem("anon_id", anonId);

    // redirect to main app
    window.location.href = "index.html";
};

// 🔥 LOGOUT
window.logout = async function () {
    await signOut(auth);
    localStorage.removeItem("anon_id");
    window.location.href = "login.html";
};

window.googleLogin = async function () {
    const provider = new GoogleAuthProvider();

    try {
        const result = await signInWithPopup(auth, provider);
        console.log("Google login success:", result.user);
    } catch (err) {
        alert(err.message);
    }
};

// 🔥 TRACK USER
onAuthStateChanged(auth, (user) => {

    const anonId = localStorage.getItem("anon_id");

    const status = document.getElementById("authStatus");
    const pic = document.getElementById("profilePic");

    // ✅ LOGGED IN USER
    if (user) {
        currentUser = user;

        if (window.location.pathname.includes("login.html")) {
            window.location.href = "index.html";
            return;
        }

        if (status) {
            status.innerText =
                `Logged in as ${user.displayName || user.email}`;
        }

        if (pic) {
            pic.src = user.photoURL || "";
        }

        return;
    }

    // ✅ ANONYMOUS USER
    if (anonId) {
        currentUser = { uid: anonId };

        if (window.location.pathname.includes("login.html")) {
            window.location.href = "index.html";
            return;
        }

        if (status) {
            status.innerText = "Anonymous User";
        }

        return;
    }

    // ❌ NOT LOGGED IN → REDIRECT TO LOGIN
    if (!window.location.pathname.includes("login.html")) {
        window.location.href = "login.html";
    }
});

// 🔥 EXPORT USER
window.getUser = function () {
    return currentUser;
};