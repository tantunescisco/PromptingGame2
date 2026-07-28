"use strict";

window.PromptQuestScoreService = {
  configured: false,
  ready: Promise.resolve(false),
  saveScore: async () => false,
  signInAdmin: async () => false,
  signOutAdmin: async () => {},
  isAdmin: async () => false,
  resetScores: async () => false
};

const firebaseConfig = window.PROMPT_QUEST_FIREBASE_CONFIG;
if (firebaseConfig?.apiKey && firebaseConfig?.projectId) {
  const service = window.PromptQuestScoreService;
  service.ready = Promise.all([
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js")
  ]).then(async ([appModule, authModule, databaseModule]) => {
    const app = appModule.initializeApp(firebaseConfig);
    const auth = authModule.getAuth(app);
    const database = databaseModule.getDatabase(app);
    if (!auth.currentUser) await authModule.signInAnonymously(auth);
    const ensureUser = async () => {
      if (!auth.currentUser) await authModule.signInAnonymously(auth);
      return auth.currentUser;
    };
    const adminRef = () => databaseModule.ref(database, `admins/${auth.currentUser.uid}`);

    service.configured = true;
    service.saveScore = async (levelId, entry) => {
      const user = await ensureUser();
      const scoreRef = databaseModule.ref(database, `scores/${levelId}/${user.uid}`);
      const current = (await databaseModule.get(scoreRef)).val();
      if (!current || entry.score > current.score ||
          (entry.score === current.score && entry.timeMs < current.timeMs)) {
        await databaseModule.set(scoreRef, { ...entry, date: Date.now() });
      }
      return true;
    };
    service.isAdmin = async () => (await databaseModule.get(adminRef())).val() === true;
    service.signInAdmin = async (email, password) => {
      await authModule.signInWithEmailAndPassword(auth, email, password);
      const isAdmin = await service.isAdmin();
      if (!isAdmin) await service.signOutAdmin();
      return isAdmin;
    };
    service.signOutAdmin = async () => {
      await authModule.signOut(auth);
      await authModule.signInAnonymously(auth);
    };
    service.resetScores = async () => {
      if (!(await service.isAdmin())) return false;
      await databaseModule.remove(databaseModule.ref(database, "scores"));
      return true;
    };
    return true;
  }).catch(error => {
    console.warn("Shared scoreboard unavailable; scores remain local.", error);
    return false;
  });
}