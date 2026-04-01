// 🔥 Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 🔥 Your config (already have)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "XXXX",
    appId: "XXXX"
};

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