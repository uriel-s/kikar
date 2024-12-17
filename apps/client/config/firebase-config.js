import firebase from 'firebase/compat/app'; 
 
import 'firebase/compat/analytics';


const firebaseConfig = {
  apiKey: "AIzaSyAbK6qaGvsZ64iwM9-sEgrOpAwHIdcTG9o",
  authDomain: "palhan.firebaseapp.com",
  projectId: "palhan",
  storageBucket: "palhan.appspot.com",
  messagingSenderId: "969095358789",
  appId: "1:969095358789:web:b1bc9a2ebde654c324362c",
  measurementId: "G-WVM0HFEFDQ"
};

  // Initialize Firebase
 firebase.initializeApp(firebaseConfig);
 firebase.analytics();
