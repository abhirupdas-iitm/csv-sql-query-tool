import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

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

    try {
        await createUserWithEmailAndPassword(auth, email, password);
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

// 🔥 TRACK USER
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log("User logged in:", user.uid);
        document.getElementById("authStatus").innerText = `Logged in as ${user.email}`;
    } else {
        currentUser = null;
        document.getElementById("authStatus").innerText = "Not logged in";
    }
});

// 🔥 EXPORT USER
window.getUser = function () {
    return currentUser;
};