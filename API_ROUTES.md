# API Routes

Base URL:

```text
http://localhost:3000/api/v1
```

Use Supabase Auth access tokens on protected routes:

```http
Authorization: Bearer <access_token>
```

## Public

```text
GET /health
GET /shop
GET /categories
GET /products
GET /products/:slug
GET /reviews/products/:productId
GET /discounts
GET /discounts/:code
```

## Auth

```text
POST  /auth/signup
POST  /auth/login
GET   /auth/google
POST  /auth/refresh
POST  /auth/forgot-password
POST  /auth/otp/email
POST  /auth/otp/email/verify
POST  /auth/otp/phone
POST  /auth/otp/phone/verify
GET   /auth/me
POST  /auth/logout
PATCH /auth/password
```

## Customer

```text
GET    /users/me
PATCH  /users/me
GET    /users/me/addresses
POST   /users/me/addresses
PATCH  /users/me/addresses/:id
DELETE /users/me/addresses/:id

GET    /cart
POST   /cart/items
PATCH  /cart/items/:id
DELETE /cart/items/:id

GET    /orders
POST   /orders
GET    /orders/:id

GET    /wishlists
POST   /wishlists/items
DELETE /wishlists/:wishlistId/items/:productId

POST   /reviews
GET    /returns
POST   /returns
```

## Admin

Requires a logged-in `profiles.role` of `admin` or `staff` and `SUPABASE_SERVICE_ROLE_KEY`.

```text
PUT    /admin/shop

POST   /admin/categories
PATCH  /admin/categories/:id
DELETE /admin/categories/:id

POST   /admin/products
PATCH  /admin/products/:id
DELETE /admin/products/:id
PUT    /admin/products/:id/categories

POST   /admin/product-media
PATCH  /admin/product-media/:id
DELETE /admin/product-media/:id

GET    /admin/orders
GET    /admin/orders/:id
PATCH  /admin/orders/:id
POST   /admin/payments
POST   /admin/shipments
PUT    /admin/inventory

POST   /admin/discounts
PATCH  /admin/discounts/:id
DELETE /admin/discounts/:id

POST   /admin/tax-rates
PATCH  /admin/tax-rates/:id
DELETE /admin/tax-rates/:id

GET    /admin/reviews
PATCH  /admin/reviews/:id
GET    /admin/returns
PATCH  /admin/returns/:id
GET    /admin/customers
PATCH  /admin/customers/:id/role
```
