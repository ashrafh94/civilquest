// Platform settings. The app name appears on screens; change it in one place here.
const CONFIG = {
  appName: 'CivilQuest',
  // Where instructors manage classes (the portal page of this site).
  portalUrl: 'https://ashrafh94.github.io/civilquest/portal.html',
  // The student app's address (used for class join links and QR codes).
  appUrl: 'https://ashrafh94.github.io/civilquest/',
  // Accounts that can create invite codes for colleagues (your User UID).
  adminUids: ['Nt7TekxbV5e6gRcInxQmBZhWcD53'],
  // Stripe checkout link for instructor subscriptions. Leave empty until paid plans open.
  subscribeUrl: '',
  // Your Firebase project (same project as Condenser Lab; separate collections).
  firebase: {
    apiKey: 'AIzaSyBebhBHI7sBnk2w_EKW2UOzz1cCEmxGYd8',
    authDomain: 'gamification-in-enve.firebaseapp.com',
    projectId: 'gamification-in-enve',
    storageBucket: 'gamification-in-enve.firebasestorage.app',
    messagingSenderId: '1092410563784',
    appId: '1:1092410563784:web:8337e3b7656e98e19d99fd'
  }
};
