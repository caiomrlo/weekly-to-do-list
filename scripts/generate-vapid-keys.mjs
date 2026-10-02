import webpush from "web-push";
import crypto from "node:crypto";

const vapidKeys = webpush.generateVAPIDKeys();
const cronSecret = crypto.randomBytes(32).toString("hex");

console.log("===============================================================================");
console.log("VAPID & Notification Keys Generated");
console.log("===============================================================================");
console.log("");
console.log("Add the following lines to your .env and .env.local files:");
console.log("");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`);
console.log(`VAPID_SUBJECT="mailto:notifications@weeklytodo.com"`);
console.log(`CRON_SECRET="${cronSecret}"`);
console.log("");
console.log("===============================================================================");
