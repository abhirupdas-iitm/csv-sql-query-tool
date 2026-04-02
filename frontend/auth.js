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
        alert(err.message);
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
        alert(err.message);
    }
};

// 🔥 LOGOUT
window.logout = async function () {
    await signOut(auth);
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
    if (user) {
        currentUser = user;
        console.log("User logged in:", user.uid);
        document.getElementById("authStatus").innerText =
            `Logged in as ${user.displayName || user.email}`;
        document.getElementById("profilePic").src = user.photoURL || "";
    } else {
        currentUser = null;
        document.getElementById("authStatus").innerText = "Not logged in";
    }
});

// 🔥 EXPORT USER
window.getUser = function () {
    return currentUser;
};