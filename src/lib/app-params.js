export const appParams = {
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "sisprod",
  appBaseUrl: import.meta.env.VITE_APP_BASE_URL || "",
  environment: import.meta.env.MODE || "production"
};
