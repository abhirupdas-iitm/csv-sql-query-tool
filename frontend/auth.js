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

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 🔥 FADE NAVIGATION HELPER (ADDED)
function fadeAndRedirect(url) {
    document.body.classList.add("fade-out");
    setTimeout(() => {
        window.location.href = url;
    }, 400);
}

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
const db = getFirestore(app);

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

    const anonId = "anon_" + Math.random().toString(36).substring(2, 10);

    localStorage.setItem("anon_id", anonId);

    fadeAndRedirect("index.html"); // 🔥 UPDATED
};

// 🔥 LOGOUT
window.logout = async function () {
    await signOut(auth);
    localStorage.removeItem("anon_id");
    fadeAndRedirect("login.html"); // 🔥 UPDATED
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

    const loader = document.getElementById("authLoader");
    const app = document.getElementById("appContent");

    const anonId = localStorage.getItem("anon_id");

    const status = document.getElementById("authStatus");
    const pic = document.getElementById("profilePic");

    // ✅ LOGGED IN USER
    if (user) {
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const signupBtn = document.querySelector('button[onclick="signup()"]');
        const loginBtn = document.querySelector('button[onclick="login()"]');
        const googleBtn = document.querySelector('button[onclick="googleLogin()"]');
        const logoutBtn = document.querySelector('button[onclick="logout()"]');
        const authBar = document.querySelector(".auth-bar");

        if (emailInput) emailInput.style.display = "none";
        if (passwordInput) passwordInput.style.display = "none";
        if (signupBtn) signupBtn.style.display = "none";
        if (loginBtn) loginBtn.style.display = "none";

        if (authBar) {
            authBar.style.justifyContent = "center";
        }

        currentUser = user;

        if (window.location.pathname.includes("login.html")) {
            fadeAndRedirect("index.html"); // 🔥 UPDATED
            return;
        }

        if (status) {
            status.innerText =
                `Logged in as ${user.displayName || user.email}`;
        }

        if (pic) {
            pic.src = user.photoURL || "";
        }

        if (loader) loader.classList.add("hidden");
        if (app) app.classList.remove("hidden");

        const pollHistory1 = setInterval(() => {
            if (window.loadHistory) {
                clearInterval(pollHistory1);
                window.loadHistory();
            }
        }, 100);
        setTimeout(() => clearInterval(pollHistory1), 5000);

        return;
    }

    // ✅ ANONYMOUS USER
    if (anonId) {
        currentUser = { uid: anonId };

        if (window.location.pathname.includes("login.html")) {
            fadeAndRedirect("index.html"); // 🔥 UPDATED
            return;
        }

        if (status) {
            status.innerText = "Anonymous User";
        }

        if (loader) loader.classList.add("hidden");
        if (app) app.classList.remove("hidden");

        const pollHistory2 = setInterval(() => {
            if (window.loadHistory) {
                clearInterval(pollHistory2);
                window.loadHistory();
            }
        }, 100);
        setTimeout(() => clearInterval(pollHistory2), 5000);

        return;
    }

    // ❌ NOT LOGGED IN
    if (!window.location.pathname.includes("login.html")) {
        fadeAndRedirect("login.html"); // 🔥 UPDATED
    }

});

// 🔥 EXPORT USER
window.getUser = function () {
    return currentUser;
};

// 🔥 SAVE QUERY HISTORY
window.saveQuery = async function (queryText) {
    const user = window.getUser();

    console.log("USER OBJECT:", user);
    console.log("USER ID:", user?.uid);
    console.log("NEW SAVEQUERY RUNNING");

    if (!user) return;

    try {
        if (user.uid.startsWith("anon_")) {
            await addDoc(
                collection(db, "anonymous", user.uid, "queries"),
                {
                    query: queryText,
                    created_at: new Date()
                }
            );
        } else {
            await addDoc(collection(db, "queries"), {
                user_id: user.uid,
                query: queryText,
                created_at: new Date()
            });
        }

    } catch (err) {
        console.error("Error saving query:", err);
    }
};

window.getQueryHistory = async function () {
    const user = window.getUser();
    if (!user) {
        console.warn("getQueryHistory: no user");
        return [];
    }

    console.log("getQueryHistory: fetching for user", user.uid);

    try {
        let snapshot;

        if (user.uid.startsWith("anon_")) {
            try {
                const q = query(
                    collection(db, "anonymous", user.uid, "queries"),
                    orderBy("created_at", "desc")
                );
                snapshot = await getDocs(q);
            } catch (indexErr) {
                snapshot = await getDocs(collection(db, "anonymous", user.uid, "queries"));
            }
        } else {
            try {
                const q = query(
                    collection(db, "queries"),
                    where("user_id", "==", user.uid),
                    orderBy("created_at", "desc")
                );
                snapshot = await getDocs(q);
            } catch (indexErr) {
                const q = query(
                    collection(db, "queries"),
                    where("user_id", "==", user.uid)
                );
                snapshot = await getDocs(q);
            }
        }

        const results = [];
        snapshot.forEach(doc => {
            results.push(doc.data());
        });

        results.sort((a, b) => {
            const timeA = a.created_at?.seconds || 0;
            const timeB = b.created_at?.seconds || 0;
            return timeB - timeA;
        });

        return results;

    } catch (err) {
        console.error("getQueryHistory FAILED:", err);
        return [];
    }
};

// 🔥 SAVE SNIPPET (NAMED QUERY)
window.saveSnippet = async function (name, queryText) {
    const user = window.getUser();
    if (!user) return;

    try {
        if (user.uid.startsWith("anon_")) {
            await addDoc(
                collection(db, "anonymous", user.uid, "snippets"),
                {
                    name: name,
                    query: queryText,
                    created_at: new Date()
                }
            );
        } else {
            await addDoc(collection(db, "snippets"), {
                user_id: user.uid,
                name: name,
                query: queryText,
                created_at: new Date()
            });
        }
    } catch (err) {
        console.error("Error saving snippet:", err);
        throw err;
    }
};

window.getSnippets = async function () {
    const user = window.getUser();
    if (!user) return [];

    try {
        let snapshot;
        if (user.uid.startsWith("anon_")) {
            snapshot = await getDocs(collection(db, "anonymous", user.uid, "snippets"));
        } else {
            const q = query(
                collection(db, "snippets"),
                where("user_id", "==", user.uid)
            );
            snapshot = await getDocs(q);
        }

        const results = [];
        snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        return results;
    } catch (err) {
        console.error("getSnippets FAILED:", err);
        return [];
    }
};