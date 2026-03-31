// This script runs once when the MongoDB container is first created.
// It creates the ecommerce database and a dedicated app user with
// readWrite permissions — keeps the app off the root credentials.

db = db.getSiblingDB('ecommerce');

db.createUser({
  user: 'ecom_app',
  pwd:  'ecom_app_pass',
  roles: [{ role: 'readWrite', db: 'ecommerce' }],
});

// Seed collections with indexes so they exist before the app starts
db.createCollection('users');
db.createCollection('products');
db.createCollection('orders');
db.createCollection('reviews');

print('MongoDB init: ecommerce database and app user created.');