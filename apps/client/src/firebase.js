import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
const app =firebase.initializeApp({

   
   apiKey: "AIzaSyBKTQ5Nb8haFNVO1cEYOSvtTw4qkwaQj3o",
  authDomain: "palhan-b30d2.firebaseapp.com",
  projectId: "palhan-b30d2",
  storageBucket: "palhan-b30d2.appspot.com",
  messagingSenderId: "1055743165310",
  appId: "1:1055743165310:web:03d6c7f466c5cb223fa92f",
  measurementId: "G-0ZXE197DPY"
}
)
export const auth = app.auth()
export default app
