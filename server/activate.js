const db = require('better-sqlite3')('data/app.db');
const r = db.prepare("UPDATE users SET subscription_status='active', subscription_plan='basic' WHERE email='test@example.com'").run();
console.log('Lignes modifiées:', r.changes);
