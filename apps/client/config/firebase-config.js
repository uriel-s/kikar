import firebase from 'firebase/compat/app'; 
 
import 'firebase/compat/analytics';


const firebaseConfig = {
    apiKey: "AIzaSyBQ9lfN9MwVaUxYW-LKn77j_EchWhJpYUc",
    authDomain: "moveo-de052.firebaseapp.com",
    projectId: "moveo-de052",
    storageBucket: "moveo-de052.appspot.com",
    messagingSenderId: "599696852445",
    appId: "1:599696852445:web:1f34b25a20c1a203046234",
    measurementId: "G-GZLPWP32FY"
  };

  // Initialize Firebase
 firebase.initializeApp(firebaseConfig);
 firebase.analytics();
