import * as admin from "firebase-admin";
import {defineString} from "firebase-functions/params";

// env
const shellTradeDatabaseId = defineString("SHELL_TRADE_DATABASE_ID");

// firestore
const app = admin.initializeApp();
export const firestore = app.firestore();
firestore.settings({
  databaseId: shellTradeDatabaseId.value(),
  ignoreUndefinedProperties: true,
});
