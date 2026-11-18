import { getAuth } from 'firebase/auth';
import { firebaseApp } from './firebaseConfig';

export const getFirebaseAuth = () => getAuth(firebaseApp());
