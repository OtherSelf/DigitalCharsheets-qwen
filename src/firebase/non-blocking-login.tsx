'use client';
import {
  Auth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  FirebaseError,
  UserCredential,
} from 'firebase/auth';

/** Initiates Google sign-in (non-blocking). */
export function initiateGoogleSignIn(
  authInstance: Auth,
  onSuccess?: (userCredential: UserCredential) => void,
  onError?: (error: any) => void
): void {
  const provider = new GoogleAuthProvider();
  // Ensure we prompt for account selection to avoid auto-login issues
  provider.setCustomParameters({ prompt: 'select_account' });

  signInWithPopup(authInstance, provider)
    .then((result) => {
      if (onSuccess) onSuccess(result);
    })
    .catch((error) => {
      // Errors like "popup-closed-by-user" or "auth/user-cancelled" are common.
      console.error('Google Sign-In Error:', error);
      if (onError) onError(error);
    });
}

/** Initiates sign-out (non-blocking). */
export function initiateSignOut(authInstance: Auth): void {
  signOut(authInstance).catch((error) => {
    console.error('Sign-Out Error:', error);
  });
}

/** Initiates Email/Password sign-up (non-blocking). */
export function initiateEmailPasswordSignUp(
  authInstance: Auth,
  email: string,
  password: string,
  onError: (error: FirebaseError) => void,
  onSuccess: (userCredential: UserCredential) => void
): void {
  createUserWithEmailAndPassword(authInstance, email, password)
    .then(onSuccess)
    .catch((error: FirebaseError) => {
      onError(error);
    });
}

/** Initiates Email/Password sign-in (non-blocking). */
export function initiateEmailPasswordSignIn(
  authInstance: Auth,
  email: string,
  password: string,
  onError: (error: FirebaseError) => void
): void {
  signInWithEmailAndPassword(authInstance, email, password).catch(
    (error: FirebaseError) => {
      onError(error);
    }
  );
}
